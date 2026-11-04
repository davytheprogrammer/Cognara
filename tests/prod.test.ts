import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '@/lib/rate-limit';

describe('production guards (offline)', () => {
  it('rate-limits a single key', () => {
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '60_000';
    const key = `test-${Date.now()}-${Math.random()}`;
    assert.equal(rateLimit(key).ok, true);
    assert.equal(rateLimit(key).ok, true);
    assert.equal(rateLimit(key).ok, true);
    assert.equal(rateLimit(key).ok, false);
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('admin gate is closed in prod without token, open in dev', async () => {
    const bucket = process.env as Record<string, string | undefined>;
    const prevNode = bucket.NODE_ENV;
    const prevToken = bucket.ADMIN_TOKEN;
    const env = await import('@/lib/env');
    bucket.NODE_ENV = 'production';
    bucket.ADMIN_TOKEN = '';
    assert.equal(env.isAdminRequest(new Request('http://x/')), false);
    bucket.ADMIN_TOKEN = 'secret';
    assert.equal(
      env.isAdminRequest(new Request('http://x/', { headers: { 'x-admin-token': 'secret' } })),
      true,
    );
    assert.equal(
      env.isAdminRequest(new Request('http://x/', { headers: { 'x-admin-token': 'wrong' } })),
      false,
    );
    bucket.NODE_ENV = prevNode;
    if (prevToken === undefined) delete bucket.ADMIN_TOKEN;
    else bucket.ADMIN_TOKEN = prevToken;
  });
});
