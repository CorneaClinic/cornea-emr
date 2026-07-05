import { query, withTransaction } from '../db/pool.js';
import { NotFoundError, ValidationError, ConflictError } from '../core/errors.js';
import {
  optionalString,
  parseDate,
  parseEnum,
  requireUuid,
  requireString,
  formatDate
} from '../core/validation.js';
import { mapPatient, getPatientById } from './patientService.js';
import { auditMutation } from './auditService.js';

const SEX_VALUES = ['Male', 'Female', 'Other'];
const MERGE_ROLES = new Set(['admin', 'cornea_consultant', 'ophthalmologist']);

const TITLE_PREFIXES = /\b(mr|mrs|ms|miss|dr|prof|master|baby|baba|sri|shri|kumari)\.?\s+/gi;

/**
 * @param {unknown} phone
 */
export function normalizePhone(phone) {
  if (phone == null || phone === '') return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

/**
 * @param {unknown} name
 */
export function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(TITLE_PREFIXES, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token overlap similarity (0–1).
 * @param {unknown} a
 * @param {unknown} b
 */
export function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union ? intersection / union : 0;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  const prefixBoost = longer.startsWith(shorter) ? 0.15 : 0;

  return Math.min(1, jaccard + prefixBoost);
}

/**
 * @param {unknown} age
 * @param {unknown} ageUnit
 */
export function ageToApproxDob(age, ageUnit) {
  const num = Number(age);
  if (!Number.isFinite(num) || num < 0) return null;
  const unit = String(ageUnit || 'years').toLowerCase();
  let years = num;
  if (unit === 'months') years = num / 12;
  else if (unit === 'days') years = num / 365.25;
  const d = new Date();
  d.setFullYear(d.getFullYear() - Math.round(years));
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Record<string, unknown>} candidate
 * @param {Record<string, unknown>} row
 */
export function scoreDuplicateMatch(candidate, row) {
  const reasons = [];
  let score = 0;
  let severity = 'low';

  const candMrn = String(candidate.mrn || '').trim();
  const rowMrn = String(row.mrn || '').trim();
  if (candMrn && rowMrn && candMrn === rowMrn) {
    reasons.push('existing_patient');
    return { score: 100, severity: 'info', reasons };
  }

  const candNational = String(candidate.nationalId || '').trim();
  const rowNational = String(row.national_id || row.nationalId || '').trim();
  if (candNational && rowNational && candNational === rowNational) {
    if (candMrn && rowMrn && candMrn !== rowMrn) {
      reasons.push('national_id_cross_mrn');
      return { score: 100, severity: 'block', reasons };
    }
    reasons.push('national_id_match');
    return { score: 95, severity: 'info', reasons };
  }

  const candPhone = normalizePhone(candidate.phone);
  const rowPhone = normalizePhone(row.phone);
  if (candPhone && rowPhone && candPhone.length >= 7 && candPhone === rowPhone) {
    reasons.push('phone_match');
    score += 35;
  }

  const candSex = candidate.sex ? String(candidate.sex) : null;
  const rowSex = row.sex ? String(row.sex) : null;
  if (candSex && rowSex && candSex === rowSex) {
    reasons.push('sex_match');
    score += 10;
  }

  let candDob = candidate.dob || null;
  if (!candDob && candidate.age != null) {
    candDob = ageToApproxDob(candidate.age, candidate.ageUnit);
  }
  const rowDob = row.dob ? formatDate(row.dob) : null;
  if (candDob && rowDob && String(candDob).slice(0, 10) === String(rowDob).slice(0, 10)) {
    reasons.push('dob_match');
    score += 30;
  } else if (candDob && rowDob) {
    const cy = Number(String(candDob).slice(0, 4));
    const ry = Number(String(rowDob).slice(0, 4));
    if (Number.isFinite(cy) && Number.isFinite(ry) && Math.abs(cy - ry) <= 1) {
      reasons.push('dob_year_close');
      score += 15;
    }
  }

  const sim = nameSimilarity(candidate.fullName, row.full_name || row.fullName);
  if (sim >= 0.85) {
    reasons.push('name_very_similar');
    score += 40;
  } else if (sim >= 0.65) {
    reasons.push('name_similar');
    score += 25;
  } else if (sim >= 0.45) {
    reasons.push('name_partial');
    score += 10;
  }

  if (reasons.includes('phone_match') && sim >= 0.65) {
    reasons.push('phone_name_combo');
    score += 15;
  }
  if (reasons.includes('dob_match') && sim >= 0.65) {
    reasons.push('dob_name_combo');
    score += 15;
  }
  if (reasons.includes('sex_match') && reasons.includes('dob_match') && sim >= 0.55) {
    reasons.push('demographics_name_combo');
    score += 10;
  }

  score = Math.min(99, score);
  if (score >= 75) severity = 'high';
  else if (score >= 50) severity = 'medium';
  else if (score >= 30) severity = 'low';
  else severity = 'none';

  return { score, severity, reasons, nameSimilarity: sim };
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ score: number, severity: string, reasons: string[], nameSimilarity?: number }} match
 */
