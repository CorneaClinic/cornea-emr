import https from 'https';
import { query } from '../db/pool.js';
import { encryptSecret, decryptSecret } from '../core/secrets-crypto.js';
import { ValidationError, NotFoundError } from '../core/errors.js';

const TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
const ICD_API = 'https://id.who.int';
const ICD_RELEASES = ['2026-01', '2024-01', '2023-01'];

/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * @param {string} clinicId
 */
async function getClinicCredentials(clinicId) {
  const { rows } = await query(
    `SELECT client_id, client_secret_encrypted FROM icd_credentials WHERE clinic_id = $1 LIMIT 1`,
    [clinicId]
  );
  if (!rows[0]) return null;
  return {
    clientId: rows[0].client_id,
    clientSecret: decryptSecret(rows[0].client_secret_encrypted)
  };
}

async function fetchWhoToken(clientId, clientSecret) {
  const cacheKey = clientId;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await httpsRequest(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`
    }
  }, 'grant_type=client_credentials&scope=icdapi_access');

  if (res.status !== 200) {
    throw new Error(`WHO token request failed (${res.status})`);
  }

  const data = JSON.parse(res.body);
  const expiresAt = Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt });
  return data.access_token;
}

async function searchIcd(token, q) {
  const headers = {
    Accept: 'application/json',
    'API-Version': 'v2',
    'Accept-Language': 'en',
    Authorization: `Bearer ${token}`
  };

  for (const release of ICD_RELEASES) {
    const url = `${ICD_API}/icd/release/11/${release}/mms/search?q=${encodeURIComponent(q)}&flatResults=true&useFlexisearch=true`;
    const res = await httpsRequest(url, { method: 'GET', headers });
    if (res.status === 200) return JSON.parse(res.body);
    if (res.status !== 404) break;
  }

  return { destinationEntities: [] };
}

/**
 * @param {string} clinicId
 */
export async function getIcdStatus(clinicId) {
  const creds = await getClinicCredentials(clinicId);
  return {
    configured: !!creds,
    clientId: creds ? maskClientId(creds.clientId) : null
  };
}

function maskClientId(id) {
  if (!id || id.length < 8) return '****';
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/**
 * @param {string} clinicId
 * @param {string} q
 */
export async function searchIcdForClinic(clinicId, q) {
  const queryText = String(q || '').trim();
  if (queryText.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters');
  }

  const creds = await getClinicCredentials(clinicId);
  if (!creds) {
    throw new NotFoundError('ICD credentials not configured for this clinic');
  }

  const token = await fetchWhoToken(creds.clientId, creds.clientSecret);
  return searchIcd(token, queryText);
}

/**
 * @param {string} clinicId
 * @param {string} clientId
 * @param {string} clientSecret
 */
export async function saveIcdCredentials(clinicId, clientId, clientSecret) {
  const id = String(clientId || '').trim();
  const secret = String(clientSecret || '').trim();
  if (!id || !secret) {
    throw new ValidationError('clientId and clientSecret are required');
  }

  const encrypted = encryptSecret(secret);

  await query(
    `
      INSERT INTO icd_credentials (clinic_id, client_id, client_secret_encrypted)
      VALUES ($1, $2, $3)
      ON CONFLICT (clinic_id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        client_secret_encrypted = EXCLUDED.client_secret_encrypted,
        updated_at = now()
    `,
    [clinicId, id, encrypted]
  );

  tokenCache.delete(id);
  return { configured: true, clientId: maskClientId(id) };
}

/**
 * @param {string} clinicId
 */
export async function deleteIcdCredentials(clinicId) {
  const { rowCount } = await query(
    `DELETE FROM icd_credentials WHERE clinic_id = $1`,
    [clinicId]
  );
  return { deleted: rowCount > 0 };
}
