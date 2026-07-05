/**
 * Grant CREATEDB to local cornea user so restore drills work without postgres superuser.
 * Usage: $env:POSTGRES_PASSWORD='your-postgres-install-password'; node scripts/grant-cornea-createdb.js
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../apps/api/package.json'));
const pg = require('pg');

const adminPassword = process.env.POSTGRES_PASSWORD;
const dbUser = process.env.DB_USER || 'cornea';

if (!adminPassword) {
  console.error('Set POSTGRES_PASSWORD to your PostgreSQL 18 install password (postgres superuser).');
  console.error('Example: $env:POSTGRES_PASSWORD=\'YourPassword\'; node scripts/grant-cornea-createdb.js');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgres://postgres:${encodeURIComponent(adminPassword)}@127.0.0.1:5432/postgres`
});

try {
  await client.connect();
  await client.query(`ALTER USER ${dbUser} CREATEDB`);
  console.log(`Granted CREATEDB to local user "${dbUser}".`);
  console.log('Re-run the drill WITHOUT -PostgresUser (uses cornea from apps/api/.env.local).');
} catch (err) {
  console.error('Failed:', err.message);
  console.error('Check POSTGRES_PASSWORD is the password from PostgreSQL 18 installation (not cloud doadmin).');
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
