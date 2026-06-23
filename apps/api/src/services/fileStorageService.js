import crypto from 'crypto';
import { join, normalize, sep } from 'path';
import { env } from '../config/env.js';
import { ValidationError } from '../core/errors.js';
import {
  MEDIA_CATEGORIES,
  ENTITY_CATEGORY_MAP,
  normalizeCategory
} from '../core/mediaCategories.js';
import { getStorageProvider } from '../storage/index.js';

export { MEDIA_CATEGORIES, ENTITY_CATEGORY_MAP, normalizeCategory };

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
  const cat = normalizeCategory(category);
  return `${clinicId}/${cat}/${year}/${month}/${assetId}/${safeName}`;
}

/**
 * @param {string} storageKey
 * @param {Buffer} buffer
 * @param {string} [mimeType]
 */
export async function writeStorageFile(storageKey, buffer, mimeType) {
  const provider = getStorageProvider();
  const result = await provider.write(storageKey, buffer, mimeType);
  return { provider: provider.provider, bucket: provider.bucket, etag: result.etag };
}

/**
 * @param {string} storageKey
 */
export async function readStorageFile(storageKey) {
  return getStorageProvider().read(storageKey);
}

/**
 * @param {string} storageKey
 */
export async function deleteStorageFile(storageKey) {
  return getStorageProvider().delete(storageKey);
}

/**
 * @param {string} storageKey
 */
export async function storageFileExists(storageKey) {
  return getStorageProvider().exists(storageKey);
}

/**
 * @param {string} storageKey
 * @param {string} [mimeType]
 */
export async function getStorageSignedUrl(storageKey, mimeType) {
  return getStorageProvider().getSignedUrl(storageKey, mimeType);
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
  const normalized = normalizeCategory(category);
  return env.media.categories.includes(normalized);
}

/**
 * @param {string} entityType
 * @param {string} category
 */
export function assertCategoryForEntity(entityType, category) {
  const normalized = normalizeCategory(category);
  const allowed = ENTITY_CATEGORY_MAP[entityType];
  if (!allowed || !allowed.includes(normalized)) {
    throw new ValidationError(
      `Category "${category}" is not allowed for entity type "${entityType}"`
    );
  }
}

/**
 * @param {string} category
 * @param {number} byteSize
 */
export function assertFileSizeForCategory(category, byteSize) {
  const cat = normalizeCategory(category);
  const max = cat === 'video' ? env.media.maxVideoBytes : env.media.maxFileBytes;
  if (byteSize > max) {
    throw new ValidationError(`File exceeds maximum size of ${max} bytes for category ${cat}`);
  }
}

/** @deprecated use storage provider; kept for local migration CLI */
export function resolveStoragePath(storageKey) {
  const root = normalize(env.media.storagePath);
  const relative = String(storageKey).replace(/\\/g, '/').replace(/^\/+/, '');
  if (relative.includes('..')) throw new ValidationError('Invalid storage key');
  const absolute = normalize(join(root, ...relative.split('/')));
  if (!absolute.startsWith(root + sep) && absolute !== root) {
    throw new ValidationError('Invalid storage key path');
  }
  return absolute;
}
