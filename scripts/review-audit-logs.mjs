#!/usr/bin/env node
/**
 * Review audit logs for medicolegal compliance (Project 9).
 * Usage: node scripts/review-audit-logs.mjs [--json] [--limit=50]
 */
import { summarizeAuditFindings } from './lib/medicolegal-compliance-checks.mjs';

const API = (process.env.PRODUCTION_API_URL || process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const EMAIL = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim();
const PASSWORD = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
const jsonOut = process.argv.includes('--json');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': 'audit-review' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const body = await res.json();
  if (!body.accessToken) throw new Error('Login missing accessToken');
  return body.accessToken;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Set STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD (or SEED_ADMIN_*).');
    process.exit(1);
  }

  const token = await login();

  const res = await fetch(`${API}/api/v1/admin/audit-logs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'audit-review' },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Audit log fetch failed (${res.status})`, body);
    process.exit(1);
  }

  const rows = body.data || [];
  const findings = summarizeAuditFindings(rows);
  const output = {
    generatedAt: new Date().toISOString(),
    api: API,
    sampled: rows.length,
    findings,
    status: findings.some((f) => f.level === 'warn') ? 'REVIEW' : 'OK',
    processDoc: 'docs/AUDIT_REVIEW_PROCESS.md'
  };

  if (jsonOut) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\n=== Audit log review (Project 9) ===\n');
    console.log(`Sampled: ${rows.length} entries (limit ${limit})`);
    if (findings.length) {
      console.log('\nFindings:');
      for (const f of findings) console.log(`  [${f.level.toUpperCase()}] ${f.message}`);
    } else {
      console.log('\nNo warnings in sample.');
    }
    console.log(`\nOverall: ${output.status}`);
    console.log(`Process: ${output.processDoc}\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
