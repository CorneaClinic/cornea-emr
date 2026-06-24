import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requireAnyPermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  analyzeWithRegistry,
  getRegistryInsights,
  validateAnalyzeBody
} from '../services/ectasiaAiService.js';

const router = Router();

router.get(
  '/registry-insights',
  authenticate,
  requireAnyPermission(PERMISSIONS.KC_READ, PERMISSIONS.VISITS_READ, PERMISSIONS.RESEARCH_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getRegistryInsights(req.user.clinicId) });
  })
);

router.post(
  '/analyze',
  authenticate,
  requireAnyPermission(PERMISSIONS.KC_READ, PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const body = validateAnalyzeBody(req.body);
    res.json({ data: await analyzeWithRegistry(req.user.clinicId, body) });
  })
);

export default router;
