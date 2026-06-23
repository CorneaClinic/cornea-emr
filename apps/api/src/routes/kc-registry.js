import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getKcRegistryOverview,
  listKcPatients,
  getKcPatientById,
  createKcPatient,
  updateKcPatient,
  deleteKcPatient,
  listTopographyForPatient,
  createTopographyReading,
  updateTopographyReading,
  deleteTopographyReading,
  listCxlForPatient,
  createCxlProcedure,
  updateCxlProcedure,
  deleteCxlProcedure,
  getKcPatientTimeline
} from '../services/kcRegistryService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getKcRegistryOverview(req.user.clinicId) });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    res.json(await listKcPatients(req.user.clinicId, req.query));
  })
);

router.get(
  '/:id/timeline',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    const timeline = await getKcPatientTimeline(req.user.clinicId, req.params.id);
    res.json({ data: timeline });
  })
);

router.get(
  '/:id/topography',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    const result = await listTopographyForPatient(req.user.clinicId, req.params.id, req.query);
    res.json(result);
  })
);

router.post(
  '/:id/topography',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const reading = await createTopographyReading(req, req.params.id, req.body || {});
    res.status(201).json({ data: reading });
  })
);

router.put(
  '/:id/topography/:readingId',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const reading = await updateTopographyReading(req, req.params.id, req.params.readingId, req.body || {});
    res.json({ data: reading });
  })
);

router.delete(
  '/:id/topography/:readingId',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteTopographyReading(req, req.params.id, req.params.readingId) });
  })
);

router.get(
  '/:id/cxl',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    const result = await listCxlForPatient(req.user.clinicId, req.params.id, req.query);
    res.json(result);
  })
);

router.post(
  '/:id/cxl',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const proc = await createCxlProcedure(req, req.params.id, req.body || {});
    res.status(201).json({ data: proc });
  })
);

router.put(
  '/:id/cxl/:cxlId',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const proc = await updateCxlProcedure(req, req.params.id, req.params.cxlId, req.body || {});
    res.json({ data: proc });
  })
);

router.delete(
  '/:id/cxl/:cxlId',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteCxlProcedure(req, req.params.id, req.params.cxlId) });
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KC_READ),
  asyncHandler(async (req, res) => {
    const patient = await getKcPatientById(req.user.clinicId, req.params.id);
    res.json({ data: patient });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await createKcPatient(req, req.body || {});
    res.status(201).json({ data: patient });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await updateKcPatient(req, req.params.id, req.body || {});
    res.json({ data: patient });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KC_WRITE),
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteKcPatient(req, req.params.id) });
  })
);

export default router;
