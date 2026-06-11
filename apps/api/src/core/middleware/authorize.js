import { UnauthorizedError, ForbiddenError } from '../errors.js';
import {
  roleHasPermission,
  roleMatches
} from '../permissions.js';

/**
 * Require one of the given roles.
 * @param {...import('../permissions.js').Role} roles
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roleMatches(req.user.role, ...roles)) {
      return next(new ForbiddenError('Insufficient permissions for this role'));
    }
    next();
  };
}

/**
 * Require a specific permission (RBAC matrix).
 * @param {string} permission
 */
export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    if (!roleHasPermission(req.user.role, permission)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

/**
 * Require any one of the given permissions.
 * @param {...string} permissions
 */
export function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    const allowed = permissions.some((p) => roleHasPermission(req.user.role, p));
    if (!allowed) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

/**
 * Ensure route params/body clinicId matches the authenticated user's clinic.
 * @param {(req: import('express').Request) => string | undefined} getClinicId
 */
export function requireSameClinic(getClinicId) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    const requestedClinicId = getClinicId(req);
    if (requestedClinicId && requestedClinicId !== req.user.clinicId) {
      return next(new ForbiddenError('Cross-clinic access denied'));
    }
    next();
  };
}
