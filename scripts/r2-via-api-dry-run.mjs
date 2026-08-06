#!/usr/bin/env node
/**
 * Stage 4 dry-run (no Spaces keys): pull clinical media through the production API
 * (which already has Spaces credentials) and copy into staging R2 via Wrangler.
 *
 * Does NOT change production MEDIA_* env.
 *
 * Usage:
 *   $env:AUTH_EMAIL="you@clinic.com"
 *   $env:AUTH_PASSWORD="..."
 *   npm run migrate:r2:via-api
 *   npm run migrate:r2:via-api -- --limit 10
 */
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

const API = (process.env.API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(/\/$/, '');
const EMAIL = process.env.AUTH_EMAIL || process.env.SEED_ADMIN_EMAIL || '';
const PASSWORD = process.env.AUTH_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
const LIMIT = Number(flag('--limit', '25')) || 25;
const R2_BUCKET = process.env.R2_BUCKET || 'cornea-emr-media-staging';
const DEVICE_ID = 'r2-api-migration-device';

let token = '';

async function api(method, path, { body, raw } = {}) {
  const headers = {
    'X-Device-Id': DEVICE_ID,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  let initBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    initBody = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: initBody });
  if (raw) {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { res, buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json || text).slice(0, 200)}`);
  }
  return json;
}

function wranglerPut(bucket, key, filePath, contentType) {
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${key}`,
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
  const result = spawnSync(
    'npx',
    ['wrangler', 'r2', 'object', 'get', `${bucket}/${key}`, '--file', filePath, '--remote'],
    { encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'wrangler get failed').slice(0, 500));
  }
}

async function putAndVerify(key, buf, contentType) {
  const work = join(tmpdir(), `cornea-r2-api-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const safe = key.replace(/[\\/]/g, '__');
  const inFile = join(work, `in-${safe}`);
  const outFile = join(work, `out-${safe}`);
  try {
    writeFileSync(inFile, buf);
    wranglerPut(R2_BUCKET, key, inFile, contentType);
    wranglerGet(R2_BUCKET, key, outFile);
    const roundTrip = readFileSync(outFile);
    if (roundTrip.length !== buf.length) {
      throw new Error(`size mismatch api=${buf.length} r2=${roundTrip.length}`);
    }
    const a = createHash('sha256').update(buf).digest('hex');
    const b = createHash('sha256').update(roundTrip).digest('hex');
    if (a !== b) throw new Error('sha256 mismatch after round-trip');
  } finally {
    try { unlinkSync(inFile); } catch (_) { /* ignore */ }
    try { unlinkSync(outFile); } catch (_) { /* ignore */ }
    try { rmSync(work, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}

async function main() {
  console.log('\n=== API → R2 dry-run (no Spaces keys) ===\n');
  console.log(`API: ${API}`);
  console.log(`R2:  ${R2_BUCKET}`);
  console.log(`Limit: ${LIMIT}\n`);

  if (!EMAIL || !PASSWORD) {
    console.error('Set AUTH_EMAIL and AUTH_PASSWORD (same as Cloud Sign In).');
    console.error('This path uses the live API to read media — Spaces keys are not required.');
    process.exit(2);
  }

  const login = await api('POST', '/api/v1/auth/login', {
    body: { email: EMAIL, password: PASSWORD }
  });
  token = login.accessToken;
  if (!token) {
    console.error('Login failed — no accessToken');
    process.exit(2);
  }
  console.log(`Logged in as ${login.user?.email || EMAIL} (${login.user?.role || '?'})`);

  const listed = await api('GET', `/api/v1/media-library?limit=${LIMIT}&offset=0`);
  const assets = listed.data || [];
  console.log(`Media library returned ${assets.length} asset(s).\n`);

  if (!assets.length) {
    console.log('No media assets to copy — dry-run OK (empty library or no MEDIA_READ).');
    process.exit(0);
  }

  let copied = 0;
  let failed = 0;
  const failures = [];

  for (const asset of assets) {
    const id = asset.id;
    const storageKey = asset.storageKey;
    if (!id || !storageKey) {
      failed += 1;
      failures.push({ id, error: 'missing id or storageKey' });
      continue;
    }
    try {
      const { buf, contentType } = await api('GET', `/api/v1/media/${id}/content`, { raw: true });
      if (asset.byteSize && buf.length !== Number(asset.byteSize)) {
        console.warn(`  ! size differs from DB for ${id}: db=${asset.byteSize} got=${buf.length}`);
      }
      await putAndVerify(storageKey, buf, contentType || asset.mimeType || 'application/octet-stream');
      copied += 1;
      const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12);
      console.log(`  ✓ ${storageKey} (${buf.length} bytes, sha256=${sha}…)`);
    } catch (err) {
      failed += 1;
      failures.push({ id, key: storageKey, error: err.message || String(err) });
      console.error(`  ✗ ${storageKey || id} — ${err.message || err}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Copied:  ${copied}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Bucket:  ${R2_BUCKET} (staging — production MEDIA_* unchanged)\n`);

  if (failed) {
    for (const f of failures.slice(0, 10)) {
      console.error(`  - ${f.key || f.id}: ${f.error}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
