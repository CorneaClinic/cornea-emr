#!/usr/bin/env node
/**
 * Stage 4 dry-run: copy a sample of DigitalOcean Spaces objects into Cloudflare R2
 * and verify byte-size integrity. Does NOT change production MEDIA_* env.
 *
 * R2 writes default to Wrangler OAuth (`wrangler r2 object put --remote`) so you
 * do not need R2_ACCESS_KEY_ID. Set R2_ACCESS_KEY_ID/SECRET to use the S3 API instead.
 *
 * Prerequisites:
 *   1. R2 enabled; staging bucket exists (cornea-emr-media-staging)
 *   2. Spaces credentials in env (MEDIA_S3_ACCESS_KEY_ID / MEDIA_S3_SECRET_ACCESS_KEY)
 *
 * Usage:
 *   node scripts/r2-spaces-dry-run.mjs
 *   node scripts/r2-spaces-dry-run.mjs --limit 20
 *   node scripts/r2-spaces-dry-run.mjs --dry-list
 */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? true;
}

const LIMIT = Number(flag('--limit', '25')) || 25;
const PREFIX = flag('--prefix', '') || '';
const DRY_LIST = args.includes('--dry-list');
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  process.env.CF_ACCOUNT_ID ||
  'f2c41820d69631f2365f03a76922e190';

const spaces = {
  bucket: process.env.SPACES_BUCKET || process.env.MEDIA_S3_BUCKET || 'corneaclinic-storage',
  region: process.env.SPACES_REGION || process.env.MEDIA_S3_REGION || 'sgp1',
  endpoint:
    process.env.SPACES_ENDPOINT ||
    process.env.MEDIA_S3_ENDPOINT ||
    'https://sgp1.digitaloceanspaces.com',
  accessKeyId: process.env.SPACES_ACCESS_KEY_ID || process.env.MEDIA_S3_ACCESS_KEY_ID || '',
  secretAccessKey:
    process.env.SPACES_SECRET_ACCESS_KEY || process.env.MEDIA_S3_SECRET_ACCESS_KEY || ''
};

