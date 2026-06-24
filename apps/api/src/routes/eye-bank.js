import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getEyeBankOverview,
  listCustodyEvents,
  addCustodyEvent,
  listColdChainEvents,
  addColdChainEvent,
  getTraceabilityPacket,
  exportTraceabilityCsv,
  updateQuarantine
} from '../services/eyeBankTraceabilityService.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({ data: await getEyeBankOverview(req.user.clinicId) });
  })
);

router.get(
  '/tissues/:tissueId/traceability',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({
      data: await getTraceabilityPacket(req.user.clinicId, req.params.tissueId)
    });
  })
);

router.get(
  '/tissues/:tissueId/traceability/export.csv',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    const csv = await exportTraceabilityCsv(req.user.clinicId, req.params.tissueId);
    const tissueId = req.params.tissueId.slice(0, 8);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eye-bank-trace-${tissueId}.csv"`);
    res.send(csv);
  })
);

router.get(
  '/tissues/:tissueId/custody-events',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({
      data: await listCustodyEvents(req.user.clinicId, req.params.tissueId)
    });
  })
);

router.post(
  '/tissues/:tissueId/custody-events',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await addCustodyEvent(req, req.params.tissueId, req.body || {});
    res.status(201).json({ data });
  })
);

router.get(
  '/tissues/:tissueId/cold-chain-events',
  authenticate,
  requirePermission(PERMISSIONS.KP_READ),
  asyncHandler(async (req, res) => {
    res.json({
      data: await listColdChainEvents(req.user.clinicId, req.params.tissueId)
    });
  })
);

router.post(
  '/tissues/:tissueId/cold-chain-events',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await addColdChainEvent(req, req.params.tissueId, req.body || {});
    res.status(201).json({ data });
  })
);

router.patch(
  '/tissues/:tissueId/quarantine',
  authenticate,
  requirePermission(PERMISSIONS.KP_WRITE),
  asyncHandler(async (req, res) => {
    const data = await updateQuarantine(req, req.params.tissueId, req.body || {});
    res.json({ data });
  })
);

export default router;
