import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/env';
import { logEvent, requestId } from '@/lib/log';
import { resetDb, writeAudit } from '@/lib/store';

// Destructive by design. Requires explicit confirmation AND admin token
// when ADMIN_TOKEN is configured (always in production).
export async function POST(req: Request) {
  const rid = requestId(req);
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Forbidden: admin token required.' }, { status: 403 });
  }
  let confirm = false;
  try {
    const body = await req.json() as { confirm?: boolean };
    confirm = body?.confirm === true;
  } catch {
    confirm = false;
  }
  if (!confirm) {
    return NextResponse.json({ error: 'Reset requires { "confirm": true }.' }, { status: 400 });
  }
  try {
    const db = await resetDb();
    await writeAudit('educator', 'reset', `classroom reseeded (${db.students.length} students)`);
    logEvent('educator.reset', { rid });
    return NextResponse.json({ ok: true, students: db.students.map((s) => s.id) }, { headers: { 'x-request-id': rid } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Reset failed.' },
      { status: 503 },
    );
  }
}
