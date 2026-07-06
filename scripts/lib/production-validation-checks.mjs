#!/usr/bin/env node
/**
 * Project 7 — production validation helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function listE2eSpecs(repoRoot) {
  const dir = path.join(repoRoot, 'e2e');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js'));
}

/** V1 — Playwright regression suite */
export function checkPlaywrightSuite(repoRoot) {
  const specs = listE2eSpecs(repoRoot);
  const config = fileExists(repoRoot, 'playwright.config.js');
  const staging = fileExists(repoRoot, 'playwright.staging.config.js');
  const production = fileExists(repoRoot, 'playwright.production.config.js');
  if (config && staging && production && specs.length >= 10) {
    return { ok: true, reason: `${specs.length} e2e specs + 3 playwright configs` };
  }
  return { ok: false, reason: `e2e incomplete (${specs.length} specs)` };
}

/** V2 — API unit test suite */
export function checkApiUnitTests(repoRoot) {
  const testsDir = path.join(repoRoot, 'apps', 'api', 'tests');
  if (!fs.existsSync(testsDir)) return { ok: false, reason: 'apps/api/tests missing' };
  const count = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.js')).length;
  const pkg = readRepoFile(repoRoot, 'apps/api/package.json');
  if (count >= 5 && pkg.includes('"test": "vitest run"')) {
    return { ok: true, reason: `${count} vitest files` };
  }
  return { ok: false, reason: `only ${count} api test files` };
}

/** V3 — staging smoke spec */
export function checkStagingSmoke(repoRoot) {
  const spec = fileExists(repoRoot, 'e2e/staging-smoke.spec.js');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (spec && pkg.includes('"test:e2e:staging"')) {
    return { ok: true, reason: 'e2e/staging-smoke.spec.js + test:e2e:staging' };
  }
  return { ok: false, reason: 'staging smoke missing' };
}

/** V4 — production validation Playwright spec */
export function checkProductionValidationSpec(repoRoot) {
  const spec = fileExists(repoRoot, 'e2e/production-validation.spec.js');
  const cfg = fileExists(repoRoot, 'playwright.production.config.js');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (spec && cfg && pkg.includes('"test:e2e:production"')) {
    return { ok: true, reason: 'production-validation.spec.js + test:e2e:production' };
  }
  return { ok: false, reason: 'production e2e missing' };
}

/** V5 — load check script */
export function checkLoadScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/production-load-check.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"production:load-check"')) {
    return { ok: true, reason: 'npm run production:load-check' };
  }
  return { ok: false, reason: 'load check script missing' };
}

/** V6 — accessibility check script */
export function checkA11yScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/production-a11y-check.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"production:a11y-check"')) {
    return { ok: true, reason: 'npm run production:a11y-check' };
  }
  return { ok: false, reason: 'a11y check script missing' };
}

/** V7 — operator regression script */
export function checkOperatorRegression(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/production-operator-check.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"check:production-operator"')) {
    return { ok: true, reason: 'npm run check:production-operator' };
  }
  return { ok: false, reason: 'production-operator-check missing' };
}

/** V8 — project documentation */
export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_07_PRODUCTION_VALIDATION.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_07_PRODUCTION_VALIDATION.md' };
  }
  return { ok: false, reason: 'PROJECT_07 doc missing' };
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Live API health */
export async function checkApiHealth(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(20_000) });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && body?.checks?.database?.ok !== false;
    return {
      ok,
      reason: ok ? `HTTP ${res.status}; db=${body?.checks?.database?.ok}` : `HTTP ${res.status}`
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export function resolveClinicHtmlUrl(clinicUrl) {
  const u = clinicUrl.replace(/\/$/, '');
  if (u.endsWith('.html')) return u;
  if (u.endsWith('/Cornea')) return u.replace(/\/Cornea$/, '/Cornea.html');
  return `${u}/Cornea.html`;
}

export function resolveClinicBaseUrl(clinicUrl) {
  const html = resolveClinicHtmlUrl(clinicUrl);
  return html.replace(/\/Cornea\.html$/i, '');
}

/** Live clinic page fetch */
export async function checkClinicLoads(clinicUrl) {
  try {
    const url = resolveClinicHtmlUrl(clinicUrl);
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    const html = await res.text();
    const ok =
      res.ok &&
      html.includes('emrPatientModal') &&
      (html.includes('cornea-api-adapter.js') || html.includes('patient-form.js'));
    return {
      ok,
      reason: ok ? `HTTP ${res.status}; EMR shell + scripts referenced` : `HTTP ${res.status}; missing EMR markers`
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/** Light load baseline on /health/live */
export async function runLoadBaseline(apiUrl, { requests = 20, p95MaxMs = 3000 } = {}) {
  const times = [];
  let failures = 0;
  for (let i = 0; i < requests; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${apiUrl}/health/live`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) failures++;
      times.push(Date.now() - start);
    } catch {
      failures++;
      times.push(10_000);
    }
  }
  times.sort((a, b) => a - b);
  const p95 = percentile(times, 95);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const ok = failures === 0 && p95 <= p95MaxMs;
  return {
    ok,
    reason: `p95=${p95}ms avg=${avg}ms failures=${failures}`,
    metrics: { p95, avg, min: times[0], max: times[times.length - 1], failures, requests }
  };
}

/** Basic accessibility checks — static HTML shell + login modal source in adapter */
export function analyzeClinicA11y(html, adapterJs = '') {
  const findings = [];
  if (!/<html[^>]*\blang=/i.test(html)) findings.push('missing html lang');
  if (!/<title>[^<]+<\/title>/i.test(html)) findings.push('missing page title');
  if (!/name=["']viewport["']/i.test(html)) findings.push('missing viewport meta');
  if (!/id=["']emrPatientModal["']/i.test(html)) findings.push('missing patient visit modal');
  if (!/role=["']dialog["']/i.test(html)) findings.push('no role=dialog on static modals');

  const src = adapterJs || '';
  if (!src.includes('corneaLoginEmail')) findings.push('login email field not in adapter');
  if (!src.includes('corneaLoginPassword')) findings.push('login password field not in adapter');
  if (!/for=["']corneaLoginEmail["']/i.test(src) && !/aria-label/i.test(src)) {
    findings.push('login email missing label in adapter');
  }
  if (!/for=["']corneaLoginPassword["']/i.test(src) && !/corneaLoginPassword[^>]*aria-label/i.test(src)) {
    findings.push('login password missing label in adapter');
  }
  if (!src.includes('corneaCloudLoginModal')) findings.push('cloud login modal not in adapter');

  return { ok: findings.length === 0, findings };
}

export function checkClinicA11yStatic(repoRoot) {
  try {
    const html = readRepoFile(repoRoot, 'apps/clinic/Cornea.html');
    const adapter = readRepoFile(repoRoot, 'apps/clinic/cornea-api-adapter.js');
    const result = analyzeClinicA11y(html, adapter);
    return {
      ok: result.ok,
      reason: result.ok ? 'lang, viewport, login labels in adapter' : result.findings.join('; ')
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function checkClinicA11yLive(clinicUrl) {
  try {
    const url = resolveClinicHtmlUrl(clinicUrl);
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    const html = await res.text();
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const shell = analyzeClinicA11y(html, '');
    const shellOk = !shell.findings.some((f) =>
      ['missing html lang', 'missing page title', 'missing viewport meta'].includes(f)
    );
    return {
      ok: shellOk,
      reason: shellOk ? 'live HTML shell OK (login labels verified in repo)' : shell.findings.join('; ')
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
