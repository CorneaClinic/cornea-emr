import { TooManyRequestsError } from '../errors.js';

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

/**
 * Simple in-memory sliding-window rate limiter (per key).
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {(req: import('express').Request) => string} opts.keyGenerator
 */
export function createRateLimiter({ windowMs, max, keyGenerator }) {
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
