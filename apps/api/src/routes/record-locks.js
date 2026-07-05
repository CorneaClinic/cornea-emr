import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requireAnyPermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  acquireLock,
  renewLock,
  releaseLock,
  getLock,
  listActiveLocks
} from '../services/recordLockService.js';

const router = Router();

const LOCK_READ = [
  PERMISSIONS.VISITS_READ,
  PERMISSIONS.KP_READ,
  PERMISSIONS.KC_READ,
  PERMISSIONS.KERATITIS_READ,
  PERMISSIONS.DRY_EYE_READ
];

const LOCK_WRITE = [
  PERMISSIONS.VISITS_WRITE,
  PERMISSIONS.KP_WRITE,
  PERMISSIONS.KC_WRITE,
  PERMISSIONS.KERATITIS_WRITE,
  PERMISSIONS.DRY_EYE_WRITE
];

router.get(
  '/active',
  authenticate,
  requireAnyPermission(...LOCK_READ),
  asyncHandler(async (req, res) => {
    const data = await listActiveLocks(req.user.clinicId, req.query.entityType);
    res.json({ data });
  })
);

router.get(
  '/:entityType/:entityId',
  authenticate,
  requireAnyPermission(...LOCK_READ),
  asyncHandler(async (req, res) => {
    const data = await getLock(req.user.clinicId, req.params.entityType, req.params.entityId);
    res.json({ data });
  })
);

router.post(
  '/acquire',
  authenticate,
  requireAnyPermission(...LOCK_WRITE),
  asyncHandler(async (req, res) => {
    const data = await acquireLock(req, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/renew',
  authenticate,
  requireAnyPermission(...LOCK_WRITE),
  asyncHandler(async (req, res) => {
    const data = await renewLock(req, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/release',
  authenticate,
  requireAnyPermission(...LOCK_WRITE),
  asyncHandler(async (req, res) => {
    const data = await releaseLock(req, req.body || {});
    res.json({ data });
  })
);

export default router;
