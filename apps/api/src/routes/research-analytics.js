import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getResearchDashboard,
  listCohortRows,
  exportCohortCsv,
  getGraftSurvivalSummary
} from '../services/researchAnalyticsService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.RESEARCH_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getResearchDashboard(req.user.clinicId) });
  })
);

router.get(
  '/graft-survival',
  authenticate,
  requirePermission(PERMISSIONS.RESEARCH_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getGraftSurvivalSummary(req.user.clinicId) });
  })
);

router.get(
  '/cohort/:type',
  authenticate,
  requirePermission(PERMISSIONS.RESEARCH_READ),
  asyncHandler(async (req, res) => {
    const data = await listCohortRows(req.user.clinicId, req.params.type, req.query);
    res.json({ data });
  })
);

router.get(
  '/cohort/:type/export.csv',
  authenticate,
  requirePermission(PERMISSIONS.RESEARCH_EXPORT),
  asyncHandler(async (req, res) => {
    const csv = await exportCohortCsv(req.user.clinicId, req.params.type, req.query);
    const filename = `cornea-cohort-${req.params.type}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  })
);

export default router;
