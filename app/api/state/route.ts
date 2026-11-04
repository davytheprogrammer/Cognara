import { NextResponse } from 'next/server';
import { loadDb } from '@/lib/store';
import { llmStatus } from '@/lib/llm/provider';
import { nextAction } from '@/lib/mastery';
import { recommendInterventions } from '@/lib/agent/tools';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawParam = searchParams.get('userId');
  const userId = (rawParam ?? 'maya').trim().slice(0, 64) || 'maya';
  let db;
  try {
    db = await loadDb();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Database unavailable.' },
      { status: 503 },
    );
  }
  // Fail closed: an explicit unknown userId is a 404, never a fallback to
  // another student's data.
  const student = db.students.find((s) => s.id === userId);
  if (!student) {
    return NextResponse.json(
      { error: rawParam ? 'Unknown student.' : 'No students found.' },
      { status: rawParam ? 404 : 503 },
    );
  }
  const newestFirst = [...student.attempts].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const thread = newestFirst.length > 0 ? newestFirst[0].conceptId : 'rate-of-change';
  const threadMastery = student.mastery[thread] ?? 50;
  let focusConceptId = thread;
  if (threadMastery >= 70) {
    let weakest = thread;
    for (const c of db.concepts) {
      if ((student.mastery[c.id] ?? 50) < (student.mastery[weakest] ?? 50)) weakest = c.id;
    }
    focusConceptId = weakest;
  }
  const focusConcept = db.concepts.find((c) => c.id === focusConceptId) ?? db.concepts[0];
  if (!focusConcept) return NextResponse.json({ error: 'No concepts found.' }, { status: 503 });
  const mastery = student.mastery[focusConceptId] ?? 50;
  const action = nextAction(mastery, 0);
  const recs = await recommendInterventions();
  return NextResponse.json(
    {
      student, courses: db.courses, concepts: db.concepts,
      focus: { concept: focusConcept, mastery, action },
      chats: db.chats[student.id] ?? [],
      attempts: newestFirst.slice(0, 10),
      interventions: db.interventions,
      recommendations: recs,
      llm: llmStatus(),
      peers: db.students.map((s) => ({ id: s.id, name: s.name, initials: s.initials, mastery: s.mastery })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
