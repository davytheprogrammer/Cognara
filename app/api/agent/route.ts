import { NextResponse } from 'next/server';
import { chatReply, diagnoseGap, generateExercise, gradeAttempt, publishIntervention, recommendInterventions } from '@/lib/agent/tools';
import { isAdminRequest } from '@/lib/env';
import { logEvent, requestId } from '@/lib/log';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/store';

const OPS = new Set(['chat', 'diagnose', 'exercise', 'grade', 'recommend', 'publish']);

function cleanId(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v.trim().slice(0, 64) : '';
  return s || fallback;
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: Request) {
  const rid = requestId(req);
  const rl = rateLimit(clientKey(req));
  if (!rl.ok) {
    logEvent('agent.rate_limited', { rid, op: 'unknown' });
    return NextResponse.json(
      { error: 'Too many requests. Slow down and try again.' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((rl.resetAt - Date.now()) / 1000)), 'x-request-id': rid } },
    );
  }
  let body: { op: string; userId?: string; conceptId?: string; exerciseId?: string; answer?: string; text?: string; approved?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body || !OPS.has(body.op)) return NextResponse.json({ error: 'Unknown op.' }, { status: 400 });
  if (body.op === 'publish' && !isAdminRequest(req)) {
    return NextResponse.json({ error: 'Educator approval required (admin token missing).' }, { status: 403 });
  }
  const userId = cleanId(body.userId, 'maya');
  const conceptId = cleanId(body.conceptId, 'rate-of-change');
  try {
    switch (body.op) {
      case 'chat': {
        const text = cleanText(body.text, 2000);
        if (!text) return NextResponse.json({ error: 'Empty message.' }, { status: 400 });
        const r = await chatReply(userId, text, conceptId);
        return NextResponse.json(r);
      }
      case 'diagnose': {
        const r = await diagnoseGap(userId, body.conceptId ? conceptId : 'rate-of-change');
        return NextResponse.json({ mastery: r.mastery, action: r.action, trace: r.trace });
      }
      case 'exercise': {
        const r = await generateExercise(userId, conceptId);
        return NextResponse.json(r);
      }
      case 'grade': {
        const exerciseId = cleanId(body.exerciseId, '');
        if (!exerciseId) return NextResponse.json({ error: 'Missing exercise.' }, { status: 400 });
        const answer = cleanText(body.answer, 2000);
        const r = await gradeAttempt(userId, exerciseId, answer);
        logEvent('agent.grade', { rid, userId, correct: r.correct, before: r.before, after: r.after });
        return NextResponse.json(r, { headers: { 'x-request-id': rid } });
      }
      case 'recommend': {
        return NextResponse.json({ recommendations: await recommendInterventions() }, { headers: { 'x-request-id': rid } });
      }
      case 'publish': {
        const r = await publishIntervention(conceptId, body.approved === true);
        await writeAudit('educator', 'publish', `${conceptId} -> ${(r.intervention.affectedStudents ?? []).join(', ')}`);
        logEvent('educator.publish', { rid, conceptId });
        return NextResponse.json(r, { headers: { 'x-request-id': rid } });
      }
      default:
        return NextResponse.json({ error: 'Unknown op.' }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Agent action failed.';
    const status = /database|turso|credentials|unavailable|network|fetch|LLM/i.test(msg) ? 503 : 400;
    logEvent('agent.error', { rid, op: body?.op ?? 'unknown', status });
    return NextResponse.json({ error: msg }, { status, headers: { 'x-request-id': rid } });
  }
}
