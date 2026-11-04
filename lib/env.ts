// Central env access. Fail fast with actionable messages, never leak secrets.
function clean(v: string | undefined): string {
  return (v ?? '').trim();
}

export function tursoConfig(): { url: string; authToken: string } {
  const url = clean(process.env.TURSO_DATABASE_URL);
  const authToken = clean(process.env.TURSO_AUTH_TOKEN);
  if (!url || !authToken || url.includes('<') || authToken.includes('<')) {
    throw new Error(
      'Database unavailable: missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.',
    );
  }
  return { url, authToken };
}

export function adminToken(): string {
  return clean(process.env.ADMIN_TOKEN);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// In production an admin token is required to gate destructive/educator
// actions (reset, publish). In dev it stays optional so the demo runs
// with zero config.
export function requireAdminConfigured(): void {
  if (isProduction() && !adminToken()) {
    throw new Error(
      'Production misconfigured: set ADMIN_TOKEN to gate educator/reset actions.',
    );
  }
}

export function isAdminRequest(req: Request): boolean {
  const token = adminToken();
  if (!token) return !isProduction(); // open in dev, closed in prod
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  // Also accept a same-origin admin header from the educator console.
  const alt = (req.headers.get('x-admin-token') ?? '').trim();
  return bearer === token || alt === token;
}
