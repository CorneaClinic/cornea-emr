#!/usr/bin/env node
/**
 * Verify STAGING_E2E_* credentials against the live API (no browser).
 * Usage: STAGING_E2E_EMAIL=... STAGING_E2E_PASSWORD=... node scripts/staging-api-login-check.mjs
 */
const email = (process.env.STAGING_E2E_EMAIL || '').trim();
const password = process.env.STAGING_E2E_PASSWORD || '';
const apiUrl = (process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);

async function main() {
  if (!email || !password) {
    console.error('Set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD');
    process.exit(1);
  }

  const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'staging-login-check'
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!loginRes.ok) {
    const detail = await loginRes.text();
    console.error(`Login failed (${loginRes.status}): ${detail}`);
    process.exit(1);
  }

  const { accessToken } = await loginRes.json();
  if (!accessToken) {
    console.error('Login response missing accessToken');
    process.exit(1);
  }

  const kpiRes = await fetch(`${apiUrl}/api/v1/dashboard/kpis`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Device-Id': 'staging-login-check'
    },
    signal: AbortSignal.timeout(20_000)
  });

  if (!kpiRes.ok) {
    const detail = await kpiRes.text();
    console.error(`Dashboard KPIs failed (${kpiRes.status}): ${detail}`);
    process.exit(1);
  }

  const body = await kpiRes.json();
  const visits = body?.data?.visits;
  if (!visits || typeof visits.total !== 'number') {
    console.error('Unexpected KPI payload');
    process.exit(1);
  }

  const meRes = await fetch(`${apiUrl}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Device-Id': 'staging-login-check'
    },
    signal: AbortSignal.timeout(20_000)
  });
  const meBody = meRes.ok ? await meRes.json() : null;
  const role = (meBody?.user?.role || '').trim().toLowerCase();
  const kpiUiRoles = new Set(['admin', 'cornea_consultant']);
  if (role && !kpiUiRoles.has(role)) {
    console.warn('');
    console.warn(`Warning: role "${role}" hides institute KPIs in the dashboard UI.`);
    console.warn('  staging-smoke will fail on "dashboard institute KPIs load after sign-in".');
    console.warn('  Fix: STAGING_E2E_ROLE=admin npm run e2e:staging-user');
    console.warn('');
  }

  console.log(`OK — ${email} @ ${apiUrl}`);
  console.log(`  role=${role || '(unknown)'} visits.total=${visits.total} today=${visits.today}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
