import { ValidationError } from './errors.js';

const WEAK_PASSWORDS = new Set([
  'admin123',
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'changeme',
  'corneaclinic'
]);

/**
 * @param {string} password
 * @param {{ minLength?: number }} [opts]
 */
export function validatePasswordStrength(password, opts = {}) {
  const minLength = opts.minLength ?? 12;
  const p = String(password || '');

  if (p.length < minLength) {
    throw new ValidationError(`Password must be at least ${minLength} characters`);
  }
  if (WEAK_PASSWORDS.has(p.toLowerCase())) {
    throw new ValidationError('Password is too common; choose a stronger password');
  }
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
    throw new ValidationError('Password must include uppercase, lowercase, and a number');
  }
}

/**
 * @param {string} secret
 */
export function validateJwtSecretStrength(secret) {
  const s = String(secret || '').trim();
  const weak = new Set([
    'change-me-in-production-use-long-random-string',
    'dev-only-change-me-in-production',
    'admin123',
    'secret',
    'jwt_secret',
    'your-secret-key'
  ]);

  if (s.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (weak.has(s)) {
    throw new Error('JWT_SECRET is a known weak value; generate a strong random secret');
  }
}
