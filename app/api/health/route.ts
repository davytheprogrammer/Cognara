import { NextResponse } from 'next/server';

// Liveness + Turso reachability. No secrets, cheap, cache-free.
export async function GET() {
  const started = Date.now();
  try {
    const { getClient } = await import('@/lib/store');
    await getClient().execute('SELECT 1 AS ok');
    return NextResponse.json({
      ok: true,
      db: 'up',
      latencyMs: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        db: 'down',
        error: e instanceof Error ? e.message : 'Database unavailable.',
      },
      { status: 503 },
    );
  }
}
