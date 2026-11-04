import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-safe: no Node imports, no DB. Adds a request ID and keeps the
// security headers consistent even when next.config headers are bypassed.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const rid = req.headers.get('x-request-id') ?? crypto.randomUUID().slice(0, 8);
  res.headers.set('x-request-id', rid);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
