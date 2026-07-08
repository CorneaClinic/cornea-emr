import { query } from '../db/pool.js';
import { ValidationError, NotFoundError } from '../core/errors.js';
import { optionalString } from '../core/validation.js';
import { TEACHING_FLAGS } from '../core/mediaCategories.js';
import {
  getMediaAssetById,
  mapMediaAsset,
  updateMediaAssetMetadata
} from './mediaAssetService.js';
import {
  buildAnonymizedTeachingExport,
  toTeachingCaseListItem
} from './teachingCaseAnonymizer.js';

/**
 * @param {Record<string, unknown>} body
 */
function normalizeTeachingPayload(body) {
  const teaching = {};
  if (body.title !== undefined) teaching.title = optionalString(body.title, 'title');
  if (body.summary !== undefined) teaching.summary = optionalString(body.summary, 'summary');
  if (body.publicDiagnosis !== undefined) {
    teaching.publicDiagnosis = optionalString(body.publicDiagnosis, 'publicDiagnosis');
  }
  if (body.learningObjectives !== undefined) {
    if (!Array.isArray(body.learningObjectives)) {
      throw new ValidationError('learningObjectives must be an array');
    }
    teaching.learningObjectives = body.learningObjectives.map((s) => String(s).trim()).filter(Boolean);
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw new ValidationError('tags must be an array');
    teaching.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  for (const flag of TEACHING_FLAGS) {
    if (body[flag] !== undefined) teaching[flag] = Boolean(body[flag]);
  }
  teaching.teachingCase = body.teachingCase !== undefined ? Boolean(body.teachingCase) : true;
  return teaching;
}

/**
 * @param {string} clinicId
 * @param {Record<string, unknown>} queryParams
 */
export async function listTeachingCases(clinicId, queryParams = {}) {
  const params = [clinicId];
  const filters = [
    'm.clinic_id = $1',
    'm.deleted_at IS NULL',
    'm.archived_at IS NULL',
    'm.status = \'ready\'',
    `(m.category = 'teaching_case' OR COALESCE((m.metadata->'teaching'->>'teachingCase')::boolean, false) = true)`
  ];

  const search = optionalString(queryParams.search, 'search');
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    filters.push(`(
      lower(m.original_filename) LIKE $${params.length}
      OR lower(COALESCE(m.metadata->'teaching'->>'title', '')) LIKE $${params.length}
      OR lower(COALESCE(l.diagnosis_label, '')) LIKE $${params.length}
    )`);
  }

  const tag = optionalString(queryParams.tag, 'tag');
  if (tag) {
    params.push(tag.toLowerCase());
    filters.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(m.metadata->'teaching'->'tags', '[]'::jsonb)) t
      WHERE lower(t) = $${params.length}
    )`);
  }

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
             p.mrn AS patient_mrn,
             v.visit_date,
             v.payload->>'diagnosis' AS visit_diagnosis
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
        LEFT JOIN visits v ON l.entity_type = 'visit' AND v.id = l.entity_id
       WHERE ${filters.join(' AND ')}
       ORDER BY m.created_at DESC
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
    `,
    params.slice(0, -2)
  );

  const anonymize = String(queryParams.anonymize || '').toLowerCase() === 'true';

  return {
    data: rows.map((r) => toTeachingCaseListItem(mapMediaAsset(r), { anonymize })),
    meta: { total: countRes.rows[0]?.total ?? 0, limit, offset, anonymized: anonymize }
  };
}

/**
 * @param {import('express').Request} req
 * @param {string} assetId
 */
export async function getTeachingCase(req, assetId) {
  const asset = await getMediaAssetById(req.user.clinicId, assetId);
  assertTeachingAsset(asset);
  return toTeachingCaseListItem(asset, { anonymize: false });
}

/**
 * @param {Record<string, unknown>} asset
 */
function assertTeachingAsset(asset) {
  const teaching = asset.metadata?.teaching || {};
  if (asset.category !== 'teaching_case' && !teaching.teachingCase) {
    throw new NotFoundError('Asset is not registered as a teaching case');
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} assetId
 * @param {Record<string, unknown>} body
 */
export async function upsertTeachingCaseMetadata(req, assetId, body) {
  const existing = await getMediaAssetById(req.user.clinicId, assetId);
  const patch = normalizeTeachingPayload(body);
  const metadata = {
    ...(existing.metadata || {}),
    teaching: {
      ...(existing.metadata?.teaching || {}),
      ...patch
    }
  };
  const updated = await updateMediaAssetMetadata(req, assetId, { metadata });
  return toTeachingCaseListItem(updated, { anonymize: false });
}

/**
 * @param {import('express').Request} req
 * @param {string} assetId
 */
export async function exportTeachingCase(req, assetId) {
  const asset = await getMediaAssetById(req.user.clinicId, assetId);
  assertTeachingAsset(asset);
  const teaching = asset.metadata?.teaching || {};
  if (teaching.anonymizedSnapshot && typeof teaching.anonymizedSnapshot === 'object') {
    return teaching.anonymizedSnapshot;
  }
  return buildAnonymizedTeachingExport(asset);
}

/**
 * @param {import('express').Request} req
 * @param {string} assetId
 */
export async function publishAnonymizedTeachingCase(req, assetId) {
  const asset = await getMediaAssetById(req.user.clinicId, assetId);
  const snapshot = buildAnonymizedTeachingExport(asset);
  const metadata = {
    ...(asset.metadata || {}),
    teaching: {
      ...(asset.metadata?.teaching || {}),
      teachingCase: true,
      anonymizedSnapshot: snapshot,
      anonymizedAt: new Date().toISOString(),
      anonymizedBy: req.user.sub
    }
  };
  const updated = await updateMediaAssetMetadata(req, assetId, { metadata });
  return {
    published: snapshot,
    asset: toTeachingCaseListItem(updated, { anonymize: false })
  };
}
