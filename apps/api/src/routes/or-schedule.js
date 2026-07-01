import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listOrCasesByDay,
  getOrCaseById,
  createOrCase,
  updateOrCase,
  PROCEDURE_TYPES
} from '../services/orScheduleService.js';

const router = Router();

router.get(
  '/procedure-types',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (_req, res) => {
    res.json({ data: PROCEDURE_TYPES });
  })
);

router.get(
  '/day/:date',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (req, res) => {
    const data = await listOrCasesByDay(req.user.clinicId, req.params.date);
    res.json({ data });
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getOrCaseById(req.user.clinicId, req.params.id) });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const row = await createOrCase(req, req.body || {});
    res.status(201).json({ data: row });
  })
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const row = await updateOrCase(req, req.params.id, req.body || {});
    res.json({ data: row });
  })
);

export default router;
