import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { getSecurityStatus } from '../services/securityStatusService.js';

const router = Router();

/** GET /api/v1/admin/security/status — auth, rate limits, upload scan posture */
router.get(
  '/status',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getSecurityStatus(req.user.clinicId) });
  })
);

export default router;
