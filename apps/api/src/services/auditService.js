import { query } from '../db/pool.js';
import { getClientIp, getUserAgent } from '../core/auth-crypto.js';
import { logger } from '../core/logger.js';

/**
 * @typedef {object} AuditEventInput
 * @property {string} clinicId
 * @property {string | null | undefined} [userId]
 * @property {string} entityType
 * @property {string} entityId
 * @property {string} action
 * @property {unknown} [diff]
 * @property {import('express').Request} [req]
 * @property {string | null | undefined} [ipAddress]
 * @property {string | null | undefined} [userAgent]
 */

/**
 * Append an immutable audit log entry.
 * @param {AuditEventInput} input
 */
export async function writeAuditLog(input) {
  const {
    clinicId,
    userId = null,
    entityType,
    entityId,
    action,
    diff = null,
    req,
    ipAddress,
    userAgent
  } = input;

  const resolvedIp = ipAddress ?? (req ? getClientIp(req) : null);
  const resolvedUa = userAgent ?? (req ? getUserAgent(req) : null);

  try {
    await query(
      `
        INSERT INTO audit_logs (
          clinic_id,
          user_id,
          entity_type,
          entity_id,
          action,
          diff,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        clinicId,
        userId,
        entityType,
        entityId,
        action,
        diff ?? null,
        resolvedIp,
        resolvedUa
      ]
    );
  } catch (err) {
    logger.error({ err, clinicId, entityType, action }, 'Failed to write audit log');
  }
}

/**
 * Convenience helper for authentication events.
 * @param {object} input
 * @param {import('express').Request} input.req
 * @param {string | null | undefined} input.userId
 * @param {string | null | undefined} input.clinicId
 * @param {string} input.action
 * @param {unknown} [input.diff]
 */
export async function auditAuthEvent({ req, userId, clinicId, action, diff }) {
  if (!clinicId) {
    logger.warn({ action, userId }, 'Skipping auth audit — clinicId unknown');
    return;
  }

  await writeAuditLog({
    clinicId,
    userId,
    entityType: 'auth',
    entityId: userId || 'anonymous',
    action,
    diff,
    req
  });
}

/**
 * Factory for route-level audit hooks (use after successful mutations).
 * @param {string} action
 * @param {string} entityType
 * @param {(req: import('express').Request, res: import('express').Response) => { entityId: string, diff?: unknown } | null} getDetails
 */
export function createAuditHook(action, entityType, getDetails) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      if (!req.user?.clinicId) return;

      const details = getDetails(req, res);
      if (!details) return;

      writeAuditLog({
        clinicId: req.user.clinicId,
        userId: req.user.sub,
        entityType,
        entityId: details.entityId,
        action,
        diff: details.diff,
        req
      }).catch(() => {});
    });

    next();
  };
}

/**
 * Log a clinical mutation from route handlers / services.
 * @param {import('express').Request} req
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} action
 * @param {unknown} [diff]
 */
export async function auditMutation(req, entityType, entityId, action, diff) {
  if (req?.audit?.log) {
    await req.audit.log({ entityType, entityId, action, diff });
    return;
  }
  if (!req?.user?.clinicId) return;

  await writeAuditLog({
    clinicId: req.user.clinicId,
    userId: req.user.sub,
    entityType,
    entityId,
    action,
    diff,
    req
  });
}

/**
 * Express middleware that attaches audit helpers to the request.
 */
export function auditContextMiddleware(req, _res, next) {
  req.audit = {
    /**
     * @param {Omit<AuditEventInput, 'req' | 'clinicId' | 'userId'> & { clinicId?: string, userId?: string }} event
     */
    log: (event) =>
      writeAuditLog({
        clinicId: event.clinicId ?? req.user?.clinicId,
        userId: event.userId ?? req.user?.sub ?? null,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        diff: event.diff,
        req
      })
  };
  next();
}
