#!/usr/bin/env node
/**
 * Project 12 — final go-live audit helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

/** Baseline from Clinical Go-Live Readiness Report (4 July 2026). */
export const BASELINE_SCORES = {
  overall: 76,
  patientSafety: 72,
  clinical: 82,
  technical: 74,
  operational: 68,
  security: 74
};

export const TARGET_SCORE = 90;

export const PROJECT_SCORE_ITEMS = [
  {
    id: 'P1',
    doc: 'docs/projects/PROJECT_01_STABILIZATION_GATES.md',
    lifts: { technical: 4, operational: 4 }
  },
  {
    id: 'P2',
    doc: 'docs/projects/PROJECT_02_DUPLICATE_PATIENTS.md',
    lifts: { patientSafety: 8 }
  },
  {
    id: 'P3',
    doc: 'docs/projects/PROJECT_03_OFFLINE_DATA_SECURITY.md',
    lifts: { patientSafety: 4, security: 8 }
  },
  {
    id: 'P4',
    doc: 'docs/projects/PROJECT_04_REGISTRY_CONCURRENCY.md',
    lifts: { patientSafety: 2, clinical: 5 }
  },
  {
    id: 'P5',
    doc: 'docs/projects/PROJECT_05_BACKUP_DR.md',
    lifts: { operational: 8 }
  },
  {
    id: 'P6',
    report: 'docs/security-reports/latest.json',
    lifts: { security: 8 }
  },
  {
    id: 'P7',
    report: 'docs/validation-reports/latest.json',
    lifts: { technical: 8 }
  },
  {
    id: 'P8',
    report: 'docs/clinical-validation-reports/latest.json',
    lifts: { clinical: 8 }
  },
  {
    id: 'P9',
    report: 'docs/governance-reports/latest.json',
    lifts: { operational: 4, security: 2 }
  },
  {
    id: 'P10',
    report: 'docs/go-live-reports/latest.json',
    lifts: { operational: 6 }
  },
  {
    id: 'P11',
    report: 'docs/pilot-reports/latest.json',
    lifts: { operational: 4 }
  }
];

export const AUDIT_VERIFIERS = [
  'verify:gates',
  'verify:backup-dr',
  'verify:security',
  'verify:production',
  'verify:clinical',
  'verify:medicolegal',
  'verify:go-live',
  'verify:pilot'
];

export const HIGH_RISKS = [
  {
    id: 'R1',
    risk: 'Duplicate patient records',
    rank: 'High',
    project: 'P2',
    doc: 'docs/projects/PROJECT_02_DUPLICATE_PATIENTS.md',
    status: 'resolved'
  },
  {
    id: 'R2',
    risk: 'Unencrypted offline IndexedDB',
    rank: 'High',
    project: 'P3',
    doc: 'docs/projects/PROJECT_03_OFFLINE_DATA_SECURITY.md',
    status: 'resolved'
  },
  {
    id: 'R3',
    risk: 'Registry concurrent overwrite',
    rank: 'High',
    project: 'P4',
    doc: 'docs/projects/PROJECT_04_REGISTRY_CONCURRENCY.md',
    status: 'resolved'
  },
  {
    id: 'R4',
    risk: 'Backup verification gaps',
    rank: 'High',
    project: 'P5',
    doc: 'docs/projects/PROJECT_05_BACKUP_DR.md',
    status: 'accepted'
  },
  {
    id: 'R5',
    risk: 'Formal vendor pen-test not executed',
    rank: 'High',
    project: 'P6',
    doc: 'docs/PENTEST_ENGAGEMENT.md',
    status: 'open'
  },
  {
    id: 'R6',
    risk: 'Institutional governance sign-off pending',
    rank: 'High',
    project: 'P9',
    doc: 'docs/projects/PROJECT_09_MEDICOLEGAL_COMPLIANCE.md',
    status: 'accepted'
  }
];

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function readReportStatus(repoRoot, rel) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    return data.status || null;
  } catch {
    return null;
  }
}

