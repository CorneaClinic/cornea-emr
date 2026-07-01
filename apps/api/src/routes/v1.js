import { Router } from 'express';
import { auditContextMiddleware } from '../services/auditService.js';
import patientsRouter from './patients.js';
import visitsRouter from './visits.js';
import prescriptionsRouter, { prescriptionByIdRouter } from './prescriptions.js';
import followupsRouter, { visitFollowupRouter } from './followups.js';
import keratoplastyPatientsRouter from './keratoplasty-patients.js';
import kpGraftOutcomesRouter from './kp-graft-outcomes.js';
import keratitisRegistryRouter from './keratitis-registry.js';
import researchAnalyticsRouter from './research-analytics.js';
import fhirExportRouter from './fhir-export.js';
import appointmentsRouter from './appointments.js';
import dicomRouter from './dicom.js';
import dryEyeRegistryRouter from './dry-eye-registry.js';
import orScheduleRouter from './or-schedule.js';
import recordLocksRouter from './record-locks.js';
import ectasiaAiRouter from './ectasia-ai.js';
import eyeBankRouter from './eye-bank.js';
import kcRegistryRouter from './kc-registry.js';
import cornealTissuesRouter from './corneal-tissues.js';
import syncRouter from './sync.js';
import migrationRouter from './migration.js';
import adminUsersRouter from './admin-users.js';
import adminAuditLogsRouter from './admin-audit-logs.js';
import auditLogsRouter from './audit-logs.js';
import mediaRouter from './media.js';
import mediaLibraryRouter from './media-library.js';
import drawingRouter from './drawing.js';
import icdRouter from './icd.js';
import dashboardRouter from './dashboard.js';
import { createEntityMediaRouter } from './entityMedia.js';
import { PERMISSIONS } from '../core/permissions.js';

const router = Router();

router.use(auditContextMiddleware);

router.use('/patients/:patientId/media', createEntityMediaRouter({
  entityType: 'patient',
  idParam: 'patientId',
  readPermission: PERMISSIONS.VISITS_READ,
  writePermission: PERMISSIONS.VISITS_WRITE
}));
router.use('/patients', patientsRouter);
router.use('/visits/:visitId/media', createEntityMediaRouter({
  entityType: 'visit',
  idParam: 'visitId',
  readPermission: PERMISSIONS.VISITS_READ,
  writePermission: PERMISSIONS.VISITS_WRITE
}));
router.use('/visits/:visitId/drawing', drawingRouter);
router.use('/visits/:visitId/prescriptions', prescriptionsRouter);
router.use('/visits/:visitId/followup', visitFollowupRouter);
router.use('/visits', visitsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/prescriptions', prescriptionByIdRouter);
router.use('/followups', followupsRouter);
router.use('/keratoplasty-patients/:id/media', createEntityMediaRouter({
  entityType: 'keratoplasty_patient',
  idParam: 'id',
  readPermission: PERMISSIONS.KP_READ,
  writePermission: PERMISSIONS.KP_WRITE
}));
router.use('/keratoplasty-patients', kpGraftOutcomesRouter);
router.use('/keratoplasty-patients', keratoplastyPatientsRouter);
router.use('/keratitis-registry', keratitisRegistryRouter);
router.use('/research-analytics', researchAnalyticsRouter);
router.use('/fhir-export', fhirExportRouter);
router.use('/appointments', appointmentsRouter);
router.use('/dicom', dicomRouter);
router.use('/dry-eye-registry', dryEyeRegistryRouter);
router.use('/or-schedule', orScheduleRouter);
router.use('/record-locks', recordLocksRouter);
router.use('/ectasia-ai', ectasiaAiRouter);
router.use('/eye-bank', eyeBankRouter);
router.use('/kc-registry', kcRegistryRouter);
router.use('/corneal-tissues/:id/media', createEntityMediaRouter({
  entityType: 'corneal_tissue',
  idParam: 'id',
  readPermission: PERMISSIONS.KP_READ,
  writePermission: PERMISSIONS.KP_WRITE
}));
router.use('/corneal-tissues', cornealTissuesRouter);
router.use('/media-library', mediaLibraryRouter);
router.use('/media', mediaRouter);
router.use('/sync', syncRouter);
router.use('/icd', icdRouter);
router.use('/admin/migration', migrationRouter);
router.use('/admin/users', adminUsersRouter);
router.use('/admin/audit-logs', adminAuditLogsRouter);
router.use('/audit-logs', auditLogsRouter);

export default router;
