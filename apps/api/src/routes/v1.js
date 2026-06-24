import { Router } from 'express';
import { auditContextMiddleware } from '../services/auditService.js';
import patientsRouter from './patients.js';
import visitsRouter from './visits.js';
import prescriptionsRouter, { prescriptionByIdRouter } from './prescriptions.js';
import followupsRouter, { visitFollowupRouter } from './followups.js';
import keratoplastyPatientsRouter from './keratoplasty-patients.js';
import kpGraftOutcomesRouter from './kp-graft-outcomes.js';
import keratitisRegistryRouter from './keratitis-registry.js';
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
