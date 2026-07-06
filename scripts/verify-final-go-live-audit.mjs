#!/usr/bin/env node
/**
 * Project 12 — verify final go-live audit infrastructure.
 * Usage: node scripts/verify-final-go-live-audit.mjs [--json] [--report]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BASELINE_SCORES,
  HIGH_RISKS,
  buildProjectCompletion,
  computeDimensionScores,
  compareScores,
  countOpenHighRisks,
  decideGoLive,
  checkAuditDoc,
  checkVerifyScript,
  checkRunAuditScript,
  checkProjectDoc,
  checkBaselineReferenced
} from './lib/final-go-live-audit-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'final-audit-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

function main() {
  const projectCompletion = buildProjectCompletion(ROOT);
  const currentScores = computeDimensionScores(projectCompletion);
  const comparison = compareScores(BASELINE_SCORES, currentScores);
  const openHigh = countOpenHighRisks(HIGH_RISKS);
  const outcome = decideGoLive(currentScores, openHigh);

  const checks = [
    { id: 'F12-1', name: 'Final audit document', ...checkAuditDoc(ROOT) },
    { id: 'F12-2', name: 'Verification script', ...checkVerifyScript(ROOT) },
    { id: 'F12-3', name: 'Full audit runner', ...checkRunAuditScript(ROOT) },
    { id: 'F12-4', name: 'Baseline comparison referenced', ...checkBaselineReferenced(ROOT) },
    { id: 'F12-5', name: 'Project 12 documentation', ...checkProjectDoc(ROOT) },
    {
      id: 'F12-6',
      name: 'Score model produces decision',
      ok: ['GO', 'CONDITIONAL GO', 'NO GO'].includes(outcome.decision),
      reason: `${outcome.decision}: ${outcome.reason}`
    },
    {
      id: 'F12-7',
      name: 'Readiness lift from baseline',
      ok: currentScores.overall > BASELINE_SCORES.overall,
      reason: `overall ${BASELINE_SCORES.overall} → ${currentScores.overall}`
    }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P12-final-go-live-audit',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    baseline: BASELINE_SCORES,
    current: currentScores,
    comparison,
    openHighRisks: openHigh,
    decision: outcome.decision,
    decisionReason: outcome.reason,
    highRisks: HIGH_RISKS
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
    console.log('\n=== Final go-live audit verification (Project 12) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nProjected decision: ${outcome.decision}`);
    console.log(`Overall: ${report.status}\n`);
    if (writeReport) {
      console.log('Report: docs/final-audit-reports/latest.json');
      console.log('Full audit: npm run audit:final\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main();
