// Minimal in-memory token bucket. Single-instance safe; for multi-instance
// prod put a Redis/Upstash counter here — the call sites stay the same.
const buckets = new Map<string, { count: number; resetAt: number }>();

function bucketLimit(): { max: number; windowMs: number } {
  const max = Number(process.env.RATE_LIMIT_MAX ?? 60);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  return {
    max: Number.isFinite(max) && max > 0 ? Math.floor(max) : 60,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000,
  };
}

export function rateLimit(key: string): { ok: boolean; remaining: number; resetAt: number } {
  const { max, windowMs } = bucketLimit();
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (cur.count >= max) return { ok: false, remaining: 0, resetAt: cur.resetAt };
  cur.count += 1;
  return { ok: true, remaining: max - cur.count, resetAt: cur.resetAt };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = (fwd?.split(',')[0] ?? '').trim() || 'unknown';
  return `agent:${ip}`;
}
