import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listAppointmentsByDay,
  getRecallQueue,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment
} from '../services/appointmentService.js';

const router = Router();

router.get(
  '/day/:date',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await listAppointmentsByDay(req.user.clinicId, req.params.date) });
  })
);

router.get(
  '/recall-queue',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getRecallQueue(req.user.clinicId, req.query) });
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getAppointmentById(req.user.clinicId, req.params.id) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createAppointment(req, req.body || {});
    res.status(201).json({ data: row });
  })
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_WRITE),
  asyncHandler(async (req, res) => {
    const row = await updateAppointment(req, req.params.id, req.body || {});
    res.json({ data: row });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.APPOINTMENTS_WRITE),
  asyncHandler(async (req, res) => {
    res.json({ data: await cancelAppointment(req, req.params.id) });
  })
);

export default router;
