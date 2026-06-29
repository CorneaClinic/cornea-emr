#!/usr/bin/env node
/**
 * Request a password reset against the live production API and optionally
 * confirm a DB token row was created (requires apps/api/.env.production).
 *
 * Usage:
 *   node scripts/verify-production-password-reset.mjs your@gmail.com
 *   VERIFY_API_URL=https://corneaclinic-2zfpt.ondigitalocean.app node scripts/verify-production-password-reset.mjs user@example.com
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from '../apps/api/node_modules/pg/lib/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API = (process.env.VERIFY_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const EMAIL = (process.argv[2] || process.env.STAGING_E2E_EMAIL || '').trim().toLowerCase();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function pgClientConfig(connectionString) {
  if (!/ondigitalocean\.com/i.test(connectionString)) {
    return { connectionString };
  }
  const url = connectionString
    .replace(/([?&])sslmode=[^&]*&?/g, '$1')
    .replace(/[?&]$/, '');
  return { connectionString: url, ssl: { rejectUnauthorized: false } };
}

async function main() {
  if (!EMAIL) {
    console.error('Usage: node scripts/verify-production-password-reset.mjs <email>');
    process.exit(1);
  }

  console.log(`API:   ${API}`);
  console.log(`Email: ${EMAIL}`);
  console.log('');

  const res = await fetch(`${API}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  }
  console.log('API response:', body.message || JSON.stringify(body));

  const prodEnv = path.join(ROOT, 'apps', 'api', '.env.production');
  const prodVars = loadEnvFile(prodEnv);
  const databaseUrl = process.env.DATABASE_URL || prodVars.DATABASE_URL;
  if (databaseUrl) {
    const db = new pg.Client(pgClientConfig(databaseUrl));
    await db.connect();
    try {
      const user = await db.query(`SELECT id, email, is_active FROM users WHERE lower(email) = $1`, [
        EMAIL
      ]);
      if (!user.rows.length) {
        console.log('');
        console.log('DB: No user with this email — API still returns success (anti-enumeration).');
        console.log('    Email will NOT be sent. Use an email that exists on a production user.');
      } else if (!user.rows[0].is_active) {
        console.log('');
        console.log('DB: User exists but is inactive — reset email will not be sent.');
      } else {
        const tokens = await db.query(
          `SELECT created_at, expires_at FROM password_reset_tokens
           WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [user.rows[0].id]
        );
        if (tokens.rows.length) {
          console.log('');
          console.log('DB: password_reset_tokens row created ✓');
          console.log(`    expires: ${tokens.rows[0].expires_at}`);
        } else {
          console.log('');
          console.log('DB: No token row — user may not exist or request failed server-side.');
        }
      }
    } finally {
      await db.end();
    }
  } else {
    console.log('');
    console.log('(Skip DB check — apps/api/.env.production not found locally)');
  }

  console.log('');
  console.log('Next: check inbox/spam for subject "Cornea Clinic — reset your password"');
  console.log('Link format: https://corneaclinic.visionemr.net/reset-password.html?token=...');
}

main().catch((err) => {
  console.error('verify-production-password-reset failed:', err.message || err);
  process.exit(1);
});