const r2 = {
  bucket: process.env.R2_BUCKET || 'cornea-emr-media-staging',
  region: 'auto',
  endpoint:
    process.env.R2_ENDPOINT || `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
};

const useWranglerR2 = !(r2.accessKeyId && r2.secretAccessKey);

function clientFor(cfg, forcePathStyle) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    }
  });
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function listKeys(s3, bucket, prefix, limit) {
  const keys = [];
  let token;
  while (keys.length < limit) {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: Math.min(1000, limit - keys.length)
      })
    );
    for (const obj of res.Contents || []) {
      if (obj.Key && !obj.Key.endsWith('/')) {
        keys.push({ key: obj.Key, size: obj.Size ?? null, etag: obj.ETag || null });
      }
      if (keys.length >= limit) break;
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
  return keys;
}

function wranglerPut(bucket, key, filePath, contentType) {
  const objectPath = `${bucket}/${key}`;
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      objectPath,
      '--file',
      filePath,
      '--remote',
      '-y',
      ...(contentType ? ['--content-type', contentType] : [])
    ],
    { encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'wrangler put failed').slice(0, 500));
  }
}

function wranglerGet(bucket, key, filePath) {
  const objectPath = `${bucket}/${key}`;
  const result = spawnSync(
    'npx',
    ['wrangler', 'r2', 'object', 'get', objectPath, '--file', filePath, '--remote'],
    { encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'wrangler get failed').slice(0, 500));
  }
}

async function putAndVerifyR2(key, buf, contentType) {
  if (useWranglerR2) {
    const work = join(tmpdir(), `cornea-r2-dryrun-${process.pid}`);
    mkdirSync(work, { recursive: true });
    const safe = key.replace(/[\\/]/g, '__');
    const inFile = join(work, `in-${safe}`);
    const outFile = join(work, `out-${safe}`);
    try {
      writeFileSync(inFile, buf);
      wranglerPut(r2.bucket, key, inFile, contentType);
      wranglerGet(r2.bucket, key, outFile);
      const roundTrip = readFileSync(outFile);
      if (roundTrip.length !== buf.length) {
        throw new Error(`size mismatch after wrangler round-trip local=${buf.length} r2=${roundTrip.length}`);
      }
      const a = createHash('sha256').update(buf).digest('hex');
      const b = createHash('sha256').update(roundTrip).digest('hex');
      if (a !== b) throw new Error('sha256 mismatch after wrangler round-trip');
    } finally {
      try {
        unlinkSync(inFile);
      } catch (_) { /* ignore */ }
      try {
        unlinkSync(outFile);
      } catch (_) { /* ignore */ }
      try {
        rmSync(work, { recursive: true, force: true });
      } catch (_) { /* ignore */ }
    }
    return;
  }

  const r2Client = clientFor(r2, true);
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: buf,
      ContentType: contentType || 'application/octet-stream'
    })
  );
  const head = await r2Client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
  if (head.ContentLength != null && head.ContentLength !== buf.length) {
    throw new Error(`size mismatch spaces=${buf.length} r2=${head.ContentLength}`);
  }
}

async function main() {
  console.log('\n=== Spaces → R2 dry-run (non-production) ===\n');
  console.log(`Spaces: ${spaces.endpoint} / ${spaces.bucket}`);
  console.log(`R2:     ${r2.bucket} (${useWranglerR2 ? 'via wrangler OAuth' : 'via S3 API'})`);
  console.log(`Limit:  ${LIMIT}${PREFIX ? `  prefix=${PREFIX}` : ''}\n`);

  if (!spaces.accessKeyId || !spaces.secretAccessKey) {
    console.error('Missing Spaces credentials.');
    console.error('Set MEDIA_S3_ACCESS_KEY_ID and MEDIA_S3_SECRET_ACCESS_KEY (Spaces API keys from DigitalOcean).');
    console.error('DO App Platform stores these as secrets and they are not readable via the DO API.');
    process.exit(2);
  }

  const spacesClient = clientFor(spaces, false);

  let listed;
  try {
    listed = await listKeys(spacesClient, spaces.bucket, PREFIX, LIMIT);
  } catch (err) {
    console.error('Failed to list Spaces:', err.message || err);
    process.exit(2);
  }

  console.log(`Listed ${listed.length} object(s) from Spaces.`);
  if (!listed.length) {
    console.log('Nothing to copy (empty bucket or prefix).');
    process.exit(0);
  }

  if (DRY_LIST) {
    for (const o of listed.slice(0, 20)) {
      console.log(`  ${String(o.size ?? '?').padStart(10)}  ${o.key}`);
    }
    if (listed.length > 20) console.log(`  … +${listed.length - 20} more`);
    console.log('\nDry-list only — no R2 writes.');
    process.exit(0);
  }

  let copied = 0;
  let failed = 0;
  const failures = [];

  for (const obj of listed) {
    try {
      const get = await spacesClient.send(
        new GetObjectCommand({ Bucket: spaces.bucket, Key: obj.key })
      );
      const buf = await streamToBuffer(get.Body);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      await putAndVerifyR2(obj.key, buf, get.ContentType || 'application/octet-stream');
      copied += 1;
      console.log(`  ✓ ${obj.key} (${buf.length} bytes, sha256=${sha256.slice(0, 12)}…)`);
    } catch (err) {
      failed += 1;
      const msg = err.message || String(err);
      failures.push({ key: obj.key, error: msg });
      console.error(`  ✗ ${obj.key} — ${msg}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Copied:  ${copied}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Bucket:  ${r2.bucket} (staging — production MEDIA_* unchanged)\n`);

  if (failed) {
    for (const f of failures.slice(0, 10)) console.error(`  - ${f.key}: ${f.error}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
