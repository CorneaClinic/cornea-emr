import { describe, it, expect, beforeEach } from 'vitest';
import { createRateLimiter, _clearMemoryBucketsForTests } from '../src/core/middleware/rateLimit.js';

function mockReq(ip = '127.0.0.1') {
  return { ip, headers: {} };
}

describe('createRateLimiter (in-memory)', () => {
  beforeEach(() => {
    _clearMemoryBucketsForTests();
  });

  it('allows requests under the limit', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyGenerator: (req) => `test:${req.ip}`,
      namespace: 'test'
    });

    await new Promise((resolve, reject) => {
      limiter(mockReq(), {}, (err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve, reject) => {
      limiter(mockReq(), {}, (err) => (err ? reject(err) : resolve()));
    });
  });

  it('blocks requests over the limit with retryAfter', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => `test:${req.ip}`,
      namespace: 'test'
    });

    await new Promise((resolve, reject) => {
      limiter(mockReq(), {}, (err) => (err ? reject(err) : resolve()));
    });

    const err = await new Promise((resolve) => {
      limiter(mockReq(), {}, (e) => resolve(e));
    });
    expect(err?.statusCode).toBe(429);
    expect(err?.retryAfter).toBeGreaterThan(0);
  });
});
