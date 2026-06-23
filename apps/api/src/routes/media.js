import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import {
  getMediaAssetById,
  getMediaAssetContent,
  getMediaAssetSignedUrl,
  deleteMediaAsset,
  updateMediaAssetMetadata,
  archiveMediaAsset,
  restoreMediaAsset
} from '../services/mediaAssetService.js';

const router = Router();

router.get(
  '/:id/signed-url',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  asyncHandler(async (req, res) => {
    const { asset, url } = await getMediaAssetSignedUrl(req.user.clinicId, req.params.id);
    if (url) {
      res.json({ data: { assetId: asset.id, url, mimeType: asset.mimeType } });
    } else {
      res.json({ data: { assetId: asset.id, url: null, useContentEndpoint: true } });
    }
  })
);

router.post(
  '/:id/archive',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const asset = await archiveMediaAsset(req, req.params.id);
    res.json({ data: asset });
  })
);

router.post(
  '/:id/restore',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  asyncHandler(async (req, res) => {
    const asset = await restoreMediaAsset(req, req.params.id);
    res.json({ data: asset });
  })
);

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
    res.setHeader('Cache-Control', 'private, max-age=3600');
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
