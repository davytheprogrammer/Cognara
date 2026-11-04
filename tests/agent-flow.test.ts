import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function dbAvailable(): boolean {
  const url = (process.env.TURSO_DATABASE_URL ?? '').trim();
  const token = (process.env.TURSO_AUTH_TOKEN ?? '').trim();
  return Boolean(url && token && !url.includes('<') && !token.includes('<'));
}

describe('agent exercise flow (Turso-backed store)', () => {
  it('generates a foundations exercise for a struggling student', async (t) => {
    loadEnv();
    if (!dbAvailable()) t.skip('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not configured');
    const { generateExercise } = await import('@/lib/agent/tools');
    // Regression: generateExercise once forgot to await the async store,
    // so db.exercises was undefined (TypeError reading 'filter').
    const r = await generateExercise('maya', 'rate-of-change');
    assert.ok(r.exercise?.id, 'exercise has an id');
    assert.equal(r.difficulty, 'foundations');
    assert.equal(r.action.kind, 'reteach');
  });

  it('grading a correct answer raises mastery and persists', async (t) => {
    loadEnv();
    if (!dbAvailable()) t.skip('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not configured');
    const tools = await import('@/lib/agent/tools');
    const store = await import('@/lib/store');
    const before = (await store.loadDb()).students.find((s) => s.id === 'maya')!.mastery['rate-of-change'];
    const startedAt = new Date().toISOString();

    const { exercise } = await tools.generateExercise('maya', 'rate-of-change');
    const graded = await tools.gradeAttempt('maya', exercise.id, exercise.expected!);
    assert.equal(graded.correct, true);
    assert.ok(graded.after > graded.before, `mastery rose ${graded.before}→${graded.after}`);
    const streak = (await store.loadDb()).students.find((s) => s.id === 'maya')!.streakDays;
    assert.ok(streak >= 1, `streak stays live (got ${streak})`);

    // Self-cleaning: restore baseline mastery, remove rows this test wrote.
    await store.setMastery('maya', 'rate-of-change', before);
    await store.getClient().execute({
      sql: "DELETE FROM attempts WHERE student_id = 'maya' AND at >= ?",
      args: [startedAt],
    });
    const restored = (await store.loadDb()).students.find((s) => s.id === 'maya')!.mastery['rate-of-change'];
    assert.equal(restored, before);
  });
});
