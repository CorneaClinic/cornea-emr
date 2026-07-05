import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getDryEyeOverview,
  listDryEyeCases,
  getDryEyeCaseById,
  createDryEyeCase,
  updateDryEyeCase,
  createDryEyeAssessment
} from '../services/dryEyeRegistryService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getDryEyeOverview(req.user.clinicId) });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_READ),
  asyncHandler(async (req, res) => {
    res.json(await listDryEyeCases(req.user.clinicId, req.query));
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getDryEyeCaseById(req.user.clinicId, req.params.id) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createDryEyeCase(req, req.body || {});
    res.status(201).json({ data: row });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_WRITE),
  asyncHandler(async (req, res) => {
    const row = await updateDryEyeCase(req, req.params.id, req.body || {});
    res.json({ data: row });
  })
);

router.post(
  '/:id/assessments',
  authenticate,
  requirePermission(PERMISSIONS.DRY_EYE_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createDryEyeAssessment(req, req.params.id, req.body || {});
    res.status(201).json({ data: row });
  })
);

export default router;
