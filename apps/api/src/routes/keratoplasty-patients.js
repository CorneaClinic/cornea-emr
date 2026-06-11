import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getKeratoplastyOverview,
  listKeratoplastyPatients,
  getKeratoplastyPatientById,
  createKeratoplastyPatient,
  updateKeratoplastyPatient,
  deleteKeratoplastyPatient
} from '../services/keratoplastyPatientService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const overview = await getKeratoplastyOverview(req.user.clinicId);
    res.json({ data: overview });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const result = await listKeratoplastyPatients(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const patient = await getKeratoplastyPatientById(req.user.clinicId, req.params.id);
    res.json({ data: patient });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await createKeratoplastyPatient(req, req.body || {});
    res.status(201).json({ data: patient });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await updateKeratoplastyPatient(req, req.params.id, req.body || {});
    res.json({ data: patient });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const result = await deleteKeratoplastyPatient(req, req.params.id);
    res.json({ data: result });
  })
);

export default router;
