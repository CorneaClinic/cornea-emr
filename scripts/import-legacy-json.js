/**
 * Import legacy CorneaClinic IndexedDB JSON export into PostgreSQL.
 *
 * Delegates to the migration CLI (checksum validation, duplicate detection,
 * per-record transactions, count verification, and report generation).
 *
 * Usage:
 *   node scripts/import-legacy-json.js path/to/export.json [--dry-run] [--force-update]
 *
 * Env (apps/api/.env):
 *   DATABASE_URL=postgresql://...
 *   MIGRATION_CLINIC_ID=optional-uuid
 *   MIGRATION_USER_ID=optional-uuid
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, '../apps/api/src/db/migrate-indexeddb-cli.js');
const args = process.argv.slice(2);

if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log(`
Legacy JSON import (IndexedDB → PostgreSQL)

Usage:
  node scripts/import-legacy-json.js <export.json> [options]

Options:
  --dry-run         Analyze only — no database writes
  --force-update    Update existing records instead of skipping
  --no-skip-existing  Import all (may duplicate if IDs differ)
  --clinic-id <uuid>
  --user-id <uuid>
  --report-dir <path>

Accepts full migration bundle or legacy visits-only array export.
`);
  process.exit(args.length ? 0 : 1);
}

const child = spawn(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  cwd: join(__dirname, '../apps/api'),
  env: process.env
});

child.on('exit', (code) => process.exit(code ?? 1));
