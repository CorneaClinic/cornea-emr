import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  deletePrescription,
  replacePrescriptions
} from '../services/prescriptionService.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const result = await listPrescriptions(req.user.clinicId, req.params.visitId);
    res.json(result);
  })
);

router.put(
  '/bulk',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await replacePrescriptions(
      req,
      req.params.visitId,
      req.body?.items ?? req.body ?? []
    );
    res.json(result);
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const prescription = await createPrescription(req, req.params.visitId, req.body || {});
    res.status(201).json({ data: prescription });
  })
);

const byIdRouter = Router();

byIdRouter.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const prescription = await getPrescriptionById(req.user.clinicId, req.params.id);
    res.json({ data: prescription });
  })
);

byIdRouter.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const prescription = await updatePrescription(req, req.params.id, req.body || {});
    res.json({ data: prescription });
  })
);

byIdRouter.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await deletePrescription(req, req.params.id);
    res.json({ data: result });
  })
);

export { byIdRouter as prescriptionByIdRouter };
export default router;
