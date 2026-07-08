#!/usr/bin/env node
/**
 * OWASP ZAP DAST orchestrator for Cornea EMR.
 *
 * Defaults: local clinic (8080) + API (3000). Blocks production for active scans.
 *
 * Usage:
 *   npm run dast:setup-users
 *   npm run dast:scan
 *   npm run dast:scan -- --passive-only
 *
 * Env:
 *   DAST_CLINIC_URL   default http://127.0.0.1:8080
 *   DAST_API_URL      default http://127.0.0.1:3000
 *   DAST_ACTIVE_SCAN  default true (set false for passive-only)
 *   ZAP_PATH          path to zap.bat / zap.sh
 *   ZAP_PORT          default 8090 (avoids clinic on 8080)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { assertSafeDastTargets } from './lib/safe-target.mjs';
import { loadDastCredentials, loginRole, setupDastUsers } from './setup-dast-users.mjs';
import { writeOpenApiSeed } from './lib/openapi-seed.mjs';
import {
  startZapDaemon,
  shutdownZap,
  newSession,
  setBearerReplacer,
  accessUrl,
  spiderScan,
  ajaxSpiderScan,
  waitPassiveScan,
  activeScan,
  importOpenApi,
  getAlerts,
  excludeFromSpider,
  generateHtmlReport
} from './lib/zap-api.mjs';
import { analyzeAlerts, writeReports } from './lib/report-analyzer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(ROOT, 'docs', 'dast-reports');
const FIXTURE_UPLOAD = path.join(__dirname, 'fixtures', 'dast-upload.txt');

const CLINIC_URL = (process.env.DAST_CLINIC_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const API_URL = (process.env.DAST_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PASSIVE_ONLY =
  process.argv.includes('--passive-only') ||
  process.env.DAST_ACTIVE_SCAN === 'false' ||
  process.env.DAST_ACTIVE_SCAN === '0';

function clinicEntry() {
  return `${CLINIC_URL}/Cornea.html?cloud=1`;
}

async function ensureStackReachable() {
  for (const url of [`${API_URL}/health/live`, clinicEntry()]) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`DAST preflight failed: ${url} → HTTP ${res.status}`);
  }
}

const DAST_TEMP_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store'
};

function serveOpenApiTemp(specPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/openapi-dast-seed.json') {
        res.writeHead(200, DAST_TEMP_HEADERS);
        res.end(fs.readFileSync(specPath));
      } else {
        res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' });
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}/openapi-dast-seed.json`,
        close: () => new Promise((r) => server.close(() => r()))
      });
    });
    server.on('error', reject);
  });
}

async function probeFileUpload(apiUrl, token, deviceId = 'dast-zap-scanner') {
  if (!fs.existsSync(FIXTURE_UPLOAD)) return { skipped: true };
  const patients = await fetch(`${apiUrl}/api/v1/patients?limit=1`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId }
  });
  if (!patients.ok) return { skipped: true, reason: 'no patient list' };
  const list = await patients.json();
  const patientId = list?.data?.[0]?.id;
  if (!patientId) return { skipped: true, reason: 'no patients' };

  const form = new FormData();
  form.append(
    'file',
    new Blob([fs.readFileSync(FIXTURE_UPLOAD)], { type: 'text/plain' }),
    'dast-upload.txt'
  );

  const res = await fetch(`${apiUrl}/api/v1/patients/${patientId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Device-Id': deviceId },
    body: form
  });
  return { status: res.status, ok: res.ok };
}

async function scanAsRole(base, roleUser, password, apiUrl) {
  const deviceId = `dast-zap-${roleUser.role}`;
  const token = await loginRole(apiUrl, roleUser.email, password, deviceId);
  await newSession(base, `cornea-dast-${roleUser.role}`);
  await setBearerReplacer(base, token, apiUrl, deviceId);

  const clinic = clinicEntry();
  await accessUrl(base, clinic);
  console.log(`[DAST] Spider scan: ${clinic}`);
  await spiderScan(base, clinic, 120);
  try {
    await ajaxSpiderScan(base, clinic);
  } catch (err) {
    console.warn(`[DAST] Ajax spider skipped for ${roleUser.role}: ${err.message}`);
  }

  const seedDir = path.join(ROOT, 'docs', 'dast-reports', '.tmp');
  const specPath = writeOpenApiSeed(apiUrl, seedDir);
  const oas = await serveOpenApiTemp(specPath);
  try {
    await importOpenApi(base, oas.url);
  } finally {
    await oas.close();
  }

  await probeFileUpload(apiUrl, token, deviceId);
  console.log('[DAST] Waiting for passive scan queue…');
  await waitPassiveScan(base);

  if (!PASSIVE_ONLY) {
    await activeScan(base, clinic, 'Low');
    await activeScan(base, apiUrl, 'Low');
  }

  const alerts = await getAlerts(base);
  return analyzeAlerts(alerts, {
    clinicUrl: CLINIC_URL,
    apiUrl,
    role: roleUser.role,
    scanMode: PASSIVE_ONLY ? 'passive' : 'passive+active'
  });
}

async function main() {
  console.log('\n=== Cornea EMR — OWASP ZAP DAST ===\n');
  assertSafeDastTargets({
    clinicUrl: CLINIC_URL,
    apiUrl: API_URL,
    activeScan: !PASSIVE_ONLY,
    allowProductionPassive: process.env.DAST_ALLOW_PRODUCTION_PASSIVE === '1'
  });

  await ensureStackReachable();

  let creds;
  try {
    creds = loadDastCredentials();
  } catch {
    console.log('Setting up DAST users in test database…');
    creds = await setupDastUsers();
  }

  console.log('Starting OWASP ZAP daemon (port 8090)…');
  const { base } = await startZapDaemon();
  console.log(`ZAP ready at ${base}`);

  const apiOrigin = creds.apiUrl || API_URL;
  await excludeFromSpider(base, `.*${new URL(apiOrigin).host}/api/v1/auth/.*`);
  console.log('[DAST] Excluded /api/v1/auth/* from spider (prevents login rate-limit noise)');
  const allAlerts = [];
  const roleReports = [];

  try {
    for (const user of creds.users) {
      console.log(`\n--- Scanning as ${user.role} (${user.email}) ---\n`);
      const report = await scanAsRole(base, user, creds.password, creds.apiUrl || API_URL);
      roleReports.push(report);
      allAlerts.push(...report.alerts.map((a) => ({ ...a, role: user.role })));
      await new Promise((r) => setTimeout(r, 2000));
    }

    const merged = analyzeAlerts(
      allAlerts.map((a) => ({
        alert: a.alert,
        risk: a.risk,
        confidence: a.confidence,
        url: a.url,
        param: a.param,
        evidence: a.evidence,
        cweid: a.cweid,
        wascid: a.wascid,
        desc: a.explanation
      })),
      {
        clinicUrl: CLINIC_URL,
        apiUrl: creds.apiUrl || API_URL,
        role: 'all',
        scanMode: PASSIVE_ONLY ? 'passive' : 'passive+active',
        rolesScanned: creds.users.map((u) => u.role)
      }
    );

    const paths = writeReports(merged, REPORT_DIR);

    try {
      const htmlOut = await generateHtmlReport(base, REPORT_DIR, 'dast-latest.html');
      console.log(`HTML report: ${htmlOut}`);
    } catch (err) {
      console.warn(`ZAP HTML export skipped: ${err.message}`);
    }

    fs.writeFileSync(
      path.join(REPORT_DIR, 'dast-by-role.json'),
      JSON.stringify(roleReports, null, 2),
      'utf8'
    );

    console.log('\n=== DAST complete ===');
    console.log(`JSON: ${paths.jsonLatest}`);
    console.log(`Markdown: ${paths.mdPath}`);
    console.log(`Alerts: ${merged.alerts.length} (High: ${merged.summary.byRisk?.High || 0})`);
    console.log('\nReview proposed fixes in the Markdown report before applying.\n');
  } finally {
    await shutdownZap(base);
  }
}

main().catch((err) => {
  console.error('\nDAST failed:', err.message || err);
  console.error('\nInstall ZAP: https://www.zaproxy.org/download/');
  console.error('Then set ZAP_PATH or re-run after installation.\n');
  process.exit(1);
});
