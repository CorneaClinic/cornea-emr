import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getKeratitisOverview,
  listKeratitisCases,
  getKeratitisCaseById,
  createKeratitisCase,
  updateKeratitisCase,
  createCulture,
  createAssessment
} from '../services/keratitisRegistryService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getKeratitisOverview(req.user.clinicId) });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_READ),
  asyncHandler(async (req, res) => {
    res.json(await listKeratitisCases(req.user.clinicId, req.query));
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getKeratitisCaseById(req.user.clinicId, req.params.id) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createKeratitisCase(req, req.body || {});
    res.status(201).json({ data: row });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await updateKeratitisCase(req, req.params.id, req.body || {});
    res.json({ data: row });
  })
);

router.post(
  '/:id/cultures',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createCulture(req, req.params.id, req.body || {});
    res.status(201).json({ data: row });
  })
);

router.post(
  '/:id/assessments',
  authenticate,
  requirePermission(PERMISSIONS.KERATITIS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createAssessment(req, req.params.id, req.body || {});
    res.status(201).json({ data: row });
  })
);

export default router;
