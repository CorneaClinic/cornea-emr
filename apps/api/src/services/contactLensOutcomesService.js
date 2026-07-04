import { query } from '../db/pool.js';

/**
 * Parse contactLensJSON from visit payload (string or object).
 * @param {unknown} raw
 */
export function parseContactLensRaw(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '{}') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Mirrors clinic cornea-contact-lens.js hasContactLensData().
 * @param {unknown} raw
 */
export function hasContactLensData(raw) {
  const p = typeof raw === 'object' && raw !== null ? raw : parseContactLensRaw(raw);
  if (!p?.fit) return false;
  if ((p.fit.indication || []).length) return true;
  if ((p.fit.complications || []).length) return true;
  if ((p.history || []).length) return true;
  const od = p.fit.finalRx?.od || {};
  const os = p.fit.finalRx?.os || {};
  return [...Object.values(od), ...Object.values(os)].some((v) => String(v ?? '').trim());
}

function eyeRxSummary(eye) {
  if (!eye || typeof eye !== 'object') return '';
  const parts = ['baseCurve', 'power', 'diameter', 'brand']
    .map((k) => eye[k])
    .filter((v) => String(v ?? '').trim());
  return parts.join(' / ');
}

/**
 * Flat summary row for research cohort export.
 * @param {Record<string, unknown>} parsed
 */
export function summarizeContactLensFit(parsed) {
  const fit = parsed?.fit || {};
  const sharedSel = fit.lensSelection?.shared || {};
  const sharedRx = fit.finalRx?.shared || {};
  const lensType = sharedRx.lensType || sharedSel.lensType || '';
  const odRx = eyeRxSummary(fit.finalRx?.od);
  const osRx = eyeRxSummary(fit.finalRx?.os);
  const checklist = fit.dispensing?.checklist || [];
  const solutions = fit.dispensing?.solutions || [];
  const dispensingDocumented = checklist.length > 0 || solutions.length > 0;

  return {
    indications: (fit.indication || []).join('; ') || '—',
    lensType: lensType || '—',
    wearingSchedule: sharedSel.wearingSchedule || sharedRx.wearingSchedule || '—',
    finalRxOd: odRx || '—',
    finalRxOs: osRx || '—',
    complications: (fit.complications || []).join('; ') || '—',
    followUpInterval: fit.followUp?.interval || '—',
    dispensingDocumented: dispensingDocumented ? 'Yes' : 'No',
    historyEntries: (parsed.history || []).length
  };
}

/**
 * @param {string} clinicId
 */
export async function getContactLensOverview(clinicId) {
  const { rows } = await query(
    `
      SELECT v.patient_id, v.payload
      FROM visits v
     WHERE v.clinic_id = $1
       AND v.status != 'cancelled'
       AND v.payload ? 'contactLensJSON'
    `,
    [clinicId]
  );

  let visitCount = 0;
  const byLensType = {};
  let withComplications = 0;
  let dispensingDocumented = 0;
  const patientIds = new Set();

  for (const row of rows) {
    const raw = row.payload?.contactLensJSON;
    if (!hasContactLensData(raw)) continue;

    visitCount += 1;
    patientIds.add(row.patient_id);
    const parsed = parseContactLensRaw(raw);
    const summary = summarizeContactLensFit(parsed);
    const type = summary.lensType === '—' ? 'Unknown' : summary.lensType;
    byLensType[type] = (byLensType[type] || 0) + 1;
    if (summary.complications !== '—') withComplications += 1;
    if (summary.dispensingDocumented === 'Yes') dispensingDocumented += 1;
  }

  return {
    visitCount,
    uniquePatients: patientIds.size,
    withComplications,
    dispensingDocumented,
    byLensType
  };
}

/**
 * @param {string} clinicId
 * @param {{ limit?: number }} [options]
 */
export async function listContactLensOutcomes(clinicId, options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 500, 1), 2000);

  const { rows } = await query(
    `
      SELECT
        v.id AS visit_id,
        v.visit_date,
        v.legacy_local_id,
        v.payload,
        p.mrn,
        p.full_name
      FROM visits v
      JOIN patients p ON p.id = v.patient_id AND p.clinic_id = v.clinic_id
     WHERE v.clinic_id = $1
       AND v.status != 'cancelled'
       AND v.payload ? 'contactLensJSON'
     ORDER BY v.visit_date DESC NULLS LAST, v.updated_at DESC
     LIMIT $2
    `,
    [clinicId, limit * 3]
  );

  const outcomes = [];
  for (const row of rows) {
    const raw = row.payload?.contactLensJSON;
    if (!hasContactLensData(raw)) continue;

    const parsed = parseContactLensRaw(raw);
    const summary = summarizeContactLensFit(parsed);
    outcomes.push({
      visitId: row.visit_id,
      visitDate: row.visit_date,
      legacyLocalId: row.legacy_local_id,
      mrn: row.mrn,
      fullName: row.full_name,
      emrMrn: row.mrn,
      ...summary
    });
    if (outcomes.length >= limit) break;
  }

  return outcomes;
}
