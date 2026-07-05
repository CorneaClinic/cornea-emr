import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { getDrStatus } from '../services/drStatusService.js';

const router = Router();

/** GET /api/v1/admin/dr/status — media + cloud DR posture (admin) */
router.get(
  '/status',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getDrStatus(req.user.clinicId) });
  })
);

export default router;