function mapDuplicateResult(row, match) {
  return {
    patient: mapPatient(row),
    visitCount: Number(row.visit_count || 0),
    score: match.score,
    severity: match.severity,
    reasons: match.reasons,
    nameSimilarity: match.nameSimilarity ?? null
  };
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} candidate
 */
export async function findDuplicatePatients(clinicId, candidate) {
  const mrn = optionalString(candidate.mrn, 'mrn');
  const fullName = optionalString(candidate.fullName, 'fullName');
  const nationalId = optionalString(candidate.nationalId, 'nationalId');
  const phone = optionalString(candidate.phone, 'phone');
  const sex = candidate.sex != null ? parseEnum(candidate.sex, 'sex', SEX_VALUES) : null;
  const excludePatientId = candidate.excludePatientId
    ? requireUuid(candidate.excludePatientId, 'excludePatientId')
    : null;

  let dob = null;
  if (candidate.dob) {
    dob = parseDate(candidate.dob, 'dob');
  } else if (candidate.age != null) {
    dob = ageToApproxDob(candidate.age, candidate.ageUnit);
  }

  if (!mrn && !fullName && !nationalId && !phone && !dob) {
    throw new ValidationError('At least one of mrn, fullName, nationalId, phone, or dob/age is required');
  }

  const params = [clinicId];
  const clauses = ['p.clinic_id = $1'];
  const orParts = [];

  if (mrn) {
    params.push(mrn);
    orParts.push(`p.mrn = $${params.length}`);
  }
  if (nationalId) {
    params.push(nationalId);
    orParts.push(`p.national_id = $${params.length}`);
  }
  const phoneNorm = normalizePhone(phone);
  if (phoneNorm && phoneNorm.length >= 7) {
    params.push(`%${phoneNorm}`);
    orParts.push(`regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') LIKE $${params.length}`);
  }
  if (dob) {
    params.push(dob);
    orParts.push(`p.dob = $${params.length}`);
  }
  if (fullName) {
    const token = normalizeName(fullName).split(' ').filter((t) => t.length > 2)[0];
    if (token) {
      params.push(`%${token}%`);
      orParts.push(`p.full_name ILIKE $${params.length}`);
    }
  }

  if (!orParts.length) {
    return { matches: [], hasBlocker: false, highestSeverity: 'none' };
  }

  clauses.push(`(${orParts.join(' OR ')})`);
  if (excludePatientId) {
    params.push(excludePatientId);
    clauses.push(`p.id != $${params.length}`);
  }

  const { rows: patientRows } = await query(
    `
      SELECT p.*,
             (SELECT COUNT(*)::int FROM visits v WHERE v.patient_id = p.id AND v.status != 'cancelled') AS visit_count
        FROM patients p
       WHERE ${clauses.join(' AND ')}
       LIMIT 50
    `,
    params
  );

  const byId = new Map(patientRows.map((r) => [r.id, r]));

  if (nationalId) {
    const { rows: payloadRows } = await query(
      `
        SELECT DISTINCT p.*,
               (SELECT COUNT(*)::int FROM visits v WHERE v.patient_id = p.id AND v.status != 'cancelled') AS visit_count
          FROM visits v
          JOIN patients p ON p.id = v.patient_id
         WHERE v.clinic_id = $1
           AND btrim(coalesce(v.payload->>'nationalId', '')) = $2
           ${excludePatientId ? 'AND p.id != $3' : ''}
         LIMIT 20
      `,
      excludePatientId ? [clinicId, nationalId, excludePatientId] : [clinicId, nationalId]
    );
    for (const row of payloadRows) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }

  const scored = [];
  for (const row of byId.values()) {
    const match = scoreDuplicateMatch(candidate, row);
    if (match.severity === 'none') continue;
    scored.push(mapDuplicateResult(row, match));
  }

  scored.sort((a, b) => b.score - a.score || b.visitCount - a.visitCount);

  const hasBlocker = scored.some((m) => m.severity === 'block');
  const highestSeverity = scored[0]?.severity || 'none';

  return { matches: scored, hasBlocker, highestSeverity };
}

