#!/usr/bin/env node
/**
 * Weekly pilot safety review (Project 11).
 * Usage: node scripts/review-pilot-week.mjs [--json]
 */
import { probePilotHealth, classifySafetyStatus } from './lib/pilot-plan-checks.mjs';
import { summarizeAuditFindings } from './lib/medicolegal-compliance-checks.mjs';

const API = (process.env.PRODUCTION_API_URL || process.env.STAGING_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const CLINIC = (process.env.PRODUCTION_CLINIC_URL || process.env.STAGING_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
  /\/$/,
  ''
);
const EMAIL = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim();
const PASSWORD = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
const jsonOut = process.argv.includes('--json');

async function loginIfConfigured() {
  if (!EMAIL || !PASSWORD) return null;
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': 'pilot-weekly-review' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(25_000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.accessToken) return null;
  return body.accessToken;
}

async function sampleAudit(token) {
  const res = await fetch(`${API}/api/v1/admin/audit-logs?limit=30`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'pilot-weekly-review' },
    signal: AbortSignal.timeout(25_000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: `audit HTTP ${res.status}`, findings: [] };
  const rows = body.data || [];
  return { ok: true, sampled: rows.length, findings: summarizeAuditFindings(rows) };
}

async function main() {
  const health = await probePilotHealth(API, CLINIC);
  const findings = [...health.findings];

  const token = await loginIfConfigured();
  let audit = { ok: false, skipped: true, reason: 'credentials unset — skipped audit sample' };
  if (token) {
    audit = await sampleAudit(token);
    if (audit.findings?.length) {
      for (const f of audit.findings) {
        findings.push({ level: f.level === 'warn' ? 'warn' : 'info', message: f.message });
      }
    }
  }

  const safety = classifySafetyStatus(findings);
  const output = {
    generatedAt: new Date().toISOString(),
    api: API,
    clinic: CLINIC,
    healthStatus: health.status,
    safetyStatus: safety.status,
    safetyReason: safety.reason,
    findings,
    auditSample: audit.skipped ? { skipped: true, reason: audit.reason } : audit,
    checklistDoc: 'docs/PILOT_WEEKLY_CHECKLIST.md',
    safetyDoc: 'docs/PILOT_SAFETY_MONITORING.md'
  };

  if (jsonOut) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('\n=== Pilot weekly review (Project 11) ===\n');
    console.log(`Safety status: ${output.safetyStatus} (${output.safetyReason})`);
    console.log(`Health probe: ${output.healthStatus}`);
    if (findings.length) {
      console.log('\nFindings:');
      for (const f of findings) {
        console.log(`  - [${f.level}] ${f.message}`);
      }
    } else {
      console.log('\nFindings: none');
    }
    console.log('\nNext: complete docs/PILOT_WEEKLY_CHECKLIST.md\n');
  }

  process.exit(safety.status === 'RED' ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
