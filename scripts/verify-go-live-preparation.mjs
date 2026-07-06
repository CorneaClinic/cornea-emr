#!/usr/bin/env node
/**
 * Project 10 — verify go-live preparation readiness.
 * Usage: node scripts/verify-go-live-preparation.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GO_LIVE_DOCS,
  checkGoLiveDoc,
  checkAllGoLiveDocs,
  checkVerifyScript,
  checkProjectDoc,
  checkRollbackLinkage,
  checkDowntimeLinkage,
  checkIncidentLinkage
} from './lib/go-live-preparation-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'go-live-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

async function main() {
  const docChecks = GO_LIVE_DOCS.map((d) => ({
    id: `G10-${d.id}`,
    name: `Go-live doc: ${path.basename(d.path)}`,
    ...checkGoLiveDoc(ROOT, d)
  }));

  const checks = [
    { id: 'G10-1', name: 'All go-live documents', ...checkAllGoLiveDocs(ROOT) },
    ...docChecks,
    { id: 'G10-2', name: 'Verification script', ...checkVerifyScript(ROOT) },
    { id: 'G10-3', name: 'Rollback linkage', ...checkRollbackLinkage(ROOT) },
    { id: 'G10-4', name: 'Downtime linkage', ...checkDowntimeLinkage(ROOT) },
    { id: 'G10-5', name: 'Incident response linkage', ...checkIncidentLinkage(ROOT) },
    { id: 'G10-6', name: 'Project 10 documentation', ...checkProjectDoc(ROOT) }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P10-go-live-preparation',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    goLiveDocs: GO_LIVE_DOCS.map((d) => d.path)
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
    console.log('\n=== Go-live preparation (Project 10) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log('Report: docs/go-live-reports/latest.json\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
