#!/usr/bin/env node
/**
 * Generate cryptographically strong secrets for Cornea EMR deployment.
 * Usage: node scripts/generate-secrets.js
 */
import crypto from 'crypto';

function gen(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const jwtSecret = gen(48);
const encryptionKey = gen(48);
const dbPassword = gen(24);
const seedPassword = gen(18);

console.log('# Cornea EMR — generated secrets (copy to your secret store / .env.local)');
console.log('# NEVER commit these values to git.\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SECRETS_ENCRYPTION_KEY=${encryptionKey}`);
console.log(`SEED_ADMIN_PASSWORD=${seedPassword}`);
console.log(`# Example DATABASE_URL password segment: ${dbPassword}`);
console.log('\n# Production checklist:');
console.log('# - Set CORS_ORIGIN to your clinic frontend URL(s)');
console.log('# - Set AUTH_COOKIE_SECURE=true behind HTTPS');
console.log('# - Set AUTH_EXPOSE_REFRESH_IN_BODY=false');
console.log('# - Set ALLOW_PRODUCTION_SEED=false after initial seed');
