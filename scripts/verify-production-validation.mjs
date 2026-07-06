#!/usr/bin/env node
/**
 * Project 7 — verify production validation posture.
 * Usage: node scripts/verify-production-validation.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkPlaywrightSuite,
  checkApiUnitTests,
  checkStagingSmoke,
  checkProductionValidationSpec,
  checkLoadScript,
  checkA11yScript,
  checkOperatorRegression,
  checkProjectDoc,
  checkApiHealth,
  checkClinicLoads,
  runLoadBaseline,
  checkClinicA11yStatic,
  checkClinicA11yLive
} from './lib/production-validation-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'validation-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const CLINIC = (process.env.CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(/\/$/, '');

async function main() {
  const staticA11y = checkClinicA11yStatic(ROOT);
  const liveA11y = await checkClinicA11yLive(CLINIC);
  const load = await runLoadBaseline(API);
  const checks = [
    { id: 'V1', name: 'Playwright regression suite', ...checkPlaywrightSuite(ROOT) },
    { id: 'V2', name: 'API unit test suite', ...checkApiUnitTests(ROOT) },
    { id: 'V3', name: 'Staging smoke spec', ...checkStagingSmoke(ROOT) },
    { id: 'V4', name: 'Production validation e2e', ...checkProductionValidationSpec(ROOT) },
    { id: 'V5', name: 'Load check script', ...checkLoadScript(ROOT) },
    { id: 'V6', name: 'Accessibility check script', ...checkA11yScript(ROOT) },
    { id: 'V7', name: 'Operator regression script', ...checkOperatorRegression(ROOT) },
    { id: 'V8', name: 'Project 7 documentation', ...checkProjectDoc(ROOT) },
    { id: 'V9', name: 'Live API health', ...(await checkApiHealth(API)) },
    { id: 'V10', name: 'Live clinic HTML loads', ...(await checkClinicLoads(CLINIC)) },
    { id: 'V11', name: 'API latency baseline (health/live)', ...load },
    { id: 'V12', name: 'Clinic accessibility baseline', ok: staticA11y.ok && liveA11y.ok, reason: `static: ${staticA11y.reason}; live: ${liveA11y.reason}` }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P7-production-validation',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    api: API,
    clinic: CLINIC,
    loadMetrics: load.metrics || null
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
    console.log('\n=== Production validation (Project 7) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log(`Report: docs/validation-reports/latest.json`);
      console.log('Playwright: npm run test:e2e:production (needs STAGING_E2E_*)\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
