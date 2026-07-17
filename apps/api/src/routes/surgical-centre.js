import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  advanceSurgicalEpisodeStage,
  applySafetyOverride,
  createSurgicalEpisode,
  getSurgicalCentreDashboard,
  getSurgicalEpisodeById,
  getSurgicalWorkflowMeta,
  listSurgicalEpisodes,
  savePreopAssessment,
  saveSafetyChecklist,
  scheduleEpisodeOt,
  updateSurgicalEpisode
} from '../services/surgicalEpisodeService.js';

const router = Router();

router.get(
  '/workflow',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (_req, res) => {
    res.json({ data: getSurgicalWorkflowMeta() });
  })
);

router.get(
  '/dashboard',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (req, res) => {
    const data = await getSurgicalCentreDashboard(req.user.clinicId, req.query.date);
    res.json({ data });
  })
);

router.get(
  '/episodes',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (req, res) => {
    const data = await listSurgicalEpisodes(req.user.clinicId, req.query || {});
    res.json({ data });
  })
);

router.get(
  '/episodes/:id',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_READ),
  asyncHandler(async (req, res) => {
    const data = await getSurgicalEpisodeById(req.user.clinicId, req.params.id);
    res.json({ data });
  })
);

router.post(
  '/episodes',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await createSurgicalEpisode(req, req.body || {});
    res.status(201).json({ data });
  })
);

router.patch(
  '/episodes/:id',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await updateSurgicalEpisode(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/episodes/:id/advance',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await advanceSurgicalEpisodeStage(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/episodes/:id/preop',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await savePreopAssessment(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/episodes/:id/safety-checklist',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await saveSafetyChecklist(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/episodes/:id/safety-override',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await applySafetyOverride(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

router.post(
  '/episodes/:id/schedule-ot',
  authenticate,
  requirePermission(PERMISSIONS.OR_SCHEDULE_WRITE),
  asyncHandler(async (req, res) => {
    const data = await scheduleEpisodeOt(req, req.params.id, req.body || {});
    res.json({ data });
  })
);

export default router;
