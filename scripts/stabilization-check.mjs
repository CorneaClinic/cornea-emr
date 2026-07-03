#!/usr/bin/env node
/**
 * Stabilization mode — combined ops + security self-check (no vendor milestones).
 * Usage: node scripts/stabilization-check.mjs
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(12000)
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function main() {
  console.log('=== Stabilization check (vendor postponed) ===\n');
  console.log('Guide: docs/STABILIZATION_MODE.md\n');

  let failed = 0;

  try {
    execSync('npm run pentest:self-check', { cwd: repoRoot, stdio: 'inherit' });
  } catch {
    failed += 1;
  }

  console.log('');
  try {
    const live = await fetch('https://corneaclinic-2zfpt.ondigitalocean.app/health/live');
    const body = await live.json();
    const ok = live.ok && body.ok === true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  Production API live — /health/live`);
    if (!ok) failed += 1;
  } catch (err) {
    console.log(`FAIL  Production API live — ${err.message}`);
    failed += 1;
  }

  try {
    const runs = await fetchJson(
      'https://api.github.com/repos/CorneaClinic/cornea-emr/actions/workflows/ci.yml/runs?per_page=1'
    );
    const run = runs.workflow_runs?.[0];
    const ok = run?.conclusion === 'success';
    console.log(
      `${ok ? 'PASS' : 'WARN'}  CI on main — ${run ? `#${run.run_number} ${run.conclusion}` : 'unknown'}`
    );
    if (!ok) {
      console.log('       (informational — fix before next release)');
    }
  } catch {
    console.log('WARN  CI on main — could not reach GitHub API');
  }

  console.log('\n--- Manual (see STABILIZATION_MODE.md) ---');
  console.log('  [ ] Monthly backup drill');
  console.log('  [ ] Quarterly role review');
  console.log('  [ ] ASVS checklist progress');

  console.log(`\n=== Stabilization: ${failed ? 'OPEN items' : 'automated checks passed'} ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
