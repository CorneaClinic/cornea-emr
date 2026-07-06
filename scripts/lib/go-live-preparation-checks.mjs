#!/usr/bin/env node
/**
 * Project 10 — go-live preparation helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export const GO_LIVE_DOCS = [
  {
    id: 'admin-manual',
    path: 'docs/ADMIN_MANUAL.md',
    requiredSections: ['Daily tasks', 'Security and compliance checks', 'Deployment controls']
  },
  {
    id: 'clinician-manual',
    path: 'docs/CLINICIAN_MANUAL.md',
    requiredSections: ['Start-of-day checks', 'Downtime protocol', 'End-of-day checks']
  },
  {
    id: 'reception-manual',
    path: 'docs/RECEPTION_MANUAL.md',
    requiredSections: ['Opening checklist', 'Downtime handling', 'Escalation triggers']
  },
  {
    id: 'training-guide',
    path: 'docs/TRAINING_GUIDE.md',
    requiredSections: ['Training model', 'Required reading by role', 'Competency checklist']
  },
  {
    id: 'deployment-checklist',
    path: 'docs/GO_LIVE_DEPLOYMENT_CHECKLIST.md',
    requiredSections: ['Pre-deployment gates', 'Post-deployment smoke checks', 'Go / no-go sign-off']
  },
  {
    id: 'downtime-sop',
    path: 'docs/DOWNTIME_SOP.md',
    requiredSections: ['Downtime trigger criteria', 'Restoration and reconciliation', 'Post-incident review']
  }
];

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function checkGoLiveDoc(repoRoot, doc) {
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

export function checkAllGoLiveDocs(repoRoot) {
  const results = GO_LIVE_DOCS.map((d) => ({ id: d.id, ...checkGoLiveDoc(repoRoot, d) }));
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) {
    return { ok: true, reason: `${GO_LIVE_DOCS.length} go-live documents` };
  }
  return { ok: false, reason: failed.map((f) => f.reason).join('; ') };
}

export function checkVerifyScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/verify-go-live-preparation.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"verify:go-live"')) {
    return { ok: true, reason: 'npm run verify:go-live' };
  }
  return { ok: false, reason: 'verify-go-live-preparation.mjs missing' };
}

export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_10_GO_LIVE_PREPARATION.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_10_GO_LIVE_PREPARATION.md' };
  }
  return { ok: false, reason: 'PROJECT_10 doc missing' };
}

export function checkRollbackLinkage(repoRoot) {
  const checklist = readRepoFile(repoRoot, 'docs/GO_LIVE_DEPLOYMENT_CHECKLIST.md');
  const rollback = fileExists(repoRoot, 'docs/DEPLOY_ROLLBACK.md');
  if (rollback && checklist.includes('DEPLOY_ROLLBACK')) {
    return { ok: true, reason: 'deployment checklist links rollback runbook' };
  }
  return { ok: false, reason: 'rollback linkage missing from deployment checklist' };
}

export function checkDowntimeLinkage(repoRoot) {
  const clinician = readRepoFile(repoRoot, 'docs/CLINICIAN_MANUAL.md');
  const reception = readRepoFile(repoRoot, 'docs/RECEPTION_MANUAL.md');
  const downtime = fileExists(repoRoot, 'docs/DOWNTIME_SOP.md');
  if (downtime && clinician.includes('DOWNTIME_SOP') && reception.includes('DOWNTIME_SOP')) {
    return { ok: true, reason: 'clinician + reception manuals link downtime SOP' };
  }
  return { ok: false, reason: 'downtime linkage incomplete in role manuals' };
}

export function checkIncidentLinkage(repoRoot) {
  const admin = readRepoFile(repoRoot, 'docs/ADMIN_MANUAL.md');
  const downtime = readRepoFile(repoRoot, 'docs/DOWNTIME_SOP.md');
  const incident = fileExists(repoRoot, 'docs/INCIDENT_RESPONSE.md');
  const linked = admin.includes('INCIDENT_RESPONSE') && downtime.includes('INCIDENT_RESPONSE');
  if (incident && linked) {
    return { ok: true, reason: 'incident response linked from go-live docs' };
  }
  return { ok: false, reason: 'incident response linkage missing in go-live docs' };
}
