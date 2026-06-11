import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getDrawingForVisit,
  upsertDrawingForVisit,
  deleteDrawingForVisit
} from '../services/drawingService.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const drawing = await getDrawingForVisit(req.user.clinicId, req.params.visitId);
    res.json({ data: drawing });
  })
);

router.put(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const drawing = await upsertDrawingForVisit(req, req.params.visitId, req.body || {});
    res.json({ data: drawing });
  })
);

router.delete(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await deleteDrawingForVisit(req, req.params.visitId);
    res.json({ data: result });
  })
);

export default router;
