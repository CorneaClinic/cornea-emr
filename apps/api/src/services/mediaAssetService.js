import { randomUUID } from 'crypto';
import { query, withTransaction } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../core/errors.js';
import {
  optionalString,
  optionalInt,
  parseEnum,
  requireUuid
} from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { assertVisitAccessible } from './visitService.js';
import { getPatientById } from './patientService.js';
import { getKeratoplastyPatientById } from './keratoplastyPatientService.js';
import { getCornealTissueById } from './cornealTissueService.js';
import {
  assertCategoryForEntity,
  assertFileSizeForCategory,
  buildStorageKey,
  computeChecksum,
  deleteStorageFile,
  getStorageSignedUrl,
  isAllowedMimeType,
  normalizeCategory,
  readStorageFile,
  writeStorageFile
} from './fileStorageService.js';
import { env } from '../config/env.js';
import { scanUploadBuffer } from './virusScanService.js';

const ENTITY_TYPES = ['visit', 'patient', 'keratoplasty_patient', 'corneal_tissue'];
const EYE_VALUES = ['OD', 'OS', 'OU', 'right', 'left', 'both'];

/**
 * @param {Record<string, unknown>} row
 */
export function mapMediaAsset(row) {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    category: row.category,
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    storageProvider: row.storage_provider,
    bucket: row.bucket,
    etag: row.etag,
    thumbnailKey: row.thumbnail_key,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    metadata: row.metadata || {},
    status: row.status,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    patientName: row.patient_name,
    patientMrn: row.patient_mrn,
    providerName: row.provider_name,
    visitDate: row.visit_date,
    visitDiagnosis: row.visit_diagnosis,
    link: row.link_entity_type
      ? {
          entityType: row.link_entity_type,
          entityId: row.link_entity_id,
          eye: row.link_eye,
          label: row.link_label,
          sortOrder: row.link_sort_order,
          moduleName: row.link_module_name,
          diagnosisLabel: row.link_diagnosis_label,
          procedureLabel: row.link_procedure_label,
          captureLocation: row.link_capture_location,
          capturedAt: row.link_captured_at
        }
      : undefined
  };
}

/**
 * @param {string} clinicId
 * @param {string} entityType
 * @param {string} entityId
 */
export async function assertEntityAccessible(clinicId, entityType, entityId) {
  requireUuid(entityId, 'entityId');
  const type = parseEnum(entityType, 'entityType', ENTITY_TYPES);
  if (!type) throw new ValidationError('Invalid entityType');

  switch (type) {
    case 'visit':
      return assertVisitAccessible(clinicId, entityId);
    case 'patient':
      return getPatientById(clinicId, entityId);
    case 'keratoplasty_patient':
      return getKeratoplastyPatientById(clinicId, entityId);
    case 'corneal_tissue':
      return getCornealTissueById(clinicId, entityId);
    default:
      throw new ValidationError('Unsupported entityType');
  }
}

/**
 * @param {string} clinicId
 * @param {string} entityType
 * @param {string} entityId
 * @param {Record<string, unknown>} queryParams
 */
export async function listMediaForEntity(clinicId, entityType, entityId, queryParams = {}) {
  await assertEntityAccessible(clinicId, entityType, entityId);

  const params = [clinicId, entityType, entityId];
  const filters = [
    'm.clinic_id = $1',
    'l.entity_type = $2',
    'l.entity_id = $3',
    'm.deleted_at IS NULL',
    "m.status = 'ready'"
  ];

  const category = parseEnum(queryParams.category, 'category', env.media.categories);
  if (category) {
    params.push(category);
    filters.push(`m.category = $${params.length}`);
  }

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
             l.captured_at AS link_captured_at
        FROM media_asset_links l
        JOIN media_assets m ON m.id = l.media_asset_id
       WHERE ${filters.join(' AND ')}
       ORDER BY l.sort_order ASC, m.created_at ASC
    `,
    params
  );

  return { data: rows.map(mapMediaAsset) };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getMediaAssetById(clinicId, id) {
  requireUuid(id, 'id');
  const { rows } = await query(
    `
      SELECT m.*,
             l.entity_type AS link_entity_type,
             l.entity_id AS link_entity_id,
             l.eye AS link_eye,
             l.label AS link_label,
             l.sort_order AS link_sort_order
        FROM media_assets m
        LEFT JOIN media_asset_links l ON l.media_asset_id = m.id
       WHERE m.id = $1 AND m.clinic_id = $2 AND m.deleted_at IS NULL
       LIMIT 1
    `,
    [id, clinicId]
  );
  if (!rows[0] || rows[0].status === 'deleted') {
    throw new NotFoundError('Media asset not found');
  }
  return mapMediaAsset(rows[0]);
}

/**
 * @param {string} clinicId
 * @param {string} checksum
 * @param {string} [excludeId]
 */
export async function findDuplicateByChecksum(clinicId, checksum, excludeId) {
  const params = [clinicId, checksum];
  let sql = `
    SELECT id, original_filename, created_at
      FROM media_assets
     WHERE clinic_id = $1 AND checksum = $2 AND deleted_at IS NULL
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }
  sql += ' LIMIT 1';
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

