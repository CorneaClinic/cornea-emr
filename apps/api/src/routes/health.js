import { Router } from 'express';
import { env } from '../config/env.js';
import { checkDatabaseConnection } from '../db/pool.js';

const router = Router();

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
  const ok = db.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    status: ok ? 'ready' : 'degraded',
    service: 'cornea-emr-api',
    version: env.apiVersion,
    checks: {
      database: db
    },
    timestamp: new Date().toISOString()
  });
});

/** Default health — alias for readiness. */
router.get('/', async (_req, res) => {
  const db = await checkDatabaseConnection();
  const ok = db.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    service: 'cornea-emr-api',
    version: env.apiVersion,
    environment: env.nodeEnv,
    checks: {
      database: db
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
