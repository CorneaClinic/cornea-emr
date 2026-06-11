import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * @param {number} [bytes=32]
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * @param {string} token
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @param {string} password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, env.auth.bcryptRounds);
}

/**
 * @param {string} password
 * @param {string} passwordHash
 */
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * @typedef {object} AccessTokenPayload
 * @property {string} sub
 * @property {string} email
 * @property {string} role
 * @property {string} clinicId
 * @property {string} sessionFamilyId
 * @property {'access'} type
 */

/**
 * @param {object} user
 * @param {string} user.id
 * @param {string} user.email
 * @param {string} user.role
 * @param {string} user.clinic_id
 * @param {string} sessionFamilyId
 */
export function signAccessToken(user, sessionFamilyId) {
  /** @type {AccessTokenPayload} */
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinic_id,
    sessionFamilyId,
    type: 'access'
  };

  return jwt.sign(payload, env.auth.jwtSecret, {
    expiresIn: env.auth.accessExpiresIn
  });
}

/**
 * @param {string} token
 * @returns {AccessTokenPayload}
 */
export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.auth.jwtSecret);

  if (typeof payload !== 'object' || payload === null || payload.type !== 'access') {
    throw new Error('Invalid access token');
  }

  return /** @type {AccessTokenPayload} */ (payload);
}

/**
 * @param {string | undefined | null} headerValue
 */
export function extractBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }
  const token = headerValue.slice(7).trim();
  return token || null;
}

/**
 * @param {import('express').Request} req
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
}

/**
 * @param {import('express').Request} req
 */
export function getUserAgent(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : null;
}
