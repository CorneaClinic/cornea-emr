import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listPatients,
  getPatientById,
  getPatientByMrn,
  createPatient,
  updatePatient,
  listPatientVisits,
  nextMrn
} from '../services/patientService.js';
import {
  findDuplicatePatients,
  mergePatients
} from '../services/duplicatePatientService.js';

const router = Router();

router.post(
  '/duplicates/check',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  asyncHandler(async (req, res) => {
    const result = await findDuplicatePatients(req.user.clinicId, req.body || {});
    res.json({ data: result });
  })
);

router.post(
  '/merge',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_WRITE),
  asyncHandler(async (req, res) => {
    const { targetPatientId, sourcePatientId } = req.body || {};
    const patient = await mergePatients(req, targetPatientId, sourcePatientId, req.body || {});
    res.json({ data: patient });
  })
);

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  asyncHandler(async (req, res) => {
    const result = await listPatients(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/next-mrn',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  asyncHandler(async (req, res) => {
    const mrn = await nextMrn(req.user.clinicId);
    res.json({ data: { mrn } });
  })
);

router.get(
  '/by-mrn/:mrn',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  asyncHandler(async (req, res) => {
    const patient = await getPatientByMrn(req.user.clinicId, req.params.mrn);
    res.json({ data: patient });
  })
);

router.get(
  '/:id/visits',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const result = await listPatientVisits(req.user.clinicId, req.params.id, req.query);
    res.json(result);
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  asyncHandler(async (req, res) => {
    const patient = await getPatientById(req.user.clinicId, req.params.id);
    res.json({ data: patient });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await createPatient(req, req.body || {});
    res.status(201).json({ data: patient });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_WRITE),
  asyncHandler(async (req, res) => {
    const patient = await updatePatient(req, req.params.id, req.body || {});
    res.json({ data: patient });
  })
);

export default router;
