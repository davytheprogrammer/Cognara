// Structured prod logging. JSON lines in production for aggregation,
// human-readable in dev. Never log secrets, answers, or full prompts.
export function logEvent(event: string, fields: Record<string, string | number | boolean> = {}): void {
  const base = { ts: new Date().toISOString(), event, ...fields };
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(base));
  } else {
    const extra = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`[${base.ts}] ${event}${extra ? ` ${extra}` : ''}`);
  }
}

export function requestId(req: Request): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID().slice(0, 8);
}
