import { createClient, type Client } from '@libsql/client';
import { seedDb } from '@/lib/seed';
import { tursoConfig } from '@/lib/env';
import type { Attempt, ChatMessage, Db, Intervention, Student } from '@/lib/types';

let client: Client | null = null;

export function getClient(): Client {
  if (client) return client;
  const { url, authToken } = tursoConfig();
  client = createClient({ url, authToken });
  return client;
}

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const c = getClient();
  await c.batch([
    `CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
      tagline TEXT NOT NULL, initials TEXT NOT NULL,
      streak_days INTEGER NOT NULL DEFAULT 0, minutes_month INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS mastery (
      student_id TEXT NOT NULL, concept_id TEXT NOT NULL, value INTEGER NOT NULL,
      PRIMARY KEY (student_id, concept_id)
    )`,
    `CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, concept_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL, answer TEXT NOT NULL, correct INTEGER NOT NULL,
      feedback TEXT NOT NULL, at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts (student_id, at)`,
    `CREATE TABLE IF NOT EXISTS chats (
      student_id TEXT NOT NULL, msg_id TEXT NOT NULL, sender TEXT NOT NULL,
      text TEXT NOT NULL, at TEXT NOT NULL,
      PRIMARY KEY (student_id, msg_id)
    )`,
    `CREATE TABLE IF NOT EXISTS interventions (
      id TEXT PRIMARY KEY, concept_id TEXT NOT NULL, title TEXT NOT NULL,
      detail TEXT NOT NULL, affected_json TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
      detail TEXT NOT NULL, at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs (at)`,
  ]);
  schemaEnsured = true;
}

async function seedIfEmpty(): Promise<void> {
  const c = getClient();
  const count = await c.execute('SELECT COUNT(*) AS n FROM students');
  if (Number(count.rows[0]?.n ?? 0) > 0) return;
  const seed = seedDb();
  const stmts: { sql: string; args: (string | number)[] }[] = [];
  for (const s of seed.students) {
    stmts.push({
      sql: 'INSERT INTO students (id, name, role, tagline, initials, streak_days, minutes_month) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [s.id, s.name, s.role, s.tagline, s.initials, s.streakDays, s.minutesThisMonth],
    });
    for (const [conceptId, value] of Object.entries(s.mastery)) {
      stmts.push({
        sql: 'INSERT INTO mastery (student_id, concept_id, value) VALUES (?, ?, ?)',
        args: [s.id, conceptId, value],
      });
    }
  }
  await c.batch(stmts);
}

/** Full workspace snapshot: live rows from Turso + static course catalog from code. */
export async function loadDb(): Promise<Db> {
  await ensureSchema();
  await seedIfEmpty();
  const c = getClient();
  const seed = seedDb();
  const [sRows, mRows, aRows, chRows, iRows] = await Promise.all([
    c.execute('SELECT * FROM students'),
    c.execute('SELECT * FROM mastery'),
    c.execute('SELECT * FROM attempts ORDER BY at DESC LIMIT 500'),
    c.execute('SELECT * FROM chats ORDER BY at ASC LIMIT 1000'),
    c.execute('SELECT * FROM interventions ORDER BY created_at DESC'),
  ]);

  const masteryBy: Record<string, Record<string, number>> = {};
  for (const r of mRows.rows) {
    const sid = String(r.student_id);
    (masteryBy[sid] ??= {})[String(r.concept_id)] = Number(r.value);
  }
  const attemptsBy: Record<string, Attempt[]> = {};
  for (const r of aRows.rows) {
    const sid = String(r.student_id);
    (attemptsBy[sid] ??= []).push({
      id: String(r.id), conceptId: String(r.concept_id), exerciseId: String(r.exercise_id),
      answer: String(r.answer), correct: Number(r.correct) === 1,
      feedback: String(r.feedback), at: String(r.at),
    });
  }
  const chats: Record<string, ChatMessage[]> = {};
  for (const r of chRows.rows) {
    const sid = String(r.student_id);
    (chats[sid] ??= []).push({
      id: String(r.msg_id), from: String(r.sender) === 'student' ? 'student' : 'cognara',
      text: String(r.text), at: String(r.at),
    });
  }

  const students: Student[] = sRows.rows.map((r) => {
    const sid = String(r.id);
    return {
      id: sid, name: String(r.name), role: String(r.role) === 'educator' ? 'educator' : 'student',
      tagline: String(r.tagline), initials: String(r.initials),
      mastery: masteryBy[sid] ?? {}, attempts: attemptsBy[sid] ?? [],
      streakDays: Number(r.streak_days), minutesThisMonth: Number(r.minutes_month),
    };
  });

  return {
    students,
    courses: seed.courses,
    concepts: seed.concepts,
    exercises: seed.exercises,
    interventions: iRows.rows.map((r) => ({
      id: String(r.id), conceptId: String(r.concept_id), title: String(r.title),
      detail: String(r.detail), affectedStudents: JSON.parse(String(r.affected_json)) as string[],
      status: String(r.status) === 'proposed' ? 'proposed' : 'published',
      createdAt: String(r.created_at),
    })) as Intervention[],
    chats,
  };
}

