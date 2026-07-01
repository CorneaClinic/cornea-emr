import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  FHIR_JSON,
  buildPatientFhirBundle,
  buildCohortFhirBundle
} from '../services/fhirExportService.js';

const router = Router();

function sendFhirBundle(res, bundle, filename) {
  res.setHeader('Content-Type', FHIR_JSON);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(bundle);
}

router.get(
  '/patients/:patientId/bundle',
  authenticate,
  requirePermission(PERMISSIONS.PATIENTS_READ),
  requirePermission(PERMISSIONS.VISITS_READ),
  asyncHandler(async (req, res) => {
    const anonymize = String(req.query.anonymize || '').toLowerCase() === 'true';
    const bundle = await buildPatientFhirBundle(req.user.clinicId, req.params.patientId, {
      limit: req.query.limit,
      anonymize
    });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `cornea-fhir-patient-${req.params.patientId.slice(0, 8)}-${date}.json`;
    sendFhirBundle(res, bundle, filename);
  })
);

router.get(
  '/cohort/:type/bundle',
  authenticate,
  requirePermission(PERMISSIONS.RESEARCH_EXPORT),
  asyncHandler(async (req, res) => {
    const bundle = await buildCohortFhirBundle(req.user.clinicId, req.params.type, {
      ...req.query,
      anonymize: req.query.anonymize ?? 'true'
    });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `cornea-fhir-cohort-${req.params.type}-${date}.json`;
    sendFhirBundle(res, bundle, filename);
  })
);

export default router;
