import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission, requireAnyPermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  acquireLock,
  renewLock,
  releaseLock,
  getLock,
  listActiveLocks
} from '../services/recordLockService.js';

const router = Router();

router.get(
  '/active',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const data = await listActiveLocks(req.user.clinicId, req.query.entityType);
    res.json({ data });
  })
);

router.get(
  '/:entityType/:entityId',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const data = await getLock(req.user.clinicId, req.params.entityType, req.params.entityId);
    res.json({ data });
  })
);

router.post(
  '/acquire',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_WRITE, PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await acquireLock(req, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/renew',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_WRITE, PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await renewLock(req, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/release',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_WRITE, PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await releaseLock(req, req.body || {});
    res.json({ data });
  })
);

export default router;
