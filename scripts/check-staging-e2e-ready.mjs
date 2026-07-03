#!/usr/bin/env node
/**
 * Check whether staging nightly E2E can run (secrets + last workflow hint).
 * Usage: node scripts/check-staging-e2e-ready.mjs
 */
const REPO = 'CorneaClinic/cornea-emr';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function localSecretsReady() {
  return Boolean(process.env.STAGING_E2E_EMAIL?.trim() && process.env.STAGING_E2E_PASSWORD);
}

async function lastNightlyRun() {
  const data = await fetchJson(
    `https://api.github.com/repos/${REPO}/actions/workflows/e2e-nightly.yml/runs?per_page=3`
  );
  return data.workflow_runs?.[0];
}

async function main() {
  console.log('=== Staging E2E readiness ===\n');

  if (localSecretsReady()) {
    console.log('Local env: STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD set');
    console.log('  → run: npm run smoke:staging\n');
  } else {
    console.log('Local env: STAGING_E2E_* not set');
    console.log('  → set secrets or run:');
    console.log('     npm run setup:staging-e2e -- -Email you@clinic.com -Password "..."');
    console.log('  → GitHub: https://github.com/CorneaClinic/cornea-emr/settings/secrets/actions\n');
  }

  try {
    const run = await lastNightlyRun();
    if (run) {
      console.log(`Last nightly workflow: #${run.run_number} ${run.status} ${run.conclusion || ''}`);
      console.log(`  ${run.html_url}`);
      console.log('  (If staging-smoke logs "Skipping", add repository secrets.)\n');
    }
  } catch (err) {
    console.log(`GitHub API: ${err.message}\n`);
  }

  console.log('Docs: docs/DEPLOY_ROLLBACK.md § Staging E2E');
  process.exit(localSecretsReady() ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
