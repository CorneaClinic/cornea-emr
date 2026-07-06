#!/usr/bin/env node
/**
 * Project 8 — clinical validation helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export const CLINICAL_WORKFLOWS = [
  {
    id: 'W01',
    name: 'Cornea clinic (core)',
    uiTab: 'formTab',
    staticFiles: ['apps/clinic/js/patient-form.js', 'apps/clinic/js/visits.js'],
    api: { method: 'GET', path: '/api/v1/dashboard/kpis' }
  },
  {
    id: 'W02',
    name: 'Contact lens',
    htmlMarker: 'CorneaContactLens',
    staticFiles: ['apps/clinic/cornea-contact-lens.js']
  },
  {
    id: 'W03',
    name: 'Scleral lens',
    htmlMarker: 'scleralLensBuilder',
    staticFiles: ['apps/clinic/cornea-scleral-lens.js']
  },
  {
    id: 'W04',
    name: 'Laser refractive',
    htmlMarker: 'section-laser-refractive',
    staticFiles: ['apps/clinic/cornea-laser-refractive.js', 'apps/clinic/cornea-ectasia-ai.js'],
    api: {
      method: 'POST',
      path: '/api/v1/ectasia-ai/analyze',
      body: {
        useV2: true,
        od: { badD: 1.3, kmax: 45 },
        os: { badD: 1.1, kmax: 44 },
        shared: { age: 25 }
      }
    }
  },
  {
    id: 'W05',
    name: 'Corneal ulcer (keratitis)',
    uiTab: 'keratitisTab',
    staticFiles: ['apps/clinic/cornea-keratitis.js'],
    api: { method: 'GET', path: '/api/v1/keratitis-registry/overview' }
  },
  {
    id: 'W06',
    name: 'Dry eye / OSD',
    uiTab: 'dryEyeTab',
    staticFiles: ['apps/clinic/cornea-dry-eye.js'],
    api: { method: 'GET', path: '/api/v1/dry-eye-registry/overview' }
  },
  {
    id: 'W07',
    name: 'Keratoconus',
    uiTab: 'kcRegistryTab',
    staticFiles: ['apps/clinic/cornea-kc-cxl.js'],
    api: { method: 'GET', path: '/api/v1/kc-registry/overview' }
  },
  {
    id: 'W08',
    name: 'Cross-linking (CXL)',
    htmlMarker: 'openKcCxlModal',
    staticFiles: ['apps/clinic/cornea-kc-cxl.js']
  },
  {
    id: 'W09',
    name: 'Keratoplasty',
    uiTab: 'keratoplastyTab',
    staticFiles: ['apps/clinic/cornea-kp-graft-outcomes.js'],
    api: { method: 'GET', path: '/api/v1/keratoplasty-patients/overview' }
  },
  {
    id: 'W10',
    name: 'Eye bank traceability',
    htmlMarker: 'eyeBankOfflineBanner',
    staticFiles: ['apps/clinic/cornea-eye-bank-traceability.js'],
    api: { method: 'GET', path: '/api/v1/eye-bank/overview' }
  },
  {
    id: 'W11',
    name: 'Opinion & referral',
    staticFiles: ['apps/clinic/cornea-opinion-referral.js', 'apps/clinic/cornea-teaching-library.js'],
    api: { method: 'GET', path: '/api/v1/teaching-cases?limit=1' }
  }
];

export function fileExists(repoRoot, rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

export function readRepoFile(repoRoot, rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

export function checkWorkflowDefinitions() {
  if (CLINICAL_WORKFLOWS.length === 11) {
    return { ok: true, reason: '11 cornea subspecialty workflows defined' };
  }
  return { ok: false, reason: `expected 11 workflows, found ${CLINICAL_WORKFLOWS.length}` };
}

export function checkWorkflowStaticModules(repoRoot) {
  const missing = [];
  for (const wf of CLINICAL_WORKFLOWS) {
    for (const rel of wf.staticFiles || []) {
      if (!fileExists(repoRoot, rel)) missing.push(`${wf.id}:${rel}`);
    }
  }
  if (!missing.length) {
    return { ok: true, reason: 'all workflow static modules present' };
  }
  return { ok: false, reason: `missing: ${missing.slice(0, 3).join(', ')}` };
}

export function checkWorkflowUiMarkers(repoRoot) {
  const html = readRepoFile(repoRoot, 'apps/clinic/Cornea.html');
  const missing = [];
  for (const wf of CLINICAL_WORKFLOWS) {
    if (wf.uiTab && !html.includes(`id="${wf.uiTab}"`)) {
      missing.push(`${wf.id}:${wf.uiTab}`);
    }
    if (wf.htmlMarker && !html.includes(wf.htmlMarker)) {
      missing.push(`${wf.id}:${wf.htmlMarker}`);
    }
  }
  if (!missing.length) {
    return { ok: true, reason: 'workflow UI tabs/markers in Cornea.html' };
  }
  return { ok: false, reason: `missing markers: ${missing.join(', ')}` };
}

export function checkPrintingSupport(repoRoot) {
  const html = readRepoFile(repoRoot, 'apps/clinic/Cornea.html');
  const hasPrint = html.includes('printSummary') && html.includes('@media print');
  if (hasPrint) {
    return { ok: true, reason: 'printSummary + print CSS' };
  }
  return { ok: false, reason: 'print workflow not found in Cornea.html' };
}

export function checkMediaPlatform(repoRoot) {
  const clinic = fileExists(repoRoot, 'apps/clinic/cornea-clinical-media.js');
  const api = readRepoFile(repoRoot, 'apps/api/src/routes/v1.js');
  const wired =
    api.includes('/media-library') &&
    api.includes('/dicom') &&
    readRepoFile(repoRoot, 'apps/clinic/Cornea.html').includes('clinicalMediaTab');
  if (clinic && wired) {
    return { ok: true, reason: 'clinical media tab + library/DICOM API' };
  }
  return { ok: false, reason: 'media platform incomplete' };
}

export function checkSimulationScript(repoRoot) {
  const script = fileExists(repoRoot, 'scripts/clinical-workflow-simulation.mjs');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (script && pkg.includes('"clinical:simulate"')) {
    return { ok: true, reason: 'npm run clinical:simulate' };
  }
  return { ok: false, reason: 'clinical-workflow-simulation.mjs missing' };
}

export function checkClinicalE2e(repoRoot) {
  const spec = fileExists(repoRoot, 'e2e/clinical-validation.spec.js');
  const cfg = fileExists(repoRoot, 'playwright.clinical.config.js');
  const pkg = readRepoFile(repoRoot, 'package.json');
  if (spec && cfg && pkg.includes('"test:e2e:clinical"')) {
    return { ok: true, reason: 'clinical-validation.spec.js + test:e2e:clinical' };
  }
  return { ok: false, reason: 'clinical e2e missing' };
}

export function checkProjectDoc(repoRoot) {
  const doc = fileExists(repoRoot, 'docs/projects/PROJECT_08_CLINICAL_VALIDATION.md');
  if (doc) {
    return { ok: true, reason: 'docs/projects/PROJECT_08_CLINICAL_VALIDATION.md' };
  }
  return { ok: false, reason: 'PROJECT_08 doc missing' };
}

export async function probeWorkflowApi(apiUrl, token, workflow, deviceId = 'clinical-validation') {
  const api = workflow.api;
  if (!api) {
    return { ok: true, skipped: true, reason: 'static-only workflow' };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Device-Id': deviceId,
    'Content-Type': 'application/json'
  };

  try {
    const init = {
      method: api.method,
      headers,
      signal: AbortSignal.timeout(25_000)
    };
    if (api.body) init.body = JSON.stringify(api.body);
    const res = await fetch(`${apiUrl}${api.path}`, init);
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    await res.json().catch(() => ({}));
    return { ok: true, reason: `${api.method} ${api.path}` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function runLiveWorkflowProbes(apiUrl, token) {
  const withApi = CLINICAL_WORKFLOWS.filter((w) => w.api);
  const results = [];
  for (const wf of withApi) {
    const probe = await probeWorkflowApi(apiUrl, token, wf);
    results.push({ id: wf.id, name: wf.name, ...probe });
  }
  const pass = results.every((r) => r.ok || r.skipped);
  const failed = results.filter((r) => !r.ok && !r.skipped);
  return {
    ok: pass,
    reason: pass
      ? `${results.length} API workflow probes OK`
      : `${failed.length} failed (${failed.map((f) => f.id).join(', ')})`,
    results
  };
}

export async function probeMediaLibrary(apiUrl, token) {
  try {
    const res = await fetch(`${apiUrl}/api/v1/media-library?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': 'clinical-validation' },
      signal: AbortSignal.timeout(25_000)
    });
    if (!res.ok) return { ok: false, reason: `media-library HTTP ${res.status}` };
    const body = await res.json();
    if (!Array.isArray(body.data)) return { ok: false, reason: 'unexpected media-library shape' };
    return { ok: true, reason: `media-library OK (${body.data.length} items)` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
