import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission, requireAnyPermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listVisits,
  getVisitById,
  getVisitByLegacyId,
  listVisitsByMrn,
  getVisitStats,
  createVisit,
  updateVisit,
  finalizeVisit,
  cancelVisit
} from '../services/visitService.js';

const router = Router();

router.get(
  '/stats',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const stats = await getVisitStats(req.user.clinicId);
    res.json({ data: stats });
  })
);

router.get(
  '/by-mrn/:mrn',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const result = await listVisitsByMrn(req.user.clinicId, req.params.mrn);
    res.json(result);
  })
);

router.get(
  '/legacy/:localId',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const visit = await getVisitByLegacyId(
      req.user.clinicId,
      Number.parseInt(req.params.localId, 10)
    );
    res.json({ data: visit });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const result = await listVisits(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const visit = await getVisitById(req.user.clinicId, req.params.id);
    res.json({ data: visit });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const visit = await createVisit(req, req.body || {});
    res.status(201).json({ data: visit });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const visit = await updateVisit(req, req.params.id, req.body || {});
    res.json({ data: visit });
  })
);

router.patch(
  '/:id/finalize',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_FINALIZE),
  asyncHandler(async (req, res) => {
    const visit = await finalizeVisit(req, req.params.id);
    res.json({ data: visit });
  })
);

router.patch(
  '/:id/cancel',
  authenticate,
  requireAnyPermission(PERMISSIONS.VISITS_DELETE, PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await cancelVisit(req, req.params.id);
    res.json({ data: result });
  })
);

export default router;
