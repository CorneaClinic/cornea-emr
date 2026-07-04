import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listTeachingCases,
  getTeachingCase,
  upsertTeachingCaseMetadata,
  exportTeachingCase,
  publishAnonymizedTeachingCase
} from '../services/teachingCaseService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const result = await listTeachingCases(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/:id/export',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const data = await exportTeachingCase(req, req.params.id);
    res.json({ data });
  })
);

router.post(
  '/:id/publish',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const result = await publishAnonymizedTeachingCase(req, req.params.id);
    res.json({ data: result });
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const data = await getTeachingCase(req, req.params.id);
    res.json({ data });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const data = await upsertTeachingCaseMetadata(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

export default router;
