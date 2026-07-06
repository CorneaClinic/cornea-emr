#!/usr/bin/env node
/**
 * Run full final go-live audit (Project 12).
 * Usage: node scripts/run-final-go-live-audit.mjs [--json] [--offline]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  BASELINE_SCORES,
  AUDIT_VERIFIERS,
  HIGH_RISKS,
  buildProjectCompletion,
  computeDimensionScores,
  compareScores,
  countOpenHighRisks,
  decideGoLive
} from './lib/final-go-live-audit-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'final-audit-reports');

const jsonOut = process.argv.includes('--json');
const offline = process.argv.includes('--offline');

function runVerifier(script) {
  if (offline) {
    return { script, ok: true, skipped: true, reason: 'offline mode' };
  }
  const result = spawnSync('npm', ['run', script], {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: 300_000
  });
  const ok = result.status === 0;
  return {
    script,
    ok,
    reason: ok ? 'PASS' : `exit ${result.status}`,
    output: (result.stdout || '').split('\n').slice(-6).join('\n').trim()
  };
}

function main() {
  const verifierResults = AUDIT_VERIFIERS.map((s) => runVerifier(s));
  const projectCompletion = buildProjectCompletion(ROOT);
  const currentScores = computeDimensionScores(projectCompletion);
  const comparison = compareScores(BASELINE_SCORES, currentScores);
  const openHigh = countOpenHighRisks(HIGH_RISKS);
  const outcome = decideGoLive(currentScores, openHigh);

  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P12-final-go-live-audit',
    baseline: BASELINE_SCORES,
    current: currentScores,
    comparison,
    projectCompletion,
    verifierResults,
    highRisks: HIGH_RISKS,
    openHighRisks: openHigh,
    decision: outcome.decision,
    decisionReason: outcome.reason,
    status: outcome.decision === 'NO GO' ? 'FAIL' : 'PASS'
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, `${stamp}.json`), JSON.stringify(report, null, 2));

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n=== Final go-live audit (Project 12) ===\n');
    console.log(`Decision: ${report.decision}`);
    console.log(`Reason: ${report.decisionReason}\n`);
    console.log('Score comparison (baseline → current):');
    for (const row of comparison) {
      const mark = row.meetsTarget ? '✓' : '·';
      console.log(
        `  ${mark} ${row.dimension}: ${row.baseline} → ${row.current} (${row.delta >= 0 ? '+' : ''}${row.delta})`
      );
    }
    console.log(`\nOpen High risks: ${openHigh}`);
    console.log(`Report: docs/final-audit-reports/latest.json\n`);
  }

  process.exit(outcome.decision === 'NO GO' ? 1 : 0);
}

main();