export function isProjectComplete(repoRoot, item) {
  if (item.doc) return fileExists(repoRoot, item.doc);
  if (item.report) return readReportStatus(repoRoot, item.report) === 'PASS';
  return false;
}

export function buildProjectCompletion(repoRoot) {
  return Object.fromEntries(
    PROJECT_SCORE_ITEMS.map((item) => [item.id, isProjectComplete(repoRoot, item)])
  );
}

export function computeDimensionScores(projectCompletion) {
  const scores = { ...BASELINE_SCORES };
  for (const item of PROJECT_SCORE_ITEMS) {
    if (!projectCompletion[item.id]) continue;
    for (const [dim, lift] of Object.entries(item.lifts)) {
      scores[dim] = Math.min(100, scores[dim] + lift);
    }
  }
  const dims = ['patientSafety', 'clinical', 'technical', 'operational', 'security'];
  scores.overall = Math.round(dims.reduce((sum, d) => sum + scores[d], 0) / dims.length);
  return scores;
}

export function compareScores(baseline, current) {
  const dims = ['overall', 'patientSafety', 'clinical', 'technical', 'operational', 'security'];
  return dims.map((dim) => ({
    dimension: dim,
    baseline: baseline[dim],
    current: current[dim],
    delta: current[dim] - baseline[dim],
    meetsTarget: current[dim] >= TARGET_SCORE
  }));
}

export function countOpenHighRisks(risks = HIGH_RISKS) {
  return risks.filter((r) => r.rank === 'High' && r.status === 'open').length;
}

export function decideGoLive(currentScores, openHighRisks) {
  const dims = ['patientSafety', 'clinical', 'technical', 'operational', 'security'];
  const allMeetTarget = dims.every((d) => currentScores[d] >= TARGET_SCORE);
  const overallMeetTarget = currentScores.overall >= TARGET_SCORE;

  if (allMeetTarget && overallMeetTarget && openHighRisks === 0) {
    return {
      decision: 'GO',
      reason: 'All readiness dimensions ≥90% and no open High risks'
    };
  }

  if (
    currentScores.overall >= 85 &&
    openHighRisks <= 2 &&
    dims.filter((d) => currentScores[d] < TARGET_SCORE).length <= 2
  ) {
    return {
      decision: 'CONDITIONAL GO',
      reason: `Overall ${currentScores.overall}% with ≤2 open High risks and limited dimension gaps`
    };
  }

  return {
    decision: 'NO GO',
    reason: 'Readiness thresholds not met or too many open High risks'
  };
}

export function checkAuditDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/FINAL_GO_LIVE_AUDIT.md');
  if (doc) return { ok: true, reason: 'docs/FINAL_GO_LIVE_AUDIT.md' };
  return { ok: false, reason: 'FINAL_GO_LIVE_AUDIT.md missing' };
}

export function checkVerifyScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/verify-final-go-live-audit.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"verify:final-audit"')) {
    return { ok: true, reason: 'npm run verify:final-audit' };
  }
  return { ok: false, reason: 'verify-final-go-live-audit.mjs missing' };
}

export function checkRunAuditScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/run-final-go-live-audit.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"audit:final"')) {
    return { ok: true, reason: 'npm run audit:final' };
  }
  return { ok: false, reason: 'run-final-go-live-audit.mjs missing' };
}

export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_12_FINAL_GO_LIVE_AUDIT.md');
  if (doc) return { ok: true, reason: 'docs/projects/PROJECT_12_FINAL_GO_LIVE_AUDIT.md' };
  return { ok: false, reason: 'PROJECT_12 doc missing' };
}

export function checkBaselineReferenced(repoRoot) {
  const audit = readRepoFile(repoRoot, 'docs/FINAL_GO_LIVE_AUDIT.md');
  if (audit.includes('76') && audit.includes('July 2026')) {
    return { ok: true, reason: 'baseline July 2026 scores referenced' };
  }
  return { ok: false, reason: 'baseline comparison missing in audit doc' };
}
