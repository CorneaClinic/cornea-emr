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

async function stagingJobStatus(runId) {
  const data = await fetchJson(`https://api.github.com/repos/${REPO}/actions/runs/${runId}/jobs`);
  const jobs = data.jobs || [];
  const smoke = jobs.find((j) => j.name === 'staging-smoke');
  const reminder = jobs.find((j) => j.name === 'staging-secrets-reminder');
  return { smoke, reminder };
}

async function main() {
  console.log('=== Staging E2E readiness ===\n');

  if (localSecretsReady()) {
    console.log('Local env: STAGING_E2E_EMAIL + STAGING_E2E_PASSWORD set');
    console.log('  → npm run check:staging-login');
    console.log('  → npm run smoke:staging\n');
  } else {
    console.log('Local env: STAGING_E2E_* not set');
    console.log('  → npm run e2e:staging-user   # create monitor user + print password');
    console.log('  → npm run setup:staging-e2e -- -Email ... -Password ... -Apply');
    console.log('  → GitHub: https://github.com/CorneaClinic/cornea-emr/settings/secrets/actions\n');
  }

  try {
    const run = await lastNightlyRun();
    if (run) {
      console.log(`Last nightly workflow: #${run.run_number} ${run.status} ${run.conclusion || ''}`);
      console.log(`  ${run.html_url}`);

      const { smoke, reminder } = await stagingJobStatus(run.id);
      if (smoke) {
        console.log(`  staging-smoke: ${smoke.conclusion || smoke.status}`);
      } else if (reminder) {
        console.log('  staging-smoke: skipped (secrets missing — see staging-secrets-reminder job)');
      } else {
        console.log('  staging-smoke: not found on last run (workflow may predate job split)');
      }
      console.log('');
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
