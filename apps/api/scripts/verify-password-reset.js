/**
 * Verify password-reset request sends email via production API + SMTP.
 * Temporarily points admin at a real inbox, triggers reset, then restores.
 *
 * Usage: node scripts/verify-password-reset.js [recipient-email]
 */
import 'dotenv/config';
import pg from 'pg';

const API = (process.env.VERIFY_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TEST_INBOX = process.argv[2] || 'faaiz.nadaa@gmail.com';
const ADMIN_EMAIL = 'admin@corneaclinic.local';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const before = await client.query(
      'SELECT id, email FROM users WHERE email = $1 OR email = $2',
      [ADMIN_EMAIL, TEST_INBOX]
    );
    const admin = before.rows.find((r) => r.email === ADMIN_EMAIL);
    if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found`);

    await client.query('UPDATE users SET email = $1 WHERE id = $2', [TEST_INBOX, admin.id]);
    console.log(`Temporarily set admin email to ${TEST_INBOX}`);

    const res = await fetch(`${API}/api/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_INBOX })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
    if (!body.success) throw new Error(`Unexpected response: ${JSON.stringify(body)}`);

    const tokens = await client.query(
      `SELECT id, expires_at FROM password_reset_tokens
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [admin.id]
    );
    if (tokens.rowCount === 0) throw new Error('No password_reset_tokens row created');

    console.log('API response OK:', body.message);
    console.log('Reset token row created (expires', tokens.rows[0].expires_at, ')');
    console.log(`Check ${TEST_INBOX} for "Cornea Clinic — reset your password"`);
  } finally {
    await client.query('UPDATE users SET email = $1 WHERE email = $2', [ADMIN_EMAIL, TEST_INBOX]);
    console.log(`Restored admin email to ${ADMIN_EMAIL}`);
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Password reset verification failed:', err.message);
  process.exit(1);
});
