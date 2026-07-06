import { query } from '../db/pool.js';
import { env } from '../config/env.js';
import { isRedisConfigured } from '../core/redis.js';

/**
 * Cloud security posture snapshot for operators (Project 6).
 * @param {string} clinicId
 */
export async function getSecurityStatus(clinicId) {
  const [sessions, failedLogins, usersByRole] = await Promise.all([
    query(
      `
        SELECT
          COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())::int AS active,
          COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked,
          COUNT(*) FILTER (WHERE expires_at <= now() AND revoked_at IS NULL)::int AS expired
        FROM user_sessions
        WHERE clinic_id = $1
      `,
      [clinicId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE clinic_id = $1
          AND action = 'login_failed'
          AND created_at > now() - interval '7 days'
      `,
      [clinicId]
    ),
    query(
      `
        SELECT role, COUNT(*)::int AS count
        FROM users
        WHERE clinic_id = $1 AND is_active = true
        GROUP BY role
        ORDER BY role
      `,
      [clinicId]
    )
  ]);

  const sessionRow = sessions.rows[0] || {};

  return {
    generatedAt: new Date().toISOString(),
    auth: {
      accessExpiresMs: env.auth.accessExpiresMs,
      refreshExpiresMs: env.auth.refreshExpiresMs,
      exposeRefreshInBody: env.auth.exposeRefreshInBody,
      sessions: {
        active: sessionRow.active || 0,
        revoked: sessionRow.revoked || 0,
        expired: sessionRow.expired || 0
      },
      failedLogins7d: failedLogins.rows[0]?.count || 0,
      activeUsersByRole: usersByRole.rows.map((r) => ({ role: r.role, count: r.count }))
    },
    rateLimit: {
      redisConfigured: isRedisConfigured(),
      loginMaxPerIp: env.rateLimit.loginMaxPerIp,
      loginMaxPerEmail: env.rateLimit.loginMaxPerEmail,
      apiMaxPerIp: env.rateLimit.apiMaxPerIp
    },
    cors: {
      originConfigured: Boolean(env.corsOrigin && env.corsOrigin !== '*'),
      productionWildcardBlocked: env.isProduction
    },
    media: {
      storageProvider: env.media.storageProvider,
      allowedMimeCount: env.media.allowedMimeTypes.length,
      virusScanHookConfigured: Boolean(env.media.virusScanHookUrl?.trim()),
      virusScanRequired: env.media.virusScanRequired
    },
    edge: {
      clinicUi: 'https://corneaclinic.visionemr.net/Cornea',
      wafRunbook: 'docs/CLOUDFLARE_WAF_REVIEW.md',
      wafCheckScript: 'npm run check:cloudflare-waf'
    },
    pentest: {
      vendorStatus: 'postponed',
      engagementDoc: 'docs/PENTEST_ENGAGEMENT.md',
      asvsChecklist: 'docs/PENTEST_ASVS_CHECKLIST.md',
      selfCheckScript: 'npm run pentest:self-check'
    }
  };
}
