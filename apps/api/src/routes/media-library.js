import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listMediaLibrary,
  getPatientMediaTimeline
} from '../services/mediaLibraryService.js';
import {
  getMediaAdminStats,
  verifyMediaIntegrity
} from '../services/mediaAdminService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const result = await listMediaLibrary(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/timeline/patient/:patientId',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const result = await getPatientMediaTimeline(req.user.clinicId, req.params.patientId);
    res.json(result);
  })
);

router.get(
  '/admin/stats',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_READ),
  asyncHandler(async (req, res) => {
    const stats = await getMediaAdminStats(req.user.clinicId);
    res.json({ data: stats });
  })
);

router.post(
  '/admin/integrity-check',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_READ),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(String(req.body?.limit || '100'), 10) || 100, 500);
    const result = await verifyMediaIntegrity(req.user.clinicId, limit);
    res.json({ data: result });
  })
);

export default router;
