import { env } from '../config/env.js';
import { createLocalProvider } from './localProvider.js';
import { createS3Provider } from './s3Provider.js';

/** @type {ReturnType<createLocalProvider> | ReturnType<createS3Provider> | null} */
let cached = null;

export function getStorageProvider() {
  if (cached) return cached;

  if (env.media.storageProvider === 's3') {
    cached = createS3Provider({
      bucket: env.media.s3.bucket,
      region: env.media.s3.region,
      endpoint: env.media.s3.endpoint,
      accessKeyId: env.media.s3.accessKeyId,
      secretAccessKey: env.media.s3.secretAccessKey,
      signedUrlTtlSeconds: env.media.signedUrlTtlSeconds,
      forcePathStyle: env.media.s3.forcePathStyle
    });
  } else {
    cached = createLocalProvider({ rootPath: env.media.storagePath });
  }

  return cached;
}

export function resetStorageProviderCache() {
  cached = null;
}