export async function setMastery(studentId: string, conceptId: string, value: number): Promise<void> {
  if (!studentId.trim() || !conceptId.trim()) throw new Error('Unknown student or concept.');
  await getClient().execute({
    sql: 'INSERT INTO mastery (student_id, concept_id, value) VALUES (?, ?, ?) ON CONFLICT (student_id, concept_id) DO UPDATE SET value = excluded.value',
    args: [studentId, conceptId, Math.max(0, Math.min(100, Math.round(value)))],
  });
}

/** Grade persistence: mastery update + attempt row + practice minutes, one batch. */
export async function applyAttempt(studentId: string, conceptId: string, masteryValue: number, attempt: Attempt): Promise<void> {
  const c = getClient();
  // Live streak: consecutive UTC days with graded work. Seeded baselines survive until a gap breaks them.
  let streakSql = 'UPDATE students SET minutes_month = minutes_month + 5 WHERE id = ?';
  let streakArgs: (string | number)[] = [studentId];
  try {
    const prev = await c.execute({
      sql: 'SELECT s.streak_days AS streak, MAX(a.at) AS last_at FROM students s LEFT JOIN attempts a ON a.student_id = s.id WHERE s.id = ? GROUP BY s.streak_days',
      args: [studentId],
    });
    const row = prev.rows[0];
    const base = Number(row?.streak ?? 0);
    const lastAt = row?.last_at ? String(row.last_at).slice(0, 10) : null;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const next = lastAt === today ? base : lastAt === yesterday ? base + 1 : lastAt === null ? Math.max(base, 1) : 1;
    streakSql = 'UPDATE students SET minutes_month = minutes_month + 5, streak_days = ? WHERE id = ?';
    streakArgs = [next, studentId];
  } catch {
    // Keep the attempt even if streak math fails.
  }
  await c.batch([
    {
      sql: 'INSERT INTO mastery (student_id, concept_id, value) VALUES (?, ?, ?) ON CONFLICT (student_id, concept_id) DO UPDATE SET value = excluded.value',
      args: [studentId, conceptId, masteryValue],
    },
    {
      sql: 'INSERT INTO attempts (id, student_id, concept_id, exercise_id, answer, correct, feedback, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [attempt.id, studentId, attempt.conceptId, attempt.exerciseId, attempt.answer, attempt.correct ? 1 : 0, attempt.feedback, attempt.at],
    },
    { sql: streakSql, args: streakArgs },
  ]);
}

export async function appendChat(studentId: string, msgs: ChatMessage[]): Promise<void> {
  await getClient().batch(
    msgs.map((m) => ({
      sql: 'INSERT OR IGNORE INTO chats (student_id, msg_id, sender, text, at) VALUES (?, ?, ?, ?, ?)',
      args: [studentId, m.id, m.from, m.text, m.at],
    })),
  );
}

export async function addIntervention(iv: Intervention): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO interventions (id, concept_id, title, detail, affected_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [iv.id, iv.conceptId, iv.title, iv.detail, JSON.stringify(iv.affectedStudents), iv.status, iv.createdAt],
  });
}

export async function writeAudit(actor: string, action: string, detail: string): Promise<void> {
  try {
    await getClient().execute({
      sql: 'INSERT INTO audit_logs (id, actor, action, detail, at) VALUES (?, ?, ?, ?, ?)',
      args: [`aud-${crypto.randomUUID()}`, actor.slice(0, 64), action.slice(0, 64), detail.slice(0, 2000), new Date().toISOString()],
    });
  } catch {
    // Audit must never break the primary write.
  }
}

/** Full reseed: wipes live rows, restores the baseline classroom. */
export async function resetDb(): Promise<Db> {
  await ensureSchema();
  const c = getClient();
  await c.batch([
    'DELETE FROM interventions', 'DELETE FROM chats', 'DELETE FROM attempts',
    'DELETE FROM mastery', 'DELETE FROM students', 'DELETE FROM audit_logs',
  ]);
  schemaEnsured = true;
  await seedIfEmpty();
  return loadDb();
}
