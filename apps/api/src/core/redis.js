import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** @type {import('redis').RedisClientType | null} */
let client = null;

/** @type {Promise<import('redis').RedisClientType | null> | null} */
let connectPromise = null;

export function isRedisConfigured() {
  return Boolean(env.redis.url) && env.nodeEnv !== 'test';
}

/**
 * Connect to Redis when REDIS_URL is set (production / staging).
 * @returns {Promise<import('redis').RedisClientType | null>}
 */
export async function initRedis() {
  if (!isRedisConfigured()) {
    logger.info('Redis not configured — rate limits use in-memory store');
    return null;
  }

  if (client?.isOpen) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const next = createClient({
      url: env.redis.url,
      socket: {
        connectTimeout: env.redis.connectTimeoutMs,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
      }
    });

    next.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis client error');
    });

    await next.connect();
    client = next;
    logger.info('Redis connected — shared rate limits active');
    return client;
  })();

  try {
    return await connectPromise;
  } catch (err) {
    connectPromise = null;
    client = null;
    logger.warn({ err }, 'Redis connection failed — rate limits will use in-memory fallback');
    return null;
  }
}

/**
 * @returns {Promise<import('redis').RedisClientType | null>}
 */
export async function getRedis() {
  if (!isRedisConfigured()) return null;
  if (client?.isOpen) return client;
  return initRedis();
}

export async function closeRedis() {
  connectPromise = null;
  if (!client) return;
  try {
    if (client.isOpen) await client.quit();
  } catch (err) {
    logger.warn({ err }, 'Redis shutdown error');
  } finally {
    client = null;
  }
}

/**
 * @param {import('redis').RedisClientType} redis
 * @param {string} namespace
 * @param {string} key
 * @param {number} windowMs
 * @param {number} max
 * @returns {Promise<{ allowed: boolean, retryAfterSec: number }>}
 */
export async function consumeRateLimit(redis, namespace, key, windowMs, max) {
  const redisKey = `cornea:rl:${namespace}:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pExpire(redisKey, windowMs);
  }
  const ttlMs = await redis.pTTL(redisKey);
  const retryAfterSec = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));
  return { allowed: count <= max, retryAfterSec };
}
