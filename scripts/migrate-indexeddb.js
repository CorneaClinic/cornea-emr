/**
 * IndexedDB → PostgreSQL migration tool (CLI wrapper)
 *
 * Usage:
 *   node scripts/migrate-indexeddb.js path/to/export.json [--dry-run]
 *
 * See apps/api/src/db/migrate-indexeddb-cli.js for full options.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, '../apps/api/src/db/migrate-indexeddb-cli.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  cwd: join(__dirname, '../apps/api'),
  env: process.env
});

child.on('exit', (code) => process.exit(code ?? 1));