/**
 * @param {import('express').Request} req
 * @param {object} options
 * @param {string} options.entityType
 * @param {string} options.entityId
 * @param {string} options.category
 * @param {Buffer} options.buffer
 * @param {string} options.originalFilename
 * @param {string} options.mimeType
 * @param {string} [options.eye]
 * @param {string} [options.label]
 * @param {number} [options.sortOrder]
 * @param {Record<string, unknown>} [options.metadata]
 * @param {string} [options.moduleName]
 * @param {string} [options.diagnosisLabel]
 * @param {string} [options.procedureLabel]
 * @param {string} [options.captureLocation]
 * @param {string} [options.capturedAt]
 * @param {boolean} [options.allowDuplicate]
 */
export async function uploadMediaForEntity(req, options) {
  const clinicId = req.user.clinicId;
  const userId = req.user.sub;
  const {
    entityType,
    entityId,
    category: rawCategory,
    buffer,
    originalFilename,
    mimeType,
    eye,
    label,
    sortOrder,
    metadata,
    moduleName,
    diagnosisLabel,
    procedureLabel,
    captureLocation,
    capturedAt,
    allowDuplicate
  } = options;

  if (!buffer || !buffer.length) {
    throw new ValidationError('File is empty');
  }

  const category = normalizeCategory(rawCategory);
  assertFileSizeForCategory(category, buffer.length);

  if (!isAllowedMimeType(mimeType)) {
    throw new ValidationError(`MIME type not allowed: ${mimeType}`);
  }

  assertCategoryForEntity(entityType, category);
  await assertEntityAccessible(clinicId, entityType, entityId);

  const parsedEye = eye ? parseEnum(eye, 'eye', EYE_VALUES) : null;
  const parsedLabel = optionalString(label, 'label');
  const parsedSortOrder = optionalInt(sortOrder, 'sortOrder') ?? 0;
  const parsedModule = optionalString(moduleName, 'moduleName');
  const parsedDiagnosis = optionalString(diagnosisLabel, 'diagnosisLabel');
  const parsedProcedure = optionalString(procedureLabel, 'procedureLabel');
  const parsedLocation = optionalString(captureLocation, 'captureLocation');
  const parsedCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
  if (capturedAt && Number.isNaN(parsedCapturedAt.getTime())) {
    throw new ValidationError('Invalid capturedAt');
  }

  const checksum = computeChecksum(buffer);
  const duplicate = await findDuplicateByChecksum(clinicId, checksum);
  if (duplicate && !allowDuplicate) {
    throw new ValidationError(
      `Duplicate file already uploaded (${duplicate.original_filename}, ${duplicate.id})`
    );
  }

  const assetId = randomUUID();
  await scanUploadBuffer({
    buffer,
    mimeType,
    originalFilename,
    clinicId,
    assetId,
    checksum
  });

  const storageKey = buildStorageKey(clinicId, category, assetId, originalFilename);

  const asset = await withTransaction(async (client) => {
    const inserted = await client.query(
      `
        INSERT INTO media_assets (
          id, clinic_id, category, original_filename, storage_key,
          storage_provider, bucket, mime_type, byte_size, checksum, metadata,
          status, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, 'local', NULL, $6, $7, $8, $9, 'pending', $10, $10)
        RETURNING *
      `,
      [
        assetId,
        clinicId,
        category,
        originalFilename,
        storageKey,
        mimeType,
        buffer.length,
        checksum,
        metadata || {},
        userId
      ]
    );

    await client.query(
      `
        INSERT INTO media_asset_links (
          media_asset_id, clinic_id, entity_type, entity_id, eye, label, sort_order,
          module_name, diagnosis_label, procedure_label, provider_user_id,
          capture_location, captured_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        assetId,
        clinicId,
        entityType,
        entityId,
        parsedEye,
        parsedLabel,
        parsedSortOrder,
        parsedModule,
        parsedDiagnosis,
        parsedProcedure,
        userId,
        parsedLocation,
        parsedCapturedAt
      ]
    );

    if (entityType === 'visit' && (category === 'anterior_drawing' || category === 'corneal_drawing')) {
      if (mimeType === 'image/png') {
        await client.query(
          `
            INSERT INTO drawings (visit_id, clinic_id, annotation_json, png_media_asset_id, mime_type)
            VALUES ($1, $2, '{}', $3, 'image/png')
            ON CONFLICT (visit_id) DO UPDATE SET
              png_media_asset_id = EXCLUDED.png_media_asset_id,
              revision = drawings.revision + 1
          `,
          [entityId, clinicId, assetId]
        );
      } else if (mimeType === 'image/svg+xml') {
        await client.query(
          `
            INSERT INTO drawings (visit_id, clinic_id, annotation_json, svg_media_asset_id, mime_type)
            VALUES ($1, $2, '{}', $3, 'image/svg+xml')
            ON CONFLICT (visit_id) DO UPDATE SET
              svg_media_asset_id = EXCLUDED.svg_media_asset_id,
              mime_type = 'image/svg+xml',
              revision = drawings.revision + 1
          `,
          [entityId, clinicId, assetId]
        );
      }
    }

    return inserted.rows[0];
  });

  try {
    const stored = await writeStorageFile(storageKey, buffer, mimeType);
    await query(
      `
        UPDATE media_assets
           SET status = 'ready',
               storage_provider = $3,
               bucket = $4,
               etag = $5,
               updated_at = now()
         WHERE id = $1 AND clinic_id = $2
      `,
      [assetId, clinicId, stored.provider, stored.bucket, stored.etag]
    );
  } catch (err) {
    await query(
      `UPDATE media_assets SET status = 'deleted', deleted_at = now() WHERE id = $1`,
      [assetId]
    );
    throw err;
  }

  const refreshed = await getMediaAssetById(clinicId, assetId);

  await auditMutation(req, 'media_asset', refreshed.id, 'upload', {
    category,
    entityType,
    entityId,
    byteSize: refreshed.byteSize,
    mimeType: refreshed.mimeType,
    storageProvider: refreshed.storageProvider,
    duplicateOf: duplicate?.id || null
  });

  return refreshed;
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getMediaAssetContent(clinicId, id) {
  const asset = await getMediaAssetById(clinicId, id);
  const buffer = await readStorageFile(asset.storageKey);
  return { asset, buffer };
}

/**
 * @param {string} clinicId
 * @param {string} id
 */
export async function getMediaAssetSignedUrl(clinicId, id) {
  const asset = await getMediaAssetById(clinicId, id);
  const url = await getStorageSignedUrl(asset.storageKey, asset.mimeType);
  return { asset, url };
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function archiveMediaAsset(req, id) {
  const clinicId = req.user.clinicId;
  await getMediaAssetById(clinicId, id);
  await query(
    `
      UPDATE media_assets
         SET archived_at = now(),
             updated_by = $3,
             revision = revision + 1
       WHERE id = $1 AND clinic_id = $2 AND deleted_at IS NULL
    `,
    [id, clinicId, req.user.sub]
  );
  await auditMutation(req, 'media_asset', id, 'archive', {});
  return getMediaAssetById(clinicId, id);
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function restoreMediaAsset(req, id) {
  const clinicId = req.user.clinicId;
  await getMediaAssetById(clinicId, id);
  await query(
    `
      UPDATE media_assets
         SET archived_at = NULL,
             updated_by = $3,
             revision = revision + 1
       WHERE id = $1 AND clinic_id = $2
    `,
    [id, clinicId, req.user.sub]
  );
  await auditMutation(req, 'media_asset', id, 'restore', {});
  return getMediaAssetById(clinicId, id);
}

/**
 * @param {import('express').Request} req
 * @param {string} id
 */
export async function deleteMediaAsset(req, id) {
  const clinicId = req.user.clinicId;
  const asset = await getMediaAssetById(clinicId, id);

  await query(
    `
      UPDATE media_assets
         SET status = 'deleted',
             deleted_at = now(),
             updated_by = $3,
             revision = revision + 1
       WHERE id = $1 AND clinic_id = $2
    `,
    [id, clinicId, req.user.sub]
  );

  await deleteStorageFile(asset.storageKey);

  await auditMutation(req, 'media_asset', id, 'delete', {
    category: asset.category,
    storageKey: asset.storageKey
  });

  return { id, deleted: true };
}

/**
 * @param {string} clinicId
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateMediaAssetMetadata(req, id, body) {
  const clinicId = req.user.clinicId;
  const existing = await getMediaAssetById(clinicId, id);

  const eye = body.eye !== undefined ? parseEnum(body.eye, 'eye', EYE_VALUES) : undefined;
  const label = body.label !== undefined ? optionalString(body.label, 'label') : undefined;
  const sortOrder = body.sortOrder !== undefined ? optionalInt(body.sortOrder, 'sortOrder') : undefined;
  const metadata = body.metadata !== undefined ? body.metadata : undefined;

  if (metadata !== undefined && (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata))) {
    throw new ValidationError('metadata must be an object');
  }

  await withTransaction(async (client) => {
    if (metadata !== undefined) {
      await client.query(
        `
          UPDATE media_assets
             SET metadata = $3,
                 updated_by = $4,
                 revision = revision + 1
           WHERE id = $1 AND clinic_id = $2
        `,
        [id, clinicId, metadata, req.user.sub]
      );
    }

    if (eye !== undefined || label !== undefined || sortOrder !== undefined) {
      const sets = [];
      const params = [id, clinicId];
      if (eye !== undefined) {
        params.push(eye);
        sets.push(`eye = $${params.length}`);
      }
      if (label !== undefined) {
        params.push(label);
        sets.push(`label = $${params.length}`);
      }
      if (sortOrder !== undefined) {
        params.push(sortOrder);
        sets.push(`sort_order = $${params.length}`);
      }
      await client.query(
        `UPDATE media_asset_links SET ${sets.join(', ')} WHERE media_asset_id = $1 AND clinic_id = $2`,
        params
      );
    }
  });

  await auditMutation(req, 'media_asset', id, 'update', {
    before: { category: existing.category },
    after: { eye, label, sortOrder, metadata }
  });

  return getMediaAssetById(clinicId, id);
}
