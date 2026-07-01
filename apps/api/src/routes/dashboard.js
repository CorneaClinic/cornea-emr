import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { getInstituteKpis } from '../services/dashboardService.js';

const router = Router();

router.get(
  '/kpis',
  authenticate,
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getInstituteKpis(req.user.clinicId) });
  })
);

export default router;
