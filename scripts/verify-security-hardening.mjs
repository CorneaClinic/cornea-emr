#!/usr/bin/env node
/**
 * Project 6 — verify security hardening posture.
 * Usage: node scripts/verify-security-hardening.mjs [--json] [--report]
 *
 * Exits 0 when all checks PASS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkVirusScanIntegration,
  checkSecurityStatusApi,
  checkPentestSelfCheck,
  checkWafProbe,
  checkOwaspReportGenerator,
  checkAuthSessionReview,
  checkProjectDoc,
  checkVirusScanTests
} from './lib/security-hardening-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'docs', 'security-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);

async function checkLiveSecurityStatus() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    return { ok: true, skipped: true, reason: 'SEED_ADMIN_PASSWORD unset — skipped live API check' };
  }
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
  try {
    const login = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000)
    });
    const loginJson = await login.json().catch(() => ({}));
    if (!login.ok || !loginJson.accessToken) {
      return { ok: false, reason: `admin login failed (${login.status})` };
    }
    const res = await fetch(`${API}/api/v1/admin/security/status`, {
      headers: { Authorization: `Bearer ${loginJson.accessToken}` },
      signal: AbortSignal.timeout(20_000)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: `security status ${res.status}` };
    const data = body?.data;
    if (!data?.auth?.sessions || !data?.rateLimit) {
      return { ok: false, reason: 'unexpected security status shape' };
    }
    const redis = data.rateLimit.redisConfigured;
    const hook = data.media?.virusScanHookConfigured;
    return {
      ok: true,
      reason: `sessions active=${data.auth.sessions.active}; redis=${redis}; virusHook=${hook}`
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function checkWafLive() {
  try {
    const res = await fetch(`${API}/health/live`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000)
    });
    const cf = (res.headers.get('server') || '').toLowerCase().includes('cloudflare');
    const ray = res.headers.get('cf-ray');
    if (cf && ray) {
      return { ok: true, reason: `HTTP ${res.status}; cf-ray=${ray}` };
    }
    return { ok: false, reason: 'API not behind Cloudflare (missing cf-ray)' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function main() {
  const checks = [
    { id: 'S1', name: 'Virus scan hook integration', ...checkVirusScanIntegration(ROOT) },
    { id: 'S2', name: 'Admin security status API', ...checkSecurityStatusApi(ROOT) },
    { id: 'S3', name: 'Pentest self-check script', ...checkPentestSelfCheck(ROOT) },
    { id: 'S4', name: 'Cloudflare WAF probe + runbook', ...checkWafProbe(ROOT) },
    { id: 'S5', name: 'OWASP Top 10 report generator', ...checkOwaspReportGenerator(ROOT) },
    { id: 'S6', name: 'Auth session review script', ...checkAuthSessionReview(ROOT) },
    { id: 'S7', name: 'Project 6 documentation', ...checkProjectDoc(ROOT) },
    { id: 'S8', name: 'Virus scan unit tests', ...checkVirusScanTests(ROOT) },
    { id: 'S9', name: 'Live security status API', ...(await checkLiveSecurityStatus()) },
    { id: 'S10', name: 'API behind Cloudflare edge', ...(await checkWafLive()) }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P6-security-hardening',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
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
    console.log('\n=== Security hardening verification (Project 6) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log(`Report: docs/security-reports/latest.json`);
      console.log('OWASP: npm run security:owasp-report\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
