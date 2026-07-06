#!/usr/bin/env node
/**
 * Project 9 — verify medicolegal compliance posture.
 * Usage: node scripts/verify-medicolegal-compliance.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GOVERNANCE_DOCS,
  checkGovernanceDoc,
  checkAllGovernanceDocs,
  checkVerifyScript,
  checkAuditReviewScript,
  checkProjectDoc,
  checkConsentModule,
  checkAuditApi,
  checkIncidentLinkage,
  probeAuditLogs
} from './lib/medicolegal-compliance-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'governance-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);

async function loginIfConfigured() {
  const password = process.env.STAGING_E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
  const email = (process.env.STAGING_E2E_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim();
  if (!password || !email) return null;
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.accessToken) return null;
  return body.accessToken;
}

async function main() {
  const token = await loginIfConfigured();
  const auditProbe = token
    ? await probeAuditLogs(API, token)
    : { ok: true, skipped: true, reason: 'credentials unset — skipped audit log probe' };

  const docChecks = GOVERNANCE_DOCS.map((d) => ({
    id: `M-${d.id}`,
    name: `Governance doc: ${path.basename(d.path)}`,
    ...checkGovernanceDoc(ROOT, d)
  }));

  const checks = [
    { id: 'M1', name: 'All governance documents', ...checkAllGovernanceDocs(ROOT) },
    ...docChecks,
    { id: 'M5', name: 'Verification script', ...checkVerifyScript(ROOT) },
    { id: 'M6', name: 'Consent modules in clinic', ...checkConsentModule(ROOT) },
    { id: 'M7', name: 'Audit logging API + UI', ...checkAuditApi(ROOT) },
    { id: 'M8', name: 'Audit review script', ...checkAuditReviewScript(ROOT) },
    { id: 'M9', name: 'Incident response linkage', ...checkIncidentLinkage(ROOT) },
    { id: 'M10', name: 'Project 9 documentation', ...checkProjectDoc(ROOT) },
    {
      id: 'M11',
      name: 'Live audit log sample',
      ...(auditProbe.skipped ? auditProbe : { ok: auditProbe.ok, reason: auditProbe.reason })
    }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P9-medicolegal-compliance',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    governanceDocs: GOVERNANCE_DOCS.map((d) => d.path),
    api: API
  };

  if (writeReport) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = report.generatedAt.replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, `${stamp}.json`), JSON.stringify(report, null, 2));
  }

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n=== Medicolegal compliance (Project 9) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log(`Report: docs/governance-reports/latest.json`);
      console.log('Audit review: npm run medicolegal:audit-review\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
