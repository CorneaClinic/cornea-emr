import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getFollowup,
  upsertFollowup,
  deleteFollowup,
  listFollowups
} from '../services/followupService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const result = await listFollowups(req.user.clinicId, req.query);
    res.json(result);
  })
);

const visitFollowupRouter = Router({ mergeParams: true });

visitFollowupRouter.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const followup = await getFollowup(req.user.clinicId, req.params.visitId);
    res.json({ data: followup });
  })
);

visitFollowupRouter.put(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const followup = await upsertFollowup(req, req.params.visitId, req.body || {});
    res.json({ data: followup });
  })
);

visitFollowupRouter.delete(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_WRITE),
  asyncHandler(async (req, res) => {
    const result = await deleteFollowup(req, req.params.visitId);
    res.json({ data: result });
  })
);

export { visitFollowupRouter };
export default router;
