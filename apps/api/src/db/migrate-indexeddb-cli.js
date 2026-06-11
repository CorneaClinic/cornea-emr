import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query, closePool } from '../db/pool.js';
import { logger } from '../core/logger.js';
import {
  runMigration,
  generateMigrationReportMarkdown,
  normalizeExportBundle
} from '../services/migrationService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

function parseArgs(argv) {
  const args = {
    file: null,
    dryRun: false,
    forceUpdate: false,
    skipExisting: true,
    clinicId: process.env.MIGRATION_CLINIC_ID || null,
    userId: process.env.MIGRATION_USER_ID || null,
    reportDir: join(__dirname, '../../../migrations/reports')
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force-update') args.forceUpdate = true;
    else if (arg === '--no-skip-existing') args.skipExisting = false;
    else if (arg === '--clinic-id') args.clinicId = argv[++i];
    else if (arg === '--user-id') args.userId = argv[++i];
    else if (arg === '--report-dir') args.reportDir = argv[++i];
    else if (!arg.startsWith('-')) args.file = arg;
  }

  return args;
}

async function resolveClinicAndUser(clinicId, userId) {
  if (clinicId && userId) {
    return { clinicId, userId };
  }

  const { rows } = await query(
    `
      SELECT c.id AS clinic_id, u.id AS user_id
        FROM clinics c
        JOIN users u ON u.clinic_id = c.id
       WHERE u.role = 'admin' AND u.is_active = true
       ORDER BY c.created_at ASC
       LIMIT 1
    `
  );

  if (!rows[0]) {
    throw new Error('No active admin user found — seed the database or pass --clinic-id and --user-id');
  }

  return {
    clinicId: clinicId || rows[0].clinic_id,
    userId: userId || rows[0].user_id
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.file) {
    console.error(`
IndexedDB → PostgreSQL migration tool

Usage:
  node src/db/migrate-indexeddb-cli.js <export.json> [options]

Options:
  --dry-run              Analyze only — no database writes
  --force-update         Update existing records instead of skipping
  --no-skip-existing     Import all records (may create duplicates if IDs differ)
  --clinic-id <uuid>     Target clinic (default: first admin clinic)
  --user-id <uuid>       Import actor user id (default: first admin)
  --report-dir <path>    Report output directory

Accepts:
  - Full export bundle { patients, kpPatients, kpTissues, checksums }
  - Legacy array export from Database tab [ visit, visit, ... ]

No data loss: original export file is never modified.
`);
    process.exit(1);
  }

  const filePath = resolve(args.file);
  logger.info({ file: filePath, dryRun: args.dryRun }, 'Loading IndexedDB export');

  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  const bundle = normalizeExportBundle(raw);

  logger.info({
    visits: bundle.patients.length,
    kpPatients: bundle.kpPatients.length,
    kpTissues: bundle.kpTissues.length
  }, 'Export loaded');

  const { clinicId, userId } = await resolveClinicAndUser(args.clinicId, args.userId);

  const report = await runMigration({
    bundle,
    clinicId,
    userId,
    dryRun: args.dryRun,
    skipExisting: args.skipExisting,
    forceUpdate: args.forceUpdate
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir(args.reportDir, { recursive: true });

  const jsonPath = join(args.reportDir, `migration-report-${timestamp}.json`);
  const mdPath = join(args.reportDir, `migration-report-${timestamp}.md`);

  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(mdPath, generateMigrationReportMarkdown(report), 'utf8');

  logger.info({ jsonPath, mdPath }, 'Migration report written');

  console.log('\n--- Migration Summary ---');
  console.log(`Mode: ${report.mode}`);
  console.log(`Source visits: ${report.source.counts.visits}`);
  console.log(`Source KP patients: ${report.source.counts.kpPatients}`);
  console.log(`Source KP tissues: ${report.source.counts.kpTissues}`);
  console.log(`Duplicates in export: ${report.duplicates.withinExport.length}`);
  console.log(`Duplicates in database: ${report.duplicates.againstDatabase.length}`);

  if (report.mode === 'import') {
    console.log(`Visits — inserted: ${report.import.visits.inserted}, updated: ${report.import.visits.updated}, skipped: ${report.import.visits.skipped}, failed: ${report.import.visits.failed}`);
    console.log(`KP patients — inserted: ${report.import.kpPatients.inserted}, updated: ${report.import.kpPatients.updated}, skipped: ${report.import.kpPatients.skipped}, failed: ${report.import.kpPatients.failed}`);
    console.log(`KP tissues — inserted: ${report.import.kpTissues.inserted}, updated: ${report.import.kpTissues.updated}, skipped: ${report.import.kpTissues.skipped}, failed: ${report.import.kpTissues.failed}`);
    console.log(`DB visits: ${report.database.before.visits} → ${report.database.after?.visits}`);
  }

  console.log(`Verification: ${report.verification?.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Report: ${mdPath}`);

  await closePool();
  process.exit(report.verification?.passed ? 0 : 1);
}

main().catch(async (err) => {
  logger.error({ err }, 'Migration failed');
  await closePool();
  process.exit(1);
});
