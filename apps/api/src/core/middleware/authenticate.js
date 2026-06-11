import { verifyAccessToken, extractBearerToken } from '../auth-crypto.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import { isValidRole } from '../permissions.js';
import { query } from '../../db/pool.js';

/**
 * Verify JWT access token and attach user context to the request.
 */
export async function authenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = verifyAccessToken(token);

    if (!payload.sub || !payload.clinicId || !isValidRole(payload.role)) {
      throw new UnauthorizedError('Invalid access token');
    }

    const { rows } = await query(
      `
        SELECT u.id, u.is_active, c.status AS clinic_status
          FROM users u
          JOIN clinics c ON c.id = u.clinic_id
         WHERE u.id = $1
           AND u.clinic_id = $2
         LIMIT 1
      `,
      [payload.sub, payload.clinicId]
    );

    const account = rows[0];
    if (!account?.is_active) {
      throw new UnauthorizedError('Account is inactive');
    }
    if (account.clinic_status !== 'active') {
      throw new ForbiddenError('Clinic account is suspended');
    }

    if (payload.sessionFamilyId) {
      const { rows: sessionRows } = await query(
        `
          SELECT id
            FROM user_sessions
           WHERE family_id = $1
             AND revoked_at IS NULL
             AND expires_at > now()
           LIMIT 1
        `,
        [payload.sessionFamilyId]
      );
      if (!sessionRows.length) {
        throw new UnauthorizedError('Session expired');
      }
    }

    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      clinicId: payload.clinicId,
      sessionFamilyId: payload.sessionFamilyId
    };

    next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      return next(err);
    }
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Optional authentication — attaches req.user when a valid token is present.
 */
export async function authenticateOptional(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return next();
  }
  return authenticate(req, _res, next);
}
