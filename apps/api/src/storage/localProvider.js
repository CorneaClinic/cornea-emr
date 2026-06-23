import { mkdir, writeFile, readFile, unlink, stat } from 'fs/promises';
import { dirname, join, normalize, sep } from 'path';
import { ValidationError } from '../core/errors.js';

/**
 * Local filesystem storage provider (development / VPS with persistent volume).
 * @param {{ rootPath: string }} config
 */
export function createLocalProvider(config) {
  const root = normalize(config.rootPath);

  function resolvePath(storageKey) {
    const relative = String(storageKey).replace(/\\/g, '/').replace(/^\/+/, '');
    if (relative.includes('..')) throw new ValidationError('Invalid storage key');
    const absolute = normalize(join(root, ...relative.split('/')));
    if (!absolute.startsWith(root + sep) && absolute !== root) {
      throw new ValidationError('Invalid storage key path');
    }
    return absolute;
  }

  return {
    provider: 'local',
    bucket: null,

    async write(storageKey, buffer) {
      const absolute = resolvePath(storageKey);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, buffer);
      return { etag: null };
    },

    async read(storageKey) {
      return readFile(resolvePath(storageKey));
    },

    async delete(storageKey) {
      try {
        await unlink(resolvePath(storageKey));
        return true;
      } catch (err) {
        if (err.code === 'ENOENT') return false;
        throw err;
      }
    },

    async exists(storageKey) {
      try {
        await stat(resolvePath(storageKey));
        return true;
      } catch {
        return false;
      }
    },

    async getSignedUrl() {
      return null;
    }
  };
}
