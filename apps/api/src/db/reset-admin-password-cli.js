import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const email = process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
const newPassword = crypto.randomBytes(18).toString('base64url');
const hash = await bcrypt.hash(newPassword, 12);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const res = await client.query(
  `
    UPDATE users
       SET password_hash = $1,
           must_change_password = true,
           failed_login_count = 0,
           locked_until = NULL,
           revision = revision + 1
     WHERE lower(email) = lower($2)
     RETURNING email
  `,
  [hash, email]
);

await client.end();

if (!res.rowCount) {
  console.error(`No admin user found for ${email}`);
  process.exit(1);
}

console.log('');
console.log('=== ADMIN PASSWORD RESET ===');
console.log(`Email:    ${res.rows[0].email}`);
console.log(`Password: ${newPassword}`);
console.log('You will be prompted to change this on first sign-in.');
console.log('============================');
console.log('');
