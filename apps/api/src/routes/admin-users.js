import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  listClinicUsers,
  getClinicUser,
  createClinicUser,
  updateClinicUser,
  getSectionCatalog
} from '../services/userService.js';

const router = Router();

router.use(authenticate, requirePermission(PERMISSIONS.USERS_MANAGE));

/** GET /api/v1/admin/users/sections — section + role defaults catalog */
router.get(
  '/sections',
  asyncHandler(async (_req, res) => {
    res.json(getSectionCatalog());
  })
);

/** GET /api/v1/admin/users */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listClinicUsers(req.user.clinicId));
  })
);

/** GET /api/v1/admin/users/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ user: await getClinicUser(req.user.clinicId, req.params.id) });
  })
);

/** POST /api/v1/admin/users */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { email, fullName, role, password, emrSections } = req.body || {};
    const result = await createClinicUser({
      clinicId: req.user.clinicId,
      email,
      fullName,
      role,
      password,
      emrSections
    });
    res.status(201).json(result);
  })
);

/** PATCH /api/v1/admin/users/:id */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { fullName, role, isActive, emrSections, resetEmrSections } = req.body || {};
    const result = await updateClinicUser({
      clinicId: req.user.clinicId,
      userId: req.params.id,
      actorUserId: req.user.sub,
      patch: { fullName, role, isActive, emrSections, resetEmrSections }
    });
    res.json(result);
  })
);

export default router;
