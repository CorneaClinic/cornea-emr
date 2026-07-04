import { TEACHING_FLAGS } from '../core/mediaCategories.js';

const PHI_PATTERNS = [
  /\b\d{10,12}\b/g,
  /\b[\w.-]+@[\w.-]+\.\w+\b/gi,
  /\b(?:MRN|ID|Patient\s*#?)\s*[:#]?\s*[\w-]+\b/gi,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g
];

/**
 * @param {string | null | undefined} text
 */
export function scrubPhiText(text) {
  if (!text) return '';
  let out = String(text);
  for (const re of PHI_PATTERNS) {
    out = out.replace(re, '[redacted]');
  }
  return out.trim();
}

/**
 * @param {string} assetId
 */
export function teachingCaseRef(assetId) {
  return `TC-${String(assetId).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/**
 * @param {{ originalFilename?: string, category?: string, id?: string }} asset
 */
export function anonymizedFilename(asset) {
  const ext = String(asset.originalFilename || 'file').split('.').pop() || 'bin';
  const safeCat = String(asset.category || 'media').replace(/[^a-z0-9_]/gi, '_');
  return `${safeCat}-${String(asset.id || 'asset').slice(0, 8)}.${ext}`;
}

/**
 * Build anonymized teaching export — no patient identifiers.
 * @param {Record<string, unknown>} asset
 */
export function buildAnonymizedTeachingExport(asset) {
  const teaching = asset.metadata?.teaching || {};
  const link = asset.link || {};
  const diagnosis = teaching.publicDiagnosis
    || scrubPhiText(link.diagnosisLabel || asset.visitDiagnosis || '');

  const flags = {};
  for (const key of TEACHING_FLAGS) {
    flags[key] = Boolean(teaching[key]);
  }

  return {
    caseRef: teachingCaseRef(asset.id),
    assetId: asset.id,
    title: teaching.title || diagnosis || asset.category || 'Teaching case',
    category: asset.category,
    eye: link.eye || null,
    diagnosis: diagnosis || null,
    procedure: scrubPhiText(link.procedureLabel || '') || null,
    summary: scrubPhiText(teaching.summary || '') || null,
    learningObjectives: Array.isArray(teaching.learningObjectives)
      ? teaching.learningObjectives.map((s) => scrubPhiText(String(s))).filter(Boolean)
      : [],
    tags: Array.isArray(teaching.tags)
      ? teaching.tags.map((t) => scrubPhiText(String(t))).filter(Boolean)
      : [],
    flags,
    capturedAt: link.capturedAt || asset.createdAt || null,
    mimeType: asset.mimeType,
    filename: anonymizedFilename(asset),
    byteSize: asset.byteSize,
    publishedAt: teaching.anonymizedAt || null
  };
}

/**
 * @param {Record<string, unknown>} asset
 */
export function toTeachingCaseListItem(asset, { anonymize = false } = {}) {
  const teaching = asset.metadata?.teaching || {};
  const base = {
    id: asset.id,
    category: asset.category,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    createdAt: asset.createdAt,
    teaching: {
      title: teaching.title || null,
      summary: teaching.summary || null,
      tags: teaching.tags || [],
      teachingCase: Boolean(teaching.teachingCase),
      hasAnonymizedSnapshot: Boolean(teaching.anonymizedSnapshot),
      anonymizedAt: teaching.anonymizedAt || null
    },
    link: asset.link
      ? {
          eye: asset.link.eye,
          diagnosisLabel: asset.link.diagnosisLabel,
          procedureLabel: asset.link.procedureLabel,
          capturedAt: asset.link.capturedAt
        }
      : undefined
  };

  if (anonymize) {
    const exp = buildAnonymizedTeachingExport(asset);
    return {
      id: asset.id,
      caseRef: exp.caseRef,
      title: exp.title,
      category: exp.category,
      eye: exp.eye,
      diagnosis: exp.diagnosis,
      procedure: exp.procedure,
      tags: exp.tags,
      capturedAt: exp.capturedAt,
      mimeType: exp.mimeType,
      hasPublishedSnapshot: Boolean(teaching.anonymizedSnapshot)
    };
  }

  return {
    ...base,
    patientName: asset.patientName,
    patientMrn: asset.patientMrn,
    visitDiagnosis: asset.visitDiagnosis
  };
}
