import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission, requireAnyPermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  pushMutations,
  pullChanges,
  getSyncStatus,
  listSyncLogs,
  resolveConflict
} from '../services/syncService.js';

const router = Router();

router.post(
  '/push',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_WRITE, PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const result = await pushMutations(req, req.body || {});
    res.json({ data: result });
  })
);

router.get(
  '/pull',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_READ, PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const result = await pullChanges(req, req.query);
    res.json({ data: result });
  })
);

router.get(
  '/status',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const deviceId = String(req.query.deviceId || req.headers['x-device-id'] || 'unknown');
    const status = await getSyncStatus(req.user.clinicId, req.user.sub, deviceId);
    res.json({ data: status });
  })
);

router.get(
  '/logs',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_READ),
  asyncHandler(async (req, res) => {
    const logs = await listSyncLogs(req.user.clinicId, req.query);
    res.json(logs);
  })
);

router.post(
  '/resolve-conflict',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await resolveConflict(req, req.body || {});
    res.json({ data: result });
  })
);

export default router;
