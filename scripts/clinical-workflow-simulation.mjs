#!/usr/bin/env node
/**
 * Live API simulation for 11 cornea clinical workflows (Project 8).
 * Usage: node scripts/clinical-workflow-simulation.mjs [--json]
 *
 * Requires STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD (consultant role recommended).
 */
import {
  CLINICAL_WORKFLOWS,
  probeWorkflowApi,
  probeMediaLibrary
} from './lib/clinical-validation-checks.mjs';

const API = (process.env.PRODUCTION_API_URL || process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const EMAIL = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim();
const PASSWORD = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
const DEVICE = 'clinical-workflow-simulation';
const jsonOut = process.argv.includes('--json');

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEVICE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  if (!body.accessToken) throw new Error('Login missing accessToken');
  return body.accessToken;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Set STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD (or SEED_ADMIN_*).');
    process.exit(1);
  }

  console.log('=== Clinical workflow simulation (Project 8) ===\n');
  console.log(`API: ${API}`);
  console.log(`User: ${EMAIL}\n`);

  const token = await login();
  const meRes = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': DEVICE },
    signal: AbortSignal.timeout(20_000)
  });
  const role = meRes.ok ? (await meRes.json()).user?.role : '?';
  console.log(`Signed in (${role})\n`);

  const results = [];
  for (const wf of CLINICAL_WORKFLOWS) {
    if (!wf.api) {
      results.push({ id: wf.id, name: wf.name, ok: true, skipped: true, reason: 'UI/static only' });
      console.log(`SKIP  ${wf.id} ${wf.name} — UI/static only`);
      continue;
    }
    const probe = await probeWorkflowApi(API, token, wf, DEVICE);
    results.push({ id: wf.id, name: wf.name, ...probe });
    console.log(`${probe.ok ? 'PASS' : 'FAIL'}  ${wf.id} ${wf.name} — ${probe.reason}`);
  }

  const media = await probeMediaLibrary(API, token);
  results.push({ id: 'MEDIA', name: 'Clinical media library', ...media });
  console.log(`${media.ok ? 'PASS' : 'FAIL'}  MEDIA Clinical media library — ${media.reason}`);

  const pass = results.every((r) => r.ok || r.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    api: API,
    user: EMAIL,
    role,
    status: pass ? 'PASS' : 'PARTIAL',
    workflows: results
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const failed = results.filter((r) => !r.ok && !r.skipped);
    console.log(`\nOverall: ${report.status} (${results.length - failed.length}/${results.length} passed)\n`);
    if (failed.some((r) => String(r.reason).includes('403'))) {
      console.log('Hint: use consultant role — STAGING_E2E_ROLE=cornea_consultant; npm run e2e:staging-user\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
