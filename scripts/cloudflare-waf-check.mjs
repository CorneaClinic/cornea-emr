#!/usr/bin/env node
/**
 * External Cloudflare / edge security probe (no API token required).
 * Usage: node scripts/cloudflare-waf-check.mjs
 */
const CLINIC =
  process.env.STAGING_CLINIC_URL?.replace(/\/$/, '') ||
  'https://corneaclinic.visionemr.net/Cornea';
const API =
  process.env.STAGING_API_URL?.replace(/\/$/, '') ||
  'https://corneaclinic-2zfpt.ondigitalocean.app';

const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id} — ${detail}`);
}

async function head(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const headers = Object.fromEntries(res.headers.entries());
  return { res, headers };
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await res.json();
  return { res, body };
}

async function main() {
  console.log('=== Cloudflare WAF / edge probe ===\n');
  console.log(`Clinic: ${CLINIC}`);
  console.log(`API:    ${API}`);
  console.log('Runbook: docs/CLOUDFLARE_WAF_REVIEW.md\n');

  try {
    const { res: clinicRes, headers: clinicH } = await head(CLINIC);
    const cfClinic = (clinicH.server || '').toLowerCase().includes('cloudflare');
    record('Clinic behind Cloudflare', cfClinic && clinicH['cf-ray'], `HTTP ${clinicRes.status}; ray=${clinicH['cf-ray'] || 'n/a'}`);
    record('Clinic HTTPS', clinicRes.url.startsWith('https://'), clinicRes.url);
  } catch (err) {
    record('Clinic behind Cloudflare', false, err.message);
  }

  try {
    const { res: apiHead, headers: apiH } = await head(`${API}/health/live`);
    const cfApi = (apiH.server || '').toLowerCase().includes('cloudflare');
    record('API behind Cloudflare proxy', cfApi && apiH['cf-ray'], `HTTP ${apiHead.status}; ray=${apiH['cf-ray'] || 'n/a'}`);
    const helmet =
      apiH['content-security-policy'] &&
      apiH['strict-transport-security'] &&
      apiH['x-content-type-options'];
    record('API Helmet security headers', Boolean(helmet), helmet ? 'csp + hsts + nosniff' : 'missing headers');
  } catch (err) {
    record('API behind Cloudflare proxy', false, err.message);
    record('API Helmet security headers', false, err.message);
  }

  try {
    const { res, body } = await getJson(`${API}/health`);
    const redisOk = body?.checks?.redis?.mode === 'redis' && body.checks.redis.ok === true;
    record('G6 Redis rate limits (API)', redisOk, redisOk ? 'redis mode active' : `mode=${body?.checks?.redis?.mode}`);
    record('API database health', body?.checks?.database?.ok === true, res.status === 200 ? 'ok' : `HTTP ${res.status}`);
  } catch (err) {
    record('G6 Redis rate limits (API)', false, err.message);
    record('API database health', false, err.message);
  }

  console.log('\n--- Manual (Cloudflare dashboard) ---');
  console.log('  [ ] visionemr.net → Bot Fight Mode ON');
  console.log('  [ ] visionemr.net → WAF managed rules deployed');
  console.log('  [ ] Clinic sign-in smoke after WAF changes');
  console.log('  [ ] Sign-off table in docs/CLOUDFLARE_WAF_REVIEW.md');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Automated: ${results.length - failed.length}/${results.length} passed ===`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
