import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getGraftOutcomesOverview,
  listGraftExams,
  createGraftExam,
  listRejections,
  createRejection,
  getGraftTimeline
} from '../services/kpGraftOutcomesService.js';

const router = Router({ mergeParams: true });

router.get(
  '/graft-outcomes/overview',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getGraftOutcomesOverview(req.user.clinicId) });
  })
);

router.get(
  '/:id/graft-exams',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json(await listGraftExams(req.user.clinicId, req.params.id));
  })
);

router.post(
  '/:id/graft-exams',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const exam = await createGraftExam(req, req.params.id, req.body || {});
    res.status(201).json({ data: exam });
  })
);

router.get(
  '/:id/rejections',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json(await listRejections(req.user.clinicId, req.params.id));
  })
);

router.post(
  '/:id/rejections',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const episode = await createRejection(req, req.params.id, req.body || {});
    res.status(201).json({ data: episode });
  })
);

router.get(
  '/:id/graft-timeline',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getGraftTimeline(req.user.clinicId, req.params.id) });
  })
);

export default router;
