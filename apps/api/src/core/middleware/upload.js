import multer from 'multer';
import { env } from '../../config/env.js';
import { ValidationError } from '../errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.media.maxFileBytes, files: 1 }
});

/**
 * Express middleware — single file upload field named "file".
 */
export const uploadSingle = upload.single('file');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function handleUploadError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ValidationError(`File exceeds maximum size of ${env.media.maxFileBytes} bytes`));
    }
    return next(new ValidationError(err.message));
  }
  return next(err);
}

/**
 * @param {import('express').Request} req
 */
export function parseUploadFields(req) {
  const category = req.body?.category;
  if (!category) {
    throw new ValidationError('category is required');
  }
  if (!req.file) {
    throw new ValidationError('file is required');
  }

  return {
    category: String(category).trim(),
    eye: req.body?.eye,
    label: req.body?.label,
    sortOrder: req.body?.sortOrder,
    metadata: req.body?.metadata ? safeParseJson(req.body.metadata, 'metadata') : undefined,
    buffer: req.file.buffer,
    originalFilename: req.file.originalname || 'upload',
    mimeType: req.file.mimetype
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 */
function safeParseJson(value, field) {
  if (typeof value === 'object' && value !== null) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new ValidationError(`${field} must be valid JSON`);
  }
}