/**
 * @param {import('express').Request} req
 * @param {string} targetPatientId
 * @param {string} sourcePatientId
 * @param {Record<string, unknown>} body
 */
export async function mergePatients(req, targetPatientId, sourcePatientId, body) {
  const role = req.user.role;
  if (!MERGE_ROLES.has(role)) {
    throw new ValidationError('Patient merge requires admin, cornea consultant, or ophthalmologist role');
  }

  requireUuid(targetPatientId, 'targetPatientId');
  requireUuid(sourcePatientId, 'sourcePatientId');
  if (targetPatientId === sourcePatientId) {
    throw new ValidationError('Cannot merge a patient into itself');
  }

  const confirm = body?.confirm === true || body?.confirm === 'true';
  if (!confirm) {
    throw new ValidationError('Merge requires confirm: true in request body');
  }

  const clinicId = req.user.clinicId;
  const target = await getPatientById(clinicId, targetPatientId);
  const source = await getPatientById(clinicId, sourcePatientId);

  const keepMrn = body?.keepMrn != null ? requireString(body.keepMrn, 'keepMrn') : target.mrn;
  if (keepMrn !== target.mrn && keepMrn !== source.mrn) {
    throw new ValidationError('keepMrn must match target or source patient MRN');
  }

  const merged = await withTransaction(async (client) => {
    await client.query(
      `UPDATE visits SET patient_id = $1, updated_by = $2, revision = revision + 1
        WHERE clinic_id = $3 AND patient_id = $4`,
      [targetPatientId, req.user.sub, clinicId, sourcePatientId]
    );

    await client.query(
      `UPDATE appointments SET patient_id = $1 WHERE clinic_id = $2 AND patient_id = $3`,
      [targetPatientId, clinicId, sourcePatientId]
    );

    for (const table of [
      'kc_registry_patients',
      'keratoplasty_patients',
      'keratitis_ulcer_cases',
      'dry_eye_cases'
    ]) {
      await client.query(
        `UPDATE ${table}
            SET emr_patient_uuid = $1
          WHERE clinic_id = $2 AND emr_patient_uuid = $3`,
        [targetPatientId, clinicId, sourcePatientId]
      );
    }

    const mergedName = target.fullName || source.fullName;
    const mergedDob = target.dob || source.dob;
    const mergedSex = target.sex || source.sex;
    const mergedPhone = target.phone || source.phone;
    const mergedAddress = target.address || source.address;
    const mergedNational = target.nationalId || source.nationalId || null;

    const { rows } = await client.query(
      `
        UPDATE patients
           SET mrn = $3,
               full_name = $4,
               dob = $5,
               sex = $6,
               phone = $7,
               address = $8,
               national_id = $9,
               revision = revision + 1
         WHERE id = $1 AND clinic_id = $2
         RETURNING *
      `,
      [
        targetPatientId,
        clinicId,
        keepMrn,
        mergedName,
        mergedDob,
        mergedSex,
        mergedPhone,
        mergedAddress,
        mergedNational
      ]
    );

    await client.query(`DELETE FROM patients WHERE id = $1 AND clinic_id = $2`, [
      sourcePatientId,
      clinicId
    ]);

    return rows[0];
  });

  if (!merged) throw new NotFoundError('Merge failed — target patient not found');

  await auditMutation(req, 'patient', targetPatientId, 'merge', {
    sourcePatientId,
    sourceMrn: source.mrn,
    targetMrn: target.mrn,
    keptMrn: keepMrn
  });

  return mapPatient(merged);
}
