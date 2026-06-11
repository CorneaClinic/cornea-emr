import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listCornealTissues,
  getCornealTissueById,
  createCornealTissue,
  updateCornealTissue,
  reserveCornealTissue,
  releaseCornealTissue
} from '../services/cornealTissueService.js';

const router = Router();

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const result = await listCornealTissues(req.user.clinicId, req.query);
    res.json(result);
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const tissue = await getCornealTissueById(req.user.clinicId, req.params.id);
    res.json({ data: tissue });
  })
);

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const tissue = await createCornealTissue(req, req.body || {});
    res.status(201).json({ data: tissue });
  })
);

router.put(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const tissue = await updateCornealTissue(req, req.params.id, req.body || {});
    res.json({ data: tissue });
  })
);

router.post(
  '/:id/reserve',
  authenticate,
  requirePermission(PERMISSIONS.KP_RESERVE),
  asyncHandler(async (req, res) => {
    const result = await reserveCornealTissue(req, req.params.id, req.body || {});
    res.json({ data: result });
  })
);

router.post(
  '/:id/release',
  authenticate,
  requirePermission(PERMISSIONS.KP_RESERVE),
  asyncHandler(async (req, res) => {
    const result = await releaseCornealTissue(req, req.params.id);
    res.json({ data: result });
  })
);

export default router;
