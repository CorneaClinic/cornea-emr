import { Router } from 'express';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { auditContextMiddleware } from '../services/auditService.js';
import {
  getIcdStatus,
  searchIcdForClinic,
  saveIcdCredentials,
  deleteIcdCredentials
} from '../services/icdService.js';

const router = Router();

router.use(auditContextMiddleware);
router.use(authenticate);

/** GET /api/v1/icd/status */
router.get('/status', requirePermission(PERMISSIONS.VISITS_READ), async (req, res, next) => {
  try {
    const status = await getIcdStatus(req.user.clinicId);
    res.json({ data: status });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/icd/search?q= */
router.get('/search', requirePermission(PERMISSIONS.VISITS_READ), async (req, res, next) => {
  try {
    const data = await searchIcdForClinic(req.user.clinicId, req.query.q);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/v1/icd/credentials */
router.put('/credentials', requirePermission(PERMISSIONS.ICD_MANAGE), async (req, res, next) => {
  try {
    const { clientId, clientSecret } = req.body || {};
    const result = await saveIcdCredentials(req.user.clinicId, clientId, clientSecret);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/icd/credentials */
router.delete('/credentials', requirePermission(PERMISSIONS.ICD_MANAGE), async (req, res, next) => {
  try {
    const result = await deleteIcdCredentials(req.user.clinicId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
