import { query } from '../db/pool.js';
import { optionalString, parseEnum, requireUuid } from '../core/validation.js';
import { ValidationError } from '../core/errors.js';
import { MEDIA_CATEGORIES, normalizeCategory } from '../core/mediaCategories.js';
import { mapMediaAsset } from './mediaAssetService.js';

const SORT_FIELDS = ['created_at', 'updated_at', 'byte_size', 'category', 'original_filename'];
const SORT_DIRS = ['asc', 'desc'];

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listMediaLibrary(clinicId, queryParams = {}) {
  const params = [clinicId];
  const filters = ['m.clinic_id = $1', 'm.deleted_at IS NULL'];

  const categoryRaw = optionalString(queryParams.category, 'category');
  if (categoryRaw) {
    const category = normalizeCategory(categoryRaw);
    if (!MEDIA_CATEGORIES.includes(category)) {
      throw new ValidationError(`category must be one of: ${MEDIA_CATEGORIES.join(', ')}`);
    }
    params.push(category);
    filters.push(`m.category = $${params.length}`);
  }

  const search = optionalString(queryParams.search, 'search');
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      lower(m.original_filename) LIKE $${params.length}
      OR lower(COALESCE(l.label, '')) LIKE $${params.length}
      OR lower(COALESCE(l.diagnosis_label, '')) LIKE $${params.length}
      OR lower(COALESCE(l.procedure_label, '')) LIKE $${params.length}
    )`);
  }

  const entityType = parseEnum(queryParams.entityType, 'entityType', ['visit', 'patient', 'keratoplasty_patient', 'corneal_tissue']);
  if (entityType) {
    params.push(entityType);
    filters.push(`l.entity_type = $${params.length}`);
  }

  const patientId = optionalString(queryParams.patientId, 'patientId');
  if (patientId) {
    requireUuid(patientId, 'patientId');
    params.push(patientId);
    filters.push(`(
      (l.entity_type = 'patient' AND l.entity_id = $${params.length}::uuid)
      OR (l.entity_type = 'visit' AND l.entity_id IN (
        SELECT id FROM visits WHERE clinic_id = $1 AND patient_id = $${params.length}::uuid
      ))
    )`);
  }

  if (queryParams.archived === 'true') {
    filters.push('m.archived_at IS NOT NULL');
  } else if (queryParams.archived !== 'all') {
    filters.push('m.archived_at IS NULL');
  }

  if (queryParams.teaching === 'true') {
    filters.push(`COALESCE((m.metadata->'teaching'->>'teachingCase')::boolean, false) = true`);
  }

  const sortField = SORT_FIELDS.includes(String(queryParams.sort || '')) ? String(queryParams.sort) : 'created_at';
  const sortDir = SORT_DIRS.includes(String(queryParams.dir || '').toLowerCase()) ? String(queryParams.dir).toUpperCase() : 'DESC';
  const limit = Math.min(Math.max(parseInt(String(queryParams.limit || '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(queryParams.offset || '0'), 10) || 0, 0);

  params.push(limit, offset);

  const { rows } = await query(
    `
      SELECT m.*,
             l.entity_type AS link_entity_type,
             l.entity_id AS link_entity_id,
             l.eye AS link_eye,
             l.label AS link_label,
             l.sort_order AS link_sort_order,
             l.module_name AS link_module_name,
             l.diagnosis_label AS link_diagnosis_label,
             l.procedure_label AS link_procedure_label,
             l.capture_location AS link_capture_location,
             l.captured_at AS link_captured_at,
             u.full_name AS provider_name,
             p.full_name AS patient_name,
             p.mrn AS patient_mrn
        FROM media_assets m
        LEFT JOIN LATERAL (
          SELECT l2.*
            FROM media_asset_links l2
           WHERE l2.media_asset_id = m.id
           ORDER BY l2.created_at ASC
           LIMIT 1
        ) l ON true
        LEFT JOIN users u ON u.id = l.provider_user_id
        LEFT JOIN patients p ON (
          (l.entity_type = 'patient' AND p.id = l.entity_id)
          OR (l.entity_type = 'visit' AND p.id = (SELECT patient_id FROM visits v WHERE v.id = l.entity_id LIMIT 1))
        )
       WHERE ${filters.join(' AND ')}
         AND m.status = 'ready'
       ORDER BY m.${sortField} ${sortDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  const countRes = await query(
    `
      SELECT COUNT(DISTINCT m.id)::int AS total
        FROM media_assets m
        LEFT JOIN media_asset_links l ON l.media_asset_id = m.id
       WHERE ${filters.join(' AND ')}
         AND m.status = 'ready'
    `,
    params.slice(0, -2)
  );

  return {
    data: rows.map(mapMediaAsset),
    meta: { total: countRes.rows[0]?.total ?? 0, limit, offset }
  };
}

/**
 * Patient cornea timeline — chronological media across visits.
 * @param {string} clinicId
 * @param {string} patientId
 */
export async function getPatientMediaTimeline(clinicId, patientId) {
  const { rows } = await query(
    `
      SELECT m.*,
             l.entity_type AS link_entity_type,
             l.entity_id AS link_entity_id,
             l.eye AS link_eye,
             l.label AS link_label,
             l.sort_order AS link_sort_order,
             l.module_name AS link_module_name,
             l.diagnosis_label AS link_diagnosis_label,
             l.procedure_label AS link_procedure_label,
             l.capture_location AS link_capture_location,
             l.captured_at AS link_captured_at,
             u.full_name AS provider_name,
             v.visit_date,
             v.payload->>'diagnosis' AS visit_diagnosis
        FROM media_assets m
        JOIN media_asset_links l ON l.media_asset_id = m.id
        LEFT JOIN users u ON u.id = l.provider_user_id
        LEFT JOIN visits v ON l.entity_type = 'visit' AND v.id = l.entity_id
       WHERE m.clinic_id = $1
         AND m.deleted_at IS NULL
         AND m.status = 'ready'
         AND m.archived_at IS NULL
         AND (
           (l.entity_type = 'patient' AND l.entity_id = $2)
           OR (l.entity_type = 'visit' AND l.entity_id IN (
             SELECT id FROM visits WHERE clinic_id = $1 AND patient_id = $2
           ))
         )
       ORDER BY COALESCE(l.captured_at, m.created_at) ASC
    `,
    [clinicId, patientId]
  );

  return {
    data: rows.map((row) => ({
      ...mapMediaAsset(row),
      visitDate: row.visit_date,
      visitDiagnosis: row.visit_diagnosis,
      providerName: row.provider_name
    }))
  };
}
