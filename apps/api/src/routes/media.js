import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getMediaAssetById,
  getMediaAssetContent,
  deleteMediaAsset,
  updateMediaAssetMetadata
} from '../services/mediaAssetService.js';

const router = Router();

router.get(
  '/:id/content',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const { asset, buffer } = await getMediaAssetContent(req.user.clinicId, req.params.id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.originalFilename)}"`);
    res.setHeader('ETag', `"${asset.checksum}"`);
    res.send(buffer);
  })
);

router.get(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const asset = await getMediaAssetById(req.user.clinicId, req.params.id);
    res.json({ data: asset });
  })
);

router.patch(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const asset = await updateMediaAssetMetadata(req, req.params.id, req.body || {});
    res.json({ data: asset });
  })
);

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const result = await deleteMediaAsset(req, req.params.id);
    res.json({ data: result });
  })
);

export default router;
