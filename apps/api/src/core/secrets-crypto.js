import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getEncryptionKey() {
  const raw = env.secrets.encryptionKey;
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * @param {string} plaintext
 * @returns {string} base64 iv:tag:ciphertext
 */
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(IV_BYTES);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * @param {string} encoded
 * @returns {string}
 */
export function decryptSecret(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + 16);
  const data = buf.subarray(IV_BYTES + 16);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
