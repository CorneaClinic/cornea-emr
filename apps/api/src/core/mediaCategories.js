/**
 * Clinical media categories — shared across storage, validation, and API.
 * Legacy names (corneal_topography, anterior_drawing) kept for backward compatibility.
 */

export const MEDIA_CATEGORIES = Object.freeze([
  'slit_lamp',
  'corneal_topography',
  'topography',
  'tomography',
  'as_oct',
  'specular',
  'confocal',
  'anterior_drawing',
  'corneal_drawing',
  'operative_photo',
  'video',
  'pdf_report',
  'donor_cornea',
  'referral',
  'teaching_case',
  'research',
  'other'
]);

/** @type {Record<string, string>} UI / legacy alias → canonical category */
export const CATEGORY_ALIASES = Object.freeze({
  document: 'pdf_report',
  pentacam: 'topography',
  orbscan: 'tomography',
  sirius: 'tomography',
  drawing: 'corneal_drawing'
});

/**
 * @param {string} category
 */
export function normalizeCategory(category) {
  const raw = String(category || '').trim().toLowerCase();
  if (CATEGORY_ALIASES[raw]) return CATEGORY_ALIASES[raw];
  return raw;
}

/**
 * Categories permitted per entity type.
 * @type {Record<string, readonly string[]>}
 */
export const ENTITY_CATEGORY_MAP = Object.freeze({
  visit: MEDIA_CATEGORIES.filter((c) => c !== 'donor_cornea'),
  patient: [...MEDIA_CATEGORIES],
  keratoplasty_patient: ['donor_cornea', 'slit_lamp', 'as_oct', 'specular', 'operative_photo', 'pdf_report', 'other'],
  corneal_tissue: ['donor_cornea', 'specular', 'pdf_report', 'other']
});

export const TEACHING_FLAGS = Object.freeze([
  'teachingCase',
  'publicationCandidate',
  'researchCandidate',
  'interestingCase',
  'complication'
]);
