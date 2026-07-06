#!/usr/bin/env node
/**
 * Review auth/session posture via admin security status API.
 * Usage: node scripts/review-auth-sessions.mjs [--json]
 *
 * Requires SEED_ADMIN_PASSWORD (or STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD).
 */
const API = (process.env.PRODUCTION_API_URL || process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const EMAIL = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local').trim();
const PASSWORD = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';

const jsonOut = process.argv.includes('--json');

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': 'auth-session-review' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.accessToken) throw new Error('Login missing accessToken');
  return body.accessToken;
}

function review(data) {
  const findings = [];
  const { auth, rateLimit } = data;

  if (auth.failedLogins7d > 20) {
    findings.push({
      level: 'warn',
      message: `${auth.failedLogins7d} failed logins in 7 days — review audit_logs`
    });
  }

  if (auth.sessions.expired > 50) {
    findings.push({
      level: 'info',
      message: `${auth.sessions.expired} expired sessions not yet purged — consider cleanup job`
    });
  }

  if (!rateLimit.redisConfigured) {
    findings.push({
      level: 'warn',
      message: 'Redis not configured — rate limits use in-memory store (not suitable for multi-instance)'
    });
  }

  const adminCount = auth.activeUsersByRole.find((r) => r.role === 'admin')?.count || 0;
  if (adminCount > 3) {
    findings.push({
      level: 'warn',
      message: `${adminCount} active admin users — quarterly role review recommended`
    });
  }

  if (auth.exposeRefreshInBody) {
    findings.push({
      level: 'info',
      message: 'AUTH_EXPOSE_REFRESH_IN_BODY=true — refresh token returned in JSON body'
    });
  }

  return findings;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set SEED_ADMIN_PASSWORD or STAGING_E2E_PASSWORD');
    process.exit(1);
  }

  const token = await login();
  const res = await fetch(`${API}/api/v1/admin/security/status`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'auth-session-review' },
    signal: AbortSignal.timeout(25_000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Security status failed (${res.status})`, body);
    process.exit(1);
  }

  const data = body.data;
  const findings = review(data);
  const output = {
    generatedAt: new Date().toISOString(),
    api: API,
    auth: data.auth,
    rateLimit: data.rateLimit,
    findings,
    status: findings.some((f) => f.level === 'warn') ? 'REVIEW' : 'OK'
  };

  if (jsonOut) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\n=== Auth & session review (Project 6) ===\n');
    console.log(`API: ${API}`);
    console.log(`Active sessions: ${data.auth.sessions.active}`);
    console.log(`Revoked: ${data.auth.sessions.revoked} | Expired: ${data.auth.sessions.expired}`);
    console.log(`Failed logins (7d): ${data.auth.failedLogins7d}`);
    console.log(`Redis rate limits: ${data.rateLimit.redisConfigured ? 'yes' : 'no'}`);
    console.log('\nActive users by role:');
    for (const r of data.auth.activeUsersByRole) {
      console.log(`  ${r.role}: ${r.count}`);
    }
    if (findings.length) {
      console.log('\nFindings:');
      for (const f of findings) {
        console.log(`  [${f.level.toUpperCase()}] ${f.message}`);
      }
    } else {
      console.log('\nNo warnings — session posture OK');
    }
    console.log(`\nOverall: ${output.status}\n`);
  }

  process.exit(output.status === 'OK' ? 0 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
