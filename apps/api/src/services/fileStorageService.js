import crypto from 'crypto';
import { mkdir, writeFile, readFile, unlink, stat } from 'fs/promises';
import { dirname, join, normalize, sep } from 'path';
import { env } from '../config/env.js';
import { ValidationError } from '../core/errors.js';

/**
 * @param {Buffer} buffer
 */
export function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {string} clinicId
 * @param {string} category
 * @param {string} assetId
 * @param {string} originalFilename
 */
export function buildStorageKey(clinicId, category, assetId, originalFilename) {
  const safeName = String(originalFilename || 'file')
    .replace(/[^\w.\-()+ ]/g, '_')
    .slice(0, 180);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${clinicId}/${category}/${year}/${month}/${assetId}/${safeName}`;
}

/**
 * Resolve absolute path for a storage key, preventing path traversal.
 * @param {string} storageKey
 */
export function resolveStoragePath(storageKey) {
  const root = normalize(env.media.storagePath);
  const relative = String(storageKey).replace(/\\/g, '/').replace(/^\/+/, '');
  if (relative.includes('..')) {
    throw new ValidationError('Invalid storage key');
  }
  const absolute = normalize(join(root, ...relative.split('/')));
  if (!absolute.startsWith(root + sep) && absolute !== root) {
    throw new ValidationError('Invalid storage key path');
  }
  return absolute;
}

/**
 * @param {string} storageKey
 * @param {Buffer} buffer
 */
export async function writeStorageFile(storageKey, buffer) {
  const absolute = resolveStoragePath(storageKey);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);
  return absolute;
}

/**
 * @param {string} storageKey
 */
export async function readStorageFile(storageKey) {
  const absolute = resolveStoragePath(storageKey);
  return readFile(absolute);
}

/**
 * @param {string} storageKey
 */
export async function deleteStorageFile(storageKey) {
  const absolute = resolveStoragePath(storageKey);
  try {
    await unlink(absolute);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * @param {string} storageKey
 */
export async function storageFileExists(storageKey) {
  try {
    await stat(resolveStoragePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} mimeType
 */
export function isAllowedMimeType(mimeType) {
  return env.media.allowedMimeTypes.includes(String(mimeType).toLowerCase());
}

/**
 * @param {string} category
 */
export function isAllowedCategory(category) {
  return env.media.categories.includes(category);
}

/**
 * Categories permitted per entity type.
 * @type {Record<string, string[]>}
 */
export const ENTITY_CATEGORY_MAP = Object.freeze({
  visit: ['slit_lamp', 'corneal_topography', 'as_oct', 'anterior_drawing'],
  patient: ['slit_lamp', 'corneal_topography', 'as_oct', 'anterior_drawing'],
  keratoplasty_patient: ['donor_cornea', 'slit_lamp', 'as_oct'],
  corneal_tissue: ['donor_cornea']
});

/**
 * @param {string} entityType
 * @param {string} category
 */
export function assertCategoryForEntity(entityType, category) {
  const allowed = ENTITY_CATEGORY_MAP[entityType];
  if (!allowed || !allowed.includes(category)) {
    throw new ValidationError(
      `Category "${category}" is not allowed for entity type "${entityType}"`
    );
  }
}
