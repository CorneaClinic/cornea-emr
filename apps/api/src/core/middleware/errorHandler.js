import { AppError } from '../errors.js';
import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  const requestId = req.id;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ err: { code: err.code, details: err.details }, requestId }, err.message);
    }

    if (err.retryAfter) {
      res.setHeader('Retry-After', String(err.retryAfter));
    }

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
        requestId
      }
    });
  }

  logger.error({ err, requestId }, 'Unhandled error');

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId
    }
  });
}
