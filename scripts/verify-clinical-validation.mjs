#!/usr/bin/env node
/**
 * Project 8 — verify clinical validation posture.
 * Usage: node scripts/verify-clinical-validation.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CLINICAL_WORKFLOWS,
  checkWorkflowDefinitions,
  checkWorkflowStaticModules,
  checkWorkflowUiMarkers,
  checkPrintingSupport,
  checkMediaPlatform,
  checkSimulationScript,
  checkClinicalE2e,
  checkProjectDoc,
  runLiveWorkflowProbes,
  probeMediaLibrary
} from './lib/clinical-validation-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'clinical-validation-reports');

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
  const liveProbes = token
    ? await runLiveWorkflowProbes(API, token)
    : { ok: true, skipped: true, reason: 'credentials unset — skipped live API probes', results: [] };
  const mediaProbe = token
    ? await probeMediaLibrary(API, token)
    : { ok: true, skipped: true, reason: 'credentials unset — skipped media probe' };

  const checks = [
    { id: 'C1', name: '11 workflow definitions', ...checkWorkflowDefinitions() },
    { id: 'C2', name: 'Workflow static modules', ...checkWorkflowStaticModules(ROOT) },
    { id: 'C3', name: 'Workflow UI markers', ...checkWorkflowUiMarkers(ROOT) },
    { id: 'C4', name: 'Printing support', ...checkPrintingSupport(ROOT) },
    { id: 'C5', name: 'Clinical media platform', ...checkMediaPlatform(ROOT) },
    { id: 'C6', name: 'Workflow simulation script', ...checkSimulationScript(ROOT) },
    { id: 'C7', name: 'Clinical validation e2e', ...checkClinicalE2e(ROOT) },
    { id: 'C8', name: 'Project 8 documentation', ...checkProjectDoc(ROOT) },
    {
      id: 'C9',
      name: 'Live API workflow probes',
      ...(liveProbes.skipped ? liveProbes : { ok: liveProbes.ok, reason: liveProbes.reason })
    },
    {
      id: 'C10',
      name: 'Live media library probe',
      ...(mediaProbe.skipped ? mediaProbe : { ok: mediaProbe.ok, reason: mediaProbe.reason })
    }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P8-clinical-validation',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    workflows: CLINICAL_WORKFLOWS.map((w) => ({ id: w.id, name: w.name })),
    liveProbeDetails: liveProbes.results || null,
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
    console.log('\n=== Clinical validation (Project 8) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log(`Report: docs/clinical-validation-reports/latest.json`);
      console.log('Simulate: npm run clinical:simulate (needs STAGING_E2E_*)\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
