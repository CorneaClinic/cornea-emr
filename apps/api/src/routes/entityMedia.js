import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { uploadSingle, handleUploadError, parseUploadFields } from '../core/middleware/upload.js';
import {
  listMediaForEntity,
  uploadMediaForEntity
} from '../services/mediaAssetService.js';

/**
 * @param {object} config
 * @param {string} config.entityType
 * @param {string} config.idParam
 * @param {string} config.readPermission
 * @param {string} config.writePermission
 */
export function createEntityMediaRouter(config) {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    authenticate,
    requirePermission(config.readPermission),
    asyncHandler(async (req, res) => {
      const result = await listMediaForEntity(
        req.user.clinicId,
        config.entityType,
        req.params[config.idParam],
        req.query
      );
      res.json(result);
    })
  );

  router.post(
    '/',
    authenticate,
    requirePermission(config.writePermission),
    uploadSingle,
    handleUploadError,
    asyncHandler(async (req, res) => {
      const fields = parseUploadFields(req);
      const asset = await uploadMediaForEntity(req, {
        entityType: config.entityType,
        entityId: req.params[config.idParam],
        ...fields
      });
      res.status(201).json({ data: asset });
    })
  );

  return router;
}

export default createEntityMediaRouter;
