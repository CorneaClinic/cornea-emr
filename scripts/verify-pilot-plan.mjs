#!/usr/bin/env node
/**
 * Project 11 — verify 90-day pilot plan readiness.
 * Usage: node scripts/verify-pilot-plan.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PILOT_DOCS,
  checkPilotDoc,
  checkAllPilotDocs,
  checkVerifyScript,
  checkWeeklyReviewScript,
  checkProjectDoc,
  checkMetricsExpansionLinkage,
  checkSafetyLinkage,
  probePilotHealth
} from './lib/pilot-plan-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'pilot-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const CLINIC = (process.env.PRODUCTION_CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(
  /\/$/,
  ''
);

async function main() {
  const healthProbe = process.argv.includes('--offline')
    ? { ok: true, skipped: true, reason: 'offline mode — skipped live health probe' }
    : await probePilotHealth(API, CLINIC);

  const docChecks = PILOT_DOCS.map((d) => ({
    id: `P11-${d.id}`,
    name: `Pilot doc: ${path.basename(d.path)}`,
    ...checkPilotDoc(ROOT, d)
  }));

  const checks = [
    { id: 'P11-1', name: 'All pilot documents', ...checkAllPilotDocs(ROOT) },
    ...docChecks,
    { id: 'P11-2', name: 'Verification script', ...checkVerifyScript(ROOT) },
    { id: 'P11-3', name: 'Weekly review script', ...checkWeeklyReviewScript(ROOT) },
    { id: 'P11-4', name: 'Safety monitoring linkage', ...checkSafetyLinkage(ROOT) },
    { id: 'P11-5', name: 'Metrics/expansion linkage', ...checkMetricsExpansionLinkage(ROOT) },
    { id: 'P11-6', name: 'Project 11 documentation', ...checkProjectDoc(ROOT) },
    {
      id: 'P11-7',
      name: 'Live pilot health probe',
      ...(healthProbe.skipped
        ? healthProbe
        : { ok: healthProbe.ok, reason: `${healthProbe.status}: ${healthProbe.reason}` })
    }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P11-90-day-pilot-plan',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    pilotDocs: PILOT_DOCS.map((d) => d.path),
    api: API,
    clinic: CLINIC
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
    console.log('\n=== 90-day pilot plan (Project 11) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log('Report: docs/pilot-reports/latest.json');
      console.log('Weekly review: npm run pilot:weekly-review\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
