import { difficultyFor, nextAction, recordAttempt } from '@/lib/mastery';
import { activeProvider } from '@/lib/llm/provider';
import { addIntervention, appendChat, applyAttempt, loadDb } from '@/lib/store';
import type { Difficulty, TraceStep } from '@/lib/types';

function step(tool: string, input: string, result: string): TraceStep {
  return { tool, input, result, at: new Date().toISOString() };
}

async function recentWrongStreak(studentId: string, conceptId: string): Promise<number> {
  const db = await loadDb();
  const s = db.students.find((x) => x.id === studentId);
  if (!s) return 0;
  // loadDb returns attempts newest-first (ORDER BY at DESC). Walk from the
  // newest attempt backwards so a recent correct answer breaks the streak.
  // Skip other concepts without breaking — they are a different thread.
  const ordered = [...s.attempts].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  let n = 0;
  for (const a of ordered) {
    if (a.conceptId !== conceptId) continue;
    if (a.correct) break;
    n++;
  }
  return n;
}

/** Tool: diagnose the student's knowledge gap for a concept. */
export async function diagnoseGap(studentId: string, conceptId: string) {
  const db = await loadDb();
  const student = db.students.find((s) => s.id === studentId);
  const concept = db.concepts.find((c) => c.id === conceptId);
  if (!student || !concept) throw new Error('Unknown student or concept.');
  const mastery = student.mastery[conceptId] ?? 50;
  const streakWrong = await recentWrongStreak(studentId, conceptId);
  const action = nextAction(mastery, streakWrong);
  const trace = [step('diagnoseGap', `${student.name} · ${concept.title} · mastery ${mastery}%`, `${action.label}: ${action.reason}`)];
  return { mastery, streakWrong, action, concept, student, trace };
}

/** Tool: generate an exercise matched to current mastery. Real DB write. */
export async function generateExercise(studentId: string, conceptId: string) {
  const { mastery, action, student } = await diagnoseGap(studentId, conceptId);
  const difficulty: Difficulty = difficultyFor(mastery, action.kind);
  const db = await loadDb();
  const pool = db.exercises.filter((e) => e.conceptId === conceptId && e.difficulty === difficulty);
  const fallback = db.exercises.filter((e) => e.conceptId === conceptId);
  const candidates = pool.length > 0 ? pool : fallback;
  if (candidates.length === 0) throw new Error('No exercises for this concept yet.');
  // Rotate: prefer the candidate least recently attempted so students do not
  // get the same question twice in a row when a pool has >1 item. Falls back
  // to pool[0] for a stable demo when there is no attempt history.
  const lastSeen = new Map<string, number>();
  student.attempts
    .filter((a) => a.conceptId === conceptId)
    .forEach((a, idx) => {
      if (!lastSeen.has(a.exerciseId)) lastSeen.set(a.exerciseId, idx);
    });
  const exercise =
    [...candidates].sort((a, b) => (lastSeen.get(b.id) ?? -1) - (lastSeen.get(a.id) ?? -1)).pop() ??
    candidates[0];
  const trace = [
    step('diagnoseGap', `mastery ${mastery}% → ${action.label}`, action.reason),
    step('generateExercise', `${conceptId} @ ${difficulty}`, `Selected "${exercise.id}": ${exercise.prompt.slice(0, 80)}…`),
  ];
  return { exercise, difficulty, action, mastery, trace };
}

/** Tool: grade an answer, update mastery, and decide the next step. */
export async function gradeAttempt(studentId: string, exerciseId: string, answer: string) {
  const clean = answer.trim().slice(0, 2000);
  if (!clean) throw new Error('Empty answer — the agent refuses to grade nothing.');
  if (!studentId.trim() || !exerciseId.trim()) throw new Error('Unknown exercise or student.');
  const db = await loadDb();
  const exercise = db.exercises.find((e) => e.id === exerciseId);
  const student = db.students.find((s) => s.id === studentId);
  if (!exercise || !student) throw new Error('Unknown exercise or student.');
  const concept = db.concepts.find((c) => c.id === exercise.conceptId);
  if (!concept) throw new Error('Unknown exercise or student.');

  const provider = activeProvider();
  const { correct, feedback } = await provider.grade(exercise.prompt, exercise.expected, clean);
  const before = student.mastery[concept.id] ?? 50;

  const after = recordAttempt(before, correct, exercise.difficulty);
  await applyAttempt(studentId, concept.id, after, {
    id: `att-${crypto.randomUUID()}`, conceptId: concept.id, exerciseId,
    answer: clean, correct, feedback, at: new Date().toISOString(),
  });
  const streakWrong = await recentWrongStreak(studentId, concept.id);
  const action = nextAction(after, streakWrong);
  const followUp = await provider.teach({
    conceptTitle: concept.title, verifiedSummary: concept.summary, analogy: concept.analogy,
    mastery: after, studentName: student.name, lastWrong: !correct,
  });

  const trace = [
    step('gradeAttempt', `"${answer.trim().slice(0, 60)}" vs expected "${exercise.expected}"`, correct ? 'Correct' : 'Incorrect — misconception flagged'),
    step('updateMastery', `${concept.title}: ${before}% → ${after}%`, `${action.label}: ${action.reason}`),
  ];
  return { correct, feedback, before, after, action, followUp, concept, trace };
}

