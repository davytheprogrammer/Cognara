import fs from 'node:fs';
import path from 'node:path';

// Keep dotenv out of dependencies: parse .env.local directly.
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main() {
  const { ensureSchema, resetDb } = await import('@/lib/store');
  await ensureSchema();
  const db = await resetDb();
  const attempts = db.students.reduce((a, s) => a + s.attempts.length, 0);
  console.log(
    `Cognara seeded: ${db.students.length} students, ${db.courses.length} courses, ` +
      `${db.concepts.length} concepts, ${db.exercises.length} exercises, ` +
      `${db.interventions.length} interventions, ${attempts} attempts.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
