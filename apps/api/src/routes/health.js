import { Router } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseConnection } from '../db/pool.js';
import { isRedisConfigured, getRedis } from '../core/redis.js';

const router = Router();

async function checkRedisConnection() {
  if (!isRedisConfigured()) {
    return {
      ok: false,
      configured: false,
      mode: 'memory',
      message: 'REDIS_URL not set — in-memory rate limits only'
    };
  }
  try {
    const redis = await getRedis();
    if (!redis?.isOpen) {
      return {
        ok: false,
        configured: true,
        mode: 'memory',
        message: 'Redis configured but not connected'
      };
    }
    await redis.ping();
    return { ok: true, configured: true, mode: 'redis' };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      mode: 'fallback',
      message: err?.message || 'Redis ping failed'
    };
  }
}

/** Liveness — process is running (no dependency checks). */
router.get('/live', (_req, res) => {
  res.status(200).json({
    ok: true,
    status: 'live',
    service: 'cornea-emr-api',
    version: env.apiVersion,
    timestamp: new Date().toISOString()
  });
});

/** Readiness — includes database connectivity. */
router.get('/ready', async (_req, res) => {
  const db = await checkDatabaseConnection();
  const redis = await checkRedisConnection();
  const ok = db.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    status: ok ? 'ready' : 'degraded',
    service: 'cornea-emr-api',
    version: env.apiVersion,
    checks: {
      database: db,
      redis: redis
    },
    timestamp: new Date().toISOString()
  });
});

/** Default health — alias for readiness. */
router.get('/', async (_req, res) => {
  const db = await checkDatabaseConnection();
  const redis = await checkRedisConnection();
  const ok = db.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    service: 'cornea-emr-api',
    version: env.apiVersion,
    environment: env.nodeEnv,
    checks: {
      database: db,
      redis: redis
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
