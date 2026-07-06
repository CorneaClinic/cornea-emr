#!/usr/bin/env node
/**
 * Project 6 — security hardening verification helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** S1 — virus scan hook service wired into media uploads */
export function checkVirusScanIntegration(repoRoot) {
  const service = fileExists(repoRoot, 'apps/api/src/services/virusScanService.js');
  const media = readRepoFile(repoRoot, 'apps/api/src/services/mediaAssetService.js');
  const env = readRepoFile(repoRoot, 'apps/api/src/config/env.js');
  const wired = media.includes('scanUploadBuffer');
  const envVars =
    env.includes('MEDIA_VIRUS_SCAN_HOOK_URL') &&
    env.includes('MEDIA_VIRUS_SCAN_REQUIRED') &&
    env.includes('virusScanHookUrl');
  if (service && wired && envVars) {
    return { ok: true, reason: 'virusScanService + mediaAssetService + env vars' };
  }
  return { ok: false, reason: 'missing virus scan integration' };
}

/** S2 — admin security status API */
export function checkSecurityStatusApi(repoRoot) {
  const route = fileExists(repoRoot, 'apps/api/src/routes/admin-security.js');
  const service = fileExists(repoRoot, 'apps/api/src/services/securityStatusService.js');
  const v1 = readRepoFile(repoRoot, 'apps/api/src/routes/v1.js');
  const mounted = v1.includes("'/admin/security'") || v1.includes('"/admin/security"');
  if (route && service && mounted) {
    return { ok: true, reason: 'GET /api/v1/admin/security/status mounted' };
  }
  return { ok: false, reason: 'admin security route not wired' };
}

/** S3 — pentest self-check script present */
export function checkPentestSelfCheck(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/pentest-self-check.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  const npm = pkg.includes('"pentest:self-check"');
  if (script && npm) {
    return { ok: true, reason: 'npm run pentest:self-check' };
  }
  return { ok: false, reason: 'pentest:self-check missing' };
}

/** S4 — Cloudflare WAF probe script */
export function checkWafProbe(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/cloudflare-waf-check.mjs');
  const doc = fileExists(repoRoot, 'docs/CLOUDFLARE_WAF_REVIEW.md');
  if (script && doc) {
    return { ok: true, reason: 'cloudflare-waf-check + runbook' };
  }
  return { ok: false, reason: 'WAF probe or runbook missing' };
}

/** S5 — OWASP report generator */
export function checkOwaspReportGenerator(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/generate-owasp-top10-report.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"security:owasp-report"')) {
    return { ok: true, reason: 'npm run security:owasp-report' };
  }
  return { ok: false, reason: 'OWASP report generator missing' };
}

/** S6 — auth session review script */
export function checkAuthSessionReview(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/review-auth-sessions.mjs');
  if (script) {
    return { ok: true, reason: 'npm run security:auth-sessions' };
  }
  return { ok: false, reason: 'review-auth-sessions.mjs missing' };
}

/** S7 — Project 6 documentation */
export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_06_SECURITY_HARDENING.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_06_SECURITY_HARDENING.md' };
  }
  return { ok: false, reason: 'PROJECT_06 doc missing' };
}

/** S8 — virus scan unit tests */
export function checkVirusScanTests(repoRoot) {
  const test = fileExists(repoRoot, 'apps/api/tests/virus-scan.test.js');
  if (test) {
    return { ok: true, reason: 'apps/api/tests/virus-scan.test.js' };
  }
  return { ok: false, reason: 'virus-scan.test.js missing' };
}
