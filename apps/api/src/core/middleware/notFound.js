import { NotFoundError } from '../errors.js';

export function notFoundHandler(_req, _res, next) {
  next(new NotFoundError('Route not found'));
}
