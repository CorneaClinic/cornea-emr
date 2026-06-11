import { query } from '../db/pool.js';
import { NotFoundError, ValidationError, ConflictError } from '../core/errors.js';
import { optionalObject, requireUuid, optionalInt } from '../core/validation.js';
import { auditMutation } from './auditService.js';
import { assertVisitAccessible } from './visitService.js';
import { getMediaAssetById } from './mediaAssetService.js';

/**
 * @param {Record<string, unknown>} row
 */
export function mapDrawing(row) {
  return {
    id: row.id,
    visitId: row.visit_id,
    clinicId: row.clinic_id,
    annotationJson: row.annotation_json || {},
    pngMediaAssetId: row.png_media_asset_id,
    svgMediaAssetId: row.svg_media_asset_id,
    storageKey: row.storage_key,
    svgStorageKey: row.svg_storage_key,
    mimeType: row.mime_type,
    byteSize: row.byte_size != null ? Number(row.byte_size) : null,
    checksum: row.checksum,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * @param {string} clinicId
 * @param {string} visitId
 */
export async function getDrawingForVisit(clinicId, visitId) {
  await assertVisitAccessible(clinicId, visitId);

  const { rows } = await query(
    `SELECT * FROM drawings WHERE clinic_id = $1 AND visit_id = $2`,
    [clinicId, visitId]
  );

  if (!rows[0]) {
    return null;
  }

  return mapDrawing(rows[0]);
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 * @param {Record<string, unknown>} body
 */
export async function upsertDrawingForVisit(req, visitId, body) {
  const clinicId = req.user.clinicId;
  await assertVisitAccessible(clinicId, visitId);

  const expectedRevision = body.revision != null ? optionalInt(body.revision, 'revision') : null;
  const existing = await getDrawingForVisit(clinicId, visitId);

  if (existing && expectedRevision != null && existing.revision !== expectedRevision) {
    throw new ConflictError('Drawing revision conflict', {
      expected: expectedRevision,
      actual: existing.revision
    });
  }

  const annotationJson = body.annotationJson !== undefined
    ? optionalObject(body.annotationJson, 'annotationJson')
    : (existing?.annotationJson ?? {});

  const resolvedPngId = 'pngMediaAssetId' in body
    ? (body.pngMediaAssetId != null ? requireUuid(body.pngMediaAssetId, 'pngMediaAssetId') : null)
    : (existing?.pngMediaAssetId ?? null);

  const resolvedSvgId = 'svgMediaAssetId' in body
    ? (body.svgMediaAssetId != null ? requireUuid(body.svgMediaAssetId, 'svgMediaAssetId') : null)
    : (existing?.svgMediaAssetId ?? null);

  if (resolvedPngId) {
    const png = await getMediaAssetById(clinicId, resolvedPngId);
    if (png.category !== 'anterior_drawing') {
      throw new ValidationError('pngMediaAssetId must reference an anterior_drawing asset');
    }
  }
  if (resolvedSvgId) {
    const svg = await getMediaAssetById(clinicId, resolvedSvgId);
    if (svg.category !== 'anterior_drawing' || svg.mimeType !== 'image/svg+xml') {
      throw new ValidationError('svgMediaAssetId must reference an anterior_drawing SVG asset');
    }
  }

  let row;
  if (existing) {
    const { rows } = await query(
      `
        UPDATE drawings
           SET annotation_json = $3,
               png_media_asset_id = $4,
               svg_media_asset_id = $5,
               revision = revision + 1
         WHERE id = $1 AND clinic_id = $2
        RETURNING *
      `,
      [existing.id, clinicId, annotationJson, resolvedPngId, resolvedSvgId]
    );
    row = rows[0];
    await auditMutation(req, 'drawing', row.id, 'update', {
      visitId,
      revision: row.revision
    });
  } else {
    const { rows } = await query(
      `
        INSERT INTO drawings (
          visit_id, clinic_id, annotation_json,
          png_media_asset_id, svg_media_asset_id, mime_type
        )
        VALUES ($1, $2, $3, $4, $5, 'image/png')
        RETURNING *
      `,
      [visitId, clinicId, annotationJson, resolvedPngId, resolvedSvgId]
    );
    row = rows[0];
    await auditMutation(req, 'drawing', row.id, 'create', { visitId });
  }

  return mapDrawing(row);
}

/**
 * @param {import('express').Request} req
 * @param {string} visitId
 */
export async function deleteDrawingForVisit(req, visitId) {
  const clinicId = req.user.clinicId;
  const existing = await getDrawingForVisit(clinicId, visitId);
  if (!existing) {
    throw new NotFoundError('Drawing not found');
  }

  await query(`DELETE FROM drawings WHERE id = $1 AND clinic_id = $2`, [existing.id, clinicId]);
  await auditMutation(req, 'drawing', existing.id, 'delete', { visitId });
  return { id: existing.id, deleted: true };
}
