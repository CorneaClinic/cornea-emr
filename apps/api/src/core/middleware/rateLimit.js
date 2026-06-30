import { env } from '../../config/env.js';
import { TooManyRequestsError } from '../errors.js';
import { logger } from '../logger.js';
import { consumeRateLimit, getRedis, isRedisConfigured } from '../redis.js';

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

/**
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {(req: import('express').Request) => string} opts.keyGenerator
 */
function createMemoryRateLimiter({ windowMs, max, keyGenerator }) {
  return (req, _res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      const err = new TooManyRequestsError('Too many requests; try again later');
      err.retryAfter = retryAfterSec;
      return next(err);
    }

    next();
  };
}

function useMemoryOnly() {
  return env.nodeEnv === 'test' || !isRedisConfigured();
}

/**
 * Rate limiter with Redis when REDIS_URL is set; in-memory otherwise.
 * Falls back to in-memory if Redis is temporarily unavailable.
 *
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {(req: import('express').Request) => string} opts.keyGenerator
 * @param {string} [opts.namespace]
 */
export function createRateLimiter({ windowMs, max, keyGenerator, namespace = 'default' }) {
  const memory = createMemoryRateLimiter({ windowMs, max, keyGenerator });

  return (req, res, next) => {
    if (useMemoryOnly()) {
      return memory(req, res, next);
    }

    (async () => {
      const redis = await getRedis();
      if (!redis) {
        return memory(req, res, next);
      }

      try {
        const key = keyGenerator(req);
        const result = await consumeRateLimit(redis, namespace, key, windowMs, max);
        if (!result.allowed) {
          const err = new TooManyRequestsError('Too many requests; try again later');
          err.retryAfter = result.retryAfterSec;
          return next(err);
        }
        next();
      } catch (err) {
        logger.warn({ err: err.message, namespace }, 'Redis rate limit error; using in-memory fallback');
        memory(req, res, next);
      }
    })().catch(next);
  };
}

/**
 * @param {import('express').Request} req
 */
export function clientIpKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return `ip:${forwarded.split(',')[0].trim()}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * @param {import('express').Request} req
 */
export function loginEmailKey(req) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  return email ? `email:${email}` : 'email:unknown';
}

/** @internal — test helper */
export function _clearMemoryBucketsForTests() {
  buckets.clear();
}
