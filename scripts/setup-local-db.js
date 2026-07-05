/**
 * Create cornea_emr database and cornea user for local PostgreSQL.
 *
 * Usage (PowerShell):
 *   $env:POSTGRES_PASSWORD='your-postgres-password'
 *   node scripts/setup-local-db.js
 *
 * Optional env:
 *   POSTGRES_HOST=127.0.0.1
 *   POSTGRES_PORT=5432
 *   POSTGRES_USER=postgres
 *   DB_NAME=cornea_emr
 *   DB_USER=cornea
 *   DB_PASSWORD=cornea_dev
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../apps/api/package.json'));
const pg = require('pg');

const host = process.env.POSTGRES_HOST || '127.0.0.1';
const port = Number(process.env.POSTGRES_PORT || 5432);
const adminUser = process.env.POSTGRES_USER || 'postgres';
const adminPassword = process.env.POSTGRES_PASSWORD;

const dbName = process.env.DB_NAME || 'cornea_emr';
const dbUser = process.env.DB_USER || 'cornea';
const dbPassword = process.env.DB_PASSWORD || 'cornea_dev';

if (!adminPassword) {
  console.error('Set POSTGRES_PASSWORD to your local postgres superuser password.');
  console.error('Example: $env:POSTGRES_PASSWORD=\'yourpassword\'; node scripts/setup-local-db.js');
  process.exit(1);
}

const adminUrl = `postgres://${adminUser}:${encodeURIComponent(adminPassword)}@${host}:${port}/postgres`;
const client = new pg.Client({ connectionString: adminUrl });

async function main() {
  await client.connect();
  console.log(`Connected as ${adminUser}@${host}:${port}`);

  const { rows: dbRows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName]
  );
  if (!dbRows.length) {
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log(`Created database: ${dbName}`);
  } else {
    console.log(`Database already exists: ${dbName}`);
  }

  const { rows: userRows } = await client.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [dbUser]
  );
  if (!userRows.length) {
    await client.query(
      `CREATE USER ${dbUser} WITH PASSWORD '${dbPassword.replace(/'/g, "''")}'`
    );
    console.log(`Created user: ${dbUser}`);
  } else {
    await client.query(
      `ALTER USER ${dbUser} WITH PASSWORD '${dbPassword.replace(/'/g, "''")}'`
    );
    console.log(`Updated password for user: ${dbUser}`);
  }

  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}`);
  await client.query(`ALTER USER ${dbUser} CREATEDB`);
  await client.query(`ALTER DATABASE ${dbName} OWNER TO ${dbUser}`);
  await client.end();

  const appClient = new pg.Client({
    connectionString: `postgres://${dbUser}:${encodeURIComponent(dbPassword)}@${host}:${port}/${dbName}`
  });
  await appClient.connect();
  await appClient.query(`ALTER SCHEMA public OWNER TO ${dbUser}`);
  await appClient.query(`GRANT ALL ON SCHEMA public TO ${dbUser}`);
  await appClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbUser}`);
  await appClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${dbUser}`);
  await appClient.end();

  console.log('\nReady. DATABASE_URL for apps/api/.env:');
  console.log(`postgres://${dbUser}:${dbPassword}@${host}:${port}/${dbName}`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
