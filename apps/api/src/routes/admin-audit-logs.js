import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { listClinicAuditLogs } from '../services/auditLogService.js';

const router = Router();

router.use(authenticate, requirePermission(PERMISSIONS.AUDIT_READ));

/** GET /api/v1/admin/audit-logs */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listClinicAuditLogs(req.user.clinicId, req.query));
  })
);

export default router;
