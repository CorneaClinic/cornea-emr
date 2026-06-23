/**
 * Clinical media migration CLI — backfill metadata, local→S3 copy, base64 scan.
 *
 * Usage:
 *   node src/db/migrate-media-cli.js [--dry-run] [--to-s3] [--scan-visits] [--clinic-id UUID]
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query, closePool } from '../db/pool.js';
import { env } from '../config/env.js';
import { readStorageFile, writeStorageFile } from '../services/fileStorageService.js';
import { createLocalProvider } from '../storage/localProvider.js';
import { logger } from '../core/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

function parseArgs(argv) {
  const args = {
    dryRun: false,
    toS3: false,
    scanVisits: false,
    clinicId: process.env.MIGRATION_CLINIC_ID || null,
    reportDir: join(__dirname, '../../../migrations/reports')
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--to-s3') args.toS3 = true;
    else if (arg === '--scan-visits') args.scanVisits = true;
    else if (arg === '--clinic-id') args.clinicId = argv[++i];
    else if (arg === '--report-dir') args.reportDir = argv[++i];
  }
  if (!args.toS3 && !args.scanVisits) args.toS3 = true;
  return args;
}

async function backfillStorageProvider(clinicId, dryRun) {
  const params = clinicId ? [clinicId] : [];
  const clinicFilter = clinicId ? 'AND clinic_id = $1' : '';
  const { rows } = await query(
    `SELECT id, storage_key, storage_provider FROM media_assets
      WHERE deleted_at IS NULL ${clinicFilter}`,
    params
  );
  let updated = 0;
  for (const row of rows) {
    if (row.storage_provider && row.storage_provider !== '') continue;
    if (!dryRun) {
      await query(
        `UPDATE media_assets SET storage_provider = 'local', updated_at = now() WHERE id = $1`,
        [row.id]
      );
    }
    updated++;
  }
  return { total: rows.length, backfilled: updated };
}

async function migrateLocalToS3(clinicId, dryRun) {
  if (env.media.storageProvider !== 's3') {
    throw new Error('Set MEDIA_STORAGE_PROVIDER=s3 and S3 credentials before --to-s3');
  }

  const local = createLocalProvider({ rootPath: env.media.storagePath });
  const params = clinicId ? [clinicId] : [];
  const clinicFilter = clinicId ? 'AND clinic_id = $1' : '';
  const { rows } = await query(
    `SELECT id, storage_key, mime_type, storage_provider, bucket, byte_size
       FROM media_assets
      WHERE deleted_at IS NULL AND (storage_provider IS NULL OR storage_provider = 'local')
      ${clinicFilter}
      ORDER BY created_at ASC`,
    params
  );

  const report = { migrated: [], skipped: [], errors: [] };

  for (const row of rows) {
    try {
      const exists = await local.exists(row.storage_key);
      if (!exists) {
        report.skipped.push({ id: row.id, key: row.storage_key, reason: 'file_missing_on_disk' });
        continue;
      }
      if (dryRun) {
        report.migrated.push({ id: row.id, key: row.storage_key, dryRun: true });
        continue;
      }
      const buffer = await local.read(row.storage_key);
      const written = await writeStorageFile(row.storage_key, buffer, row.mime_type);
      await query(
        `UPDATE media_assets
            SET storage_provider = $2, bucket = $3, etag = $4, updated_at = now()
          WHERE id = $1`,
        [row.id, written.provider, written.bucket, written.etag || null]
      );
      report.migrated.push({ id: row.id, key: row.storage_key, bytes: buffer.length });
    } catch (err) {
      report.errors.push({ id: row.id, key: row.storage_key, error: err.message });
    }
  }

  return report;
}

async function scanVisitBase64(clinicId) {
  const params = clinicId ? [clinicId] : [];
  const clinicFilter = clinicId ? 'AND clinic_id = $1' : '';
  const { rows } = await query(
    `SELECT id, visit_date, payload->>'visitMediaJSON' AS visit_media
       FROM visits
      WHERE deleted_at IS NULL
        AND payload->>'visitMediaJSON' IS NOT NULL
        AND payload->>'visitMediaJSON' LIKE '%dataUrl%'
      ${clinicFilter}`,
    params
  );

  const findings = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.visit_media || '{}');
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const withBase64 = items.filter((i) => i.dataUrl && !i.serverAssetId);
      if (withBase64.length) {
        findings.push({
          visitId: row.id,
          visitDate: row.visit_date,
          pendingBase64Count: withBase64.length,
          filenames: withBase64.map((i) => i.filename)
        });
      }
    } catch {
      findings.push({ visitId: row.id, visitDate: row.visit_date, error: 'invalid_json' });
    }
  }
  return findings;
}

async function main() {
  const args = parseArgs(process.argv);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir(args.reportDir, { recursive: true });

  const summary = {
    startedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    clinicId: args.clinicId,
    storageProvider: env.media.storageProvider,
    steps: {}
  };

  summary.steps.backfill = await backfillStorageProvider(args.clinicId, args.dryRun);

  if (args.toS3) {
    summary.steps.localToS3 = await migrateLocalToS3(args.clinicId, args.dryRun);
  }

  if (args.scanVisits) {
    summary.steps.visitBase64 = await scanVisitBase64(args.clinicId);
  }

  summary.finishedAt = new Date().toISOString();
  const reportPath = join(args.reportDir, `media-migration-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');

  logger.info({ reportPath, summary }, 'Media migration complete');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReport written to ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(() => closePool());
