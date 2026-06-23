import { query } from '../db/pool.js';
import { storageFileExists } from './fileStorageService.js';
import { env } from '../config/env.js';

/**
 * Administrator dashboard stats for clinical media platform.
 * @param {string} clinicId
 */
export async function getMediaAdminStats(clinicId) {
  const [counts, storage, failures, largest, orphans] = await Promise.all([
    query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived,
          COUNT(*) FILTER (WHERE category = 'video')::int AS videos,
          COALESCE(SUM(byte_size), 0)::bigint AS total_bytes
        FROM media_assets
       WHERE clinic_id = $1 AND deleted_at IS NULL AND status = 'ready'
      `,
      [clinicId]
    ),
    query(
      `
        SELECT category, COUNT(*)::int AS count, COALESCE(SUM(byte_size), 0)::bigint AS bytes
          FROM media_assets
         WHERE clinic_id = $1 AND deleted_at IS NULL AND status = 'ready'
         GROUP BY category
         ORDER BY count DESC
      `,
      [clinicId]
    ),
    query(
      `
        SELECT COUNT(*)::int AS upload_failures
          FROM audit_logs
         WHERE clinic_id = $1
           AND entity_type = 'media_asset'
           AND action = 'upload_failed'
           AND created_at > now() - interval '7 days'
      `,
      [clinicId]
    ),
    query(
      `
        SELECT id, original_filename, byte_size, category, created_at
          FROM media_assets
         WHERE clinic_id = $1 AND deleted_at IS NULL AND status = 'ready'
         ORDER BY byte_size DESC
         LIMIT 10
      `,
      [clinicId]
    ),
    query(
      `
        SELECT m.id, m.storage_key, m.original_filename
          FROM media_assets m
          LEFT JOIN media_asset_links l ON l.media_asset_id = m.id
         WHERE m.clinic_id = $1
           AND m.deleted_at IS NULL
           AND m.status = 'ready'
           AND l.id IS NULL
         LIMIT 50
      `,
      [clinicId]
    )
  ]);

  const row = counts.rows[0] || {};

  return {
    storageProvider: env.media.storageProvider,
    bucket: env.media.s3.bucket || null,
    totalCount: row.total || 0,
    archivedCount: row.archived || 0,
    videoCount: row.videos || 0,
    totalBytes: Number(row.total_bytes || 0),
    byCategory: storage.rows,
    uploadFailures7d: failures.rows[0]?.upload_failures || 0,
    largestFiles: largest.rows,
    orphanedLinks: orphans.rows,
    backupNote: 'Database dumps include metadata; verify object storage bucket replication separately.'
  };
}

/**
 * Verify storage keys exist for ready assets (sample or full).
 * @param {string} clinicId
 * @param {number} [limit]
 */
export async function verifyMediaIntegrity(clinicId, limit = 100) {
  const { rows } = await query(
    `
      SELECT id, storage_key, original_filename
        FROM media_assets
       WHERE clinic_id = $1 AND deleted_at IS NULL AND status = 'ready'
       ORDER BY created_at DESC
       LIMIT $2
    `,
    [clinicId, limit]
  );

  const results = [];
  for (const row of rows) {
    const exists = await storageFileExists(row.storage_key);
    results.push({ id: row.id, filename: row.original_filename, storageKey: row.storage_key, exists });
  }

  const missing = results.filter((r) => !r.exists);
  return {
    checked: results.length,
    missing: missing.length,
    missingAssets: missing,
    ok: missing.length === 0
  };
}
