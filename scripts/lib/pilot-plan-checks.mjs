#!/usr/bin/env node
/**
 * Project 11 — 90-day pilot plan helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export const PILOT_DOCS = [
  {
    id: 'protocol',
    path: 'docs/PILOT_90_DAY_PROTOCOL.md',
    requiredSections: ['Pilot scope', 'Phases', 'Weekly cadence', 'Pilot exit']
  },
  {
    id: 'weekly-checklist',
    path: 'docs/PILOT_WEEKLY_CHECKLIST.md',
    requiredSections: ['Platform health', 'Safety monitoring', 'Weekly decision']
  },
  {
    id: 'safety-monitoring',
    path: 'docs/PILOT_SAFETY_MONITORING.md',
    requiredSections: ['Safety signals', 'Thresholds', 'Monitoring workflow']
  },
  {
    id: 'success-metrics',
    path: 'docs/PILOT_SUCCESS_METRICS.md',
    requiredSections: ['Technical metrics', 'Clinical operations metrics', 'Pilot success gate']
  },
  {
    id: 'expansion-criteria',
    path: 'docs/PILOT_EXPANSION_CRITERIA.md',
    requiredSections: ['Expansion prerequisites', 'Expansion decision matrix', 'Required sign-off']
  }
];

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function checkPilotDoc(repoRoot, doc) {
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

export function checkAllPilotDocs(repoRoot) {
  const results = PILOT_DOCS.map((d) => ({ id: d.id, ...checkPilotDoc(repoRoot, d) }));
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) {
    return { ok: true, reason: `${PILOT_DOCS.length} pilot documents` };
  }
  return { ok: false, reason: failed.map((f) => f.reason).join('; ') };
}

export function checkVerifyScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/verify-pilot-plan.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"verify:pilot"')) {
    return { ok: true, reason: 'npm run verify:pilot' };
  }
  return { ok: false, reason: 'verify-pilot-plan.mjs missing' };
}

export function checkWeeklyReviewScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/review-pilot-week.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"pilot:weekly-review"')) {
    return { ok: true, reason: 'npm run pilot:weekly-review' };
  }
  return { ok: false, reason: 'review-pilot-week.mjs missing' };
}

export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_11_90_DAY_PILOT_PLAN.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_11_90_DAY_PILOT_PLAN.md' };
  }
  return { ok: false, reason: 'PROJECT_11 doc missing' };
}

export function checkMetricsExpansionLinkage(repoRoot) {
  const metrics = readRepoFile(repoRoot, 'docs/PILOT_SUCCESS_METRICS.md');
  const expansion = readRepoFile(repoRoot, 'docs/PILOT_EXPANSION_CRITERIA.md');
  const linked =
    metrics.includes('PILOT_EXPANSION_CRITERIA') && expansion.includes('PILOT_SUCCESS_METRICS');
  if (linked) {
    return { ok: true, reason: 'success metrics linked to expansion criteria' };
  }
  return { ok: false, reason: 'metrics/expansion linkage missing' };
}

export function checkSafetyLinkage(repoRoot) {
  const protocol = readRepoFile(repoRoot, 'docs/PILOT_90_DAY_PROTOCOL.md');
  const checklist = readRepoFile(repoRoot, 'docs/PILOT_WEEKLY_CHECKLIST.md');
  const safety = fileExists(repoRoot, 'docs/PILOT_SAFETY_MONITORING.md');
  const linked =
    safety &&
    protocol.includes('PILOT_SAFETY_MONITORING') &&
    checklist.includes('pilot:weekly-review');
  if (linked) {
    return { ok: true, reason: 'protocol + checklist link safety monitoring' };
  }
  return { ok: false, reason: 'safety monitoring linkage incomplete' };
}

export function classifySafetyStatus(findings) {
  const p1 = findings.filter((f) => f.level === 'critical').length;
  const p2 = findings.filter((f) => f.level === 'warn').length;
  if (p1 > 0) return { status: 'RED', reason: `${p1} critical finding(s)` };
  if (p2 >= 2) return { status: 'AMBER', reason: `${p2} warning finding(s)` };
  return { status: 'GREEN', reason: 'within pilot safety thresholds' };
}

export async function probePilotHealth(apiUrl, clinicUrl) {
  const findings = [];
  try {
    const apiRes = await fetch(`${apiUrl}/health/live`, { signal: AbortSignal.timeout(20_000) });
    if (!apiRes.ok) {
      findings.push({ level: 'critical', message: `API health/live HTTP ${apiRes.status}` });
    }
  } catch (e) {
    findings.push({ level: 'critical', message: `API health probe failed: ${e.message}` });
  }

  try {
    const clinicRes = await fetch(clinicUrl, { signal: AbortSignal.timeout(20_000) });
    if (!clinicRes.ok) {
      findings.push({ level: 'warn', message: `Clinic URL HTTP ${clinicRes.status}` });
    }
  } catch (e) {
    findings.push({ level: 'warn', message: `Clinic probe failed: ${e.message}` });
  }

  const { status, reason } = classifySafetyStatus(findings);
  return { ok: status !== 'RED', findings, status, reason };
}
