#!/usr/bin/env node
/**
 * Project 9 — medicolegal compliance helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export const GOVERNANCE_DOCS = [
  {
    id: 'retention',
    path: 'docs/DATA_RETENTION_POLICY.md',
    requiredSections: ['Clinical records', 'Audit logs', 'Backups', 'Media', 'Operator']
  },
  {
    id: 'consent',
    path: 'docs/CONSENT_MANAGEMENT.md',
    requiredSections: ['Laser refractive', 'Teaching cases', 'Operator']
  },
  {
    id: 'governance',
    path: 'docs/CLINICAL_GOVERNANCE.md',
    requiredSections: ['Roles', 'Change control', 'Sign-off']
  },
  {
    id: 'audit-review',
    path: 'docs/AUDIT_REVIEW_PROCESS.md',
    requiredSections: ['Weekly', 'Monthly', 'Quarterly', 'Escalation']
  }
];

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function checkGovernanceDoc(repoRoot, doc) {
  const full = path.join(repoRoot, doc.path);
  if (!fs.existsSync(full)) {
    return { ok: false, reason: `${doc.path} missing` };
  }
  const text = fs.readFileSync(full, 'utf8');
  const missing = (doc.requiredSections || []).filter((s) => !text.includes(s));
  if (missing.length) {
    return { ok: false, reason: `${doc.path} missing sections: ${missing.join(', ')}` };
  }
  return { ok: true, reason: doc.path };
}

export function checkAllGovernanceDocs(repoRoot) {
  const results = GOVERNANCE_DOCS.map((d) => ({ id: d.id, ...checkGovernanceDoc(repoRoot, d) }));
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) {
    return { ok: true, reason: `${GOVERNANCE_DOCS.length} governance documents` };
  }
  return { ok: false, reason: failed.map((f) => f.reason).join('; ') };
}

export function checkVerifyScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/verify-medicolegal-compliance.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"verify:medicolegal"')) {
    return { ok: true, reason: 'npm run verify:medicolegal' };
  }
  return { ok: false, reason: 'verify-medicolegal-compliance.mjs missing' };
}

export function checkAuditReviewScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/review-audit-logs.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"medicolegal:audit-review"')) {
    return { ok: true, reason: 'npm run medicolegal:audit-review' };
  }
  return { ok: false, reason: 'review-audit-logs.mjs missing' };
}

export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_09_MEDICOLEGAL_COMPLIANCE.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_09_MEDICOLEGAL_COMPLIANCE.md' };
  }
  return { ok: false, reason: 'PROJECT_09 doc missing' };
}

export function checkConsentModule(repoRoot) {
  const laser = readRepoFile(repoRoot, 'apps/clinic/cornea-laser-refractive.js');
  const teaching = fileExists(repoRoot, 'apps/clinic/cornea-teaching-library.js');
  const html = readRepoFile(repoRoot, 'apps/clinic/Cornea.html');
  const laserOk = laser.includes('lrPanelConsent') && laser.includes('consent.signed');
  const teachingOk = teaching && html.includes('teachingCaseGrid');
  if (laserOk && teachingOk) {
    return { ok: true, reason: 'laser consent panel + teaching library' };
  }
  return { ok: false, reason: 'consent modules incomplete' };
}

export function checkAuditApi(repoRoot) {
  const v1 = readRepoFile(repoRoot, 'apps/api/src/routes/v1.js');
  const clinic = fileExists(repoRoot, 'apps/clinic/cornea-audit-trail.js');
  const wired = v1.includes('/audit-logs') && v1.includes('/admin/audit-logs') && clinic;
  if (wired) {
    return { ok: true, reason: 'audit-logs API + clinic audit trail UI' };
  }
  return { ok: false, reason: 'audit logging not fully wired' };
}

export function checkIncidentLinkage(repoRoot) {
  const gov = readRepoFile(repoRoot, 'docs/CLINICAL_GOVERNANCE.md');
  const incident = fileExists(repoRoot, 'docs/INCIDENT_RESPONSE.md');
  if (incident && gov.includes('INCIDENT_RESPONSE')) {
    return { ok: true, reason: 'governance links to incident response' };
  }
  return { ok: false, reason: 'incident response linkage missing' };
}

export async function probeAuditLogs(apiUrl, token, limit = 10) {
  try {
    const res = await fetch(`${apiUrl}/api/v1/admin/audit-logs?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'audit-review' },
      signal: AbortSignal.timeout(25_000)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const rows = body.data || body.rows || [];
    if (!Array.isArray(rows)) return { ok: false, reason: 'unexpected audit log shape' };
    const actions = [...new Set(rows.map((r) => r.action).filter(Boolean))];
    return {
      ok: true,
      reason: `${rows.length} entries sampled; actions: ${actions.slice(0, 5).join(', ') || 'none'}`
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export function summarizeAuditFindings(rows) {
  const findings = [];
  const failedLogins = rows.filter((r) => r.action === 'login_failed').length;
  if (failedLogins > 10) {
    findings.push({ level: 'warn', message: `${failedLogins} failed logins in sample — review access attempts` });
  }
  const deletes = rows.filter((r) => /delete/i.test(r.action || '')).length;
  if (deletes > 5) {
    findings.push({ level: 'info', message: `${deletes} delete actions in sample — confirm authorised` });
  }
  const privileged = rows.filter((r) => /admin|role|permission/i.test(`${r.action} ${r.entityType}`)).length;
  if (privileged > 0) {
    findings.push({ level: 'info', message: `${privileged} privileged changes in sample — verify approver` });
  }
  return findings;
}