/** Tool: adaptive chat reply grounded in course material. */
export async function chatReply(studentId: string, text: string, conceptId: string) {
  const db = await loadDb();
  const student = db.students.find((s) => s.id === studentId);
  const concept = db.concepts.find((c) => c.id === conceptId);
  if (!student || !concept) throw new Error('Unknown student or concept.');
  const mastery = student.mastery[conceptId] ?? 50;
  const provider = activeProvider();
  const reply = await provider.teach({
    conceptTitle: concept.title, verifiedSummary: concept.summary, analogy: concept.analogy,
    mastery, studentName: student.name, lastWrong: /don't|confus|stuck|wrong|don't get/i.test(text),
  });
  const cleanText = text.trim().slice(0, 2000);
  if (!cleanText) throw new Error('Empty message.');
  const now = new Date().toISOString();
  await appendChat(studentId, [
    { id: `m-${crypto.randomUUID()}-s`, from: 'student', text: cleanText, at: now },
    { id: `m-${crypto.randomUUID()}-c`, from: 'cognara', text: reply, at: now },
  ]);
  return { reply, mastery, trace: [step('chatReply', text.slice(0, 80), `Adaptive reply @ mastery ${mastery}%`)] };
}

/** Tool (educator): find concepts many students struggle with. */
export async function recommendInterventions() {
  const db = await loadDb();
  const students = db.students;
  const out: { conceptId: string; title: string; avgMastery: number; affected: string[]; proposal: string; trace: TraceStep[] }[] = [];
  for (const concept of db.concepts) {
    const rows = students.map((s) => ({ name: s.name, m: s.mastery[concept.id] ?? 50 }));
    const avg = Math.round(rows.reduce((a, r) => a + r.m, 0) / Math.max(1, rows.length));
    const affected = rows.filter((r) => r.m < 50).map((r) => r.name);
    if (affected.length > 0) {
      out.push({
        conceptId: concept.id, title: concept.title, avgMastery: avg, affected,
        proposal: `30-min revision session on ${concept.title}: re-teach with concrete analogy, then 3 scaffolded exercises. Targets: ${affected.join(', ')}.`,
        trace: [step('recommendIntervention', `${concept.title}: avg ${avg}%`, `${affected.length} student(s) below 50%`)],
      });
    }
  }
  out.sort((a, b) => a.avgMastery - b.avgMastery);
  return out;
}

/** Tool (educator, approval-gated): publish an intervention. Real write. */
export async function publishIntervention(conceptId: string, approved: boolean) {
  if (!approved) throw new Error('Educator approval required — the agent will not publish without it.');
  const recs = await recommendInterventions();
  const rec = recs.find((r) => r.conceptId === conceptId);
  if (!rec) throw new Error('No open intervention for this concept.');
  if (!conceptId.trim()) throw new Error('No open intervention for this concept.');
  const db = await loadDb();
  const concept = db.concepts.find((c) => c.id === conceptId);
  if (!concept) throw new Error('No open intervention for this concept.');
  const record = {
    id: `int-${crypto.randomUUID()}`, conceptId, title: `Revision session: ${concept.title}`,
    detail: rec.proposal, affectedStudents: rec.affected, status: 'published' as const, createdAt: new Date().toISOString(),
  };
  await addIntervention(record);
  return { intervention: record, trace: [step('publishIntervention', `${concept.title} (approved)`, `Published to ${rec.affected.join(', ')}`)] };
}
