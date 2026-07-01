import { Router } from 'express';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requirePermission } from '../core/middleware/authorize.js';
import { PERMISSIONS } from '../core/permissions.js';
import { uploadSingle, handleUploadError } from '../core/middleware/upload.js';
import { ValidationError } from '../core/errors.js';
import { previewDicomUpload, ingestDicomToMedia } from '../services/dicomIngestService.js';

const router = Router();

function requireDicomFile(req) {
  if (!req.file?.buffer?.length) {
    throw new ValidationError('file is required (.dcm DICOM Part 10)');
  }
  return req.file;
}

router.post(
  '/parse',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_READ),
  uploadSingle,
  handleUploadError,
  asyncHandler(async (req, res) => {
    const file = requireDicomFile(req);
    const parsed = previewDicomUpload(file.buffer);
    res.json({
      data: {
        ...parsed,
        originalFilename: file.originalname || 'study.dcm'
      }
    });
  })
);

router.post(
  '/ingest',
  authenticate,
  requirePermission(PERMISSIONS.MEDIA_WRITE),
  uploadSingle,
  handleUploadError,
  asyncHandler(async (req, res) => {
    const file = requireDicomFile(req);
    const { entityType, entityId } = req.body || {};
    if (!entityType || !entityId) {
      throw new ValidationError('entityType and entityId are required');
    }
    const result = await ingestDicomToMedia(req, {
      entityType: String(entityType),
      entityId: String(entityId),
      buffer: file.buffer,
      originalFilename: file.originalname || 'study.dcm',
      category: req.body?.category,
      eye: req.body?.eye,
      label: req.body?.label,
      allowDuplicate: req.body?.allowDuplicate
    });
    res.status(201).json({
      data: {
        asset: result.asset,
        dicom: result.parsed
      }
    });
  })
);

export default router;
