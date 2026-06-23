import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ValidationError } from '../core/errors.js';

/**
 * S3-compatible object storage (Cloudflare R2, DigitalOcean Spaces, AWS S3).
 * @param {{
 *   bucket: string,
 *   region?: string,
 *   endpoint?: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   signedUrlTtlSeconds?: number,
 *   forcePathStyle?: boolean
 * }} config
 */
export function createS3Provider(config) {
  if (!config.bucket) throw new ValidationError('MEDIA_S3_BUCKET is required for s3 storage provider');
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new ValidationError('MEDIA_S3_ACCESS_KEY_ID and MEDIA_S3_SECRET_ACCESS_KEY are required');
  }

  const client = new S3Client({
    region: config.region || 'auto',
    endpoint: config.endpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint)
  });

  const ttl = config.signedUrlTtlSeconds ?? 900;

  return {
    provider: 's3',
    bucket: config.bucket,

    async write(storageKey, buffer, contentType) {
      const res = await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream'
        })
      );
      return { etag: res.ETag || null };
    },

    async read(storageKey) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: storageKey })
      );
      const chunks = [];
      for await (const chunk of res.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },

    async delete(storageKey) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
        return true;
      } catch (err) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    },

    async exists(storageKey) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }));
        return true;
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    },

    /**
     * @param {string} storageKey
     * @param {string} [contentType]
     */
    async getSignedUrl(storageKey, contentType) {
      const cmd = new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        ResponseContentType: contentType
      });
      return getSignedUrl(client, cmd, { expiresIn: ttl });
    }
  };
}
