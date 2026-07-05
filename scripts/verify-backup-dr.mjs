#!/usr/bin/env node
/**
 * Project 5 — verify backup & disaster recovery posture.
 * Usage: node scripts/verify-backup-dr.mjs [--json] [--report]
 *
 * Exits 0 when all checks PASS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  parseBackupConfig,
  latestProductionDump,
  backupLogFresh,
  offsiteEncMatchesDump,
  drillLogFresh,
  encryptionKeyPresent
} from './lib/backup-dr-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUPS = path.join(ROOT, 'backups');
const REPORT_DIR = path.join(BACKUPS, 'dr-reports');

const jsonOut = process.argv.includes('--json');
const writeReport = process.argv.includes('--report') || !jsonOut;

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(/\/$/, '');

function findPgRestore() {
  const pgRoot = 'C:\\Program Files\\PostgreSQL';
  if (!fs.existsSync(pgRoot)) return null;
  const versions = fs.readdirSync(pgRoot).sort((a, b) => Number(b) - Number(a));
  for (const v of versions) {
    const exe = path.join(pgRoot, v, 'bin', 'pg_restore.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function verifyDumpCatalog(dumpPath) {
  const pgRestore = findPgRestore();
  if (!pgRestore) {
    return { ok: true, skipped: true, reason: 'pg_restore not found (skipped catalog check)' };
  }
  const r = spawnSync(pgRestore, ['-l', dumpPath], { encoding: 'utf8' });
  if (r.status !== 0) {
    return { ok: false, reason: `pg_restore -l failed (exit ${r.status})` };
  }
  const lines = (r.stdout || '').split(/\r?\n/).filter(Boolean).length;
  return { ok: lines > 5, reason: `${lines} catalog entries`, lines };
}

async function checkMediaCloud() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    return { ok: true, skipped: true, reason: 'SEED_ADMIN_PASSWORD unset — skipped cloud media check' };
  }
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
  try {
    const login = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000)
    });
    const loginJson = await login.json().catch(() => ({}));
    if (!login.ok || !loginJson.accessToken) {
      return { ok: false, reason: `admin login failed (${login.status})` };
    }
    const dr = await fetch(`${API}/api/v1/admin/dr/status`, {
      headers: { Authorization: `Bearer ${loginJson.accessToken}` },
      signal: AbortSignal.timeout(20_000)
    });
    const body = await dr.json().catch(() => ({}));
    if (!dr.ok) return { ok: false, reason: `DR status ${dr.status}` };
    const integrity = body?.data?.mediaIntegritySample;
    const provider = body?.data?.storageProvider;
    if (!provider || provider === 'local') {
      return { ok: false, reason: 'media storage not on S3/Spaces' };
    }
    if (integrity && integrity.missing > 0) {
      return { ok: false, reason: `${integrity.missing}/${integrity.checked} sampled media files missing in object storage` };
    }
    return {
      ok: true,
      reason: `${provider} bucket OK; ${integrity?.checked || 0} assets sampled, ${integrity?.missing || 0} missing`
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function checkScheduledTasks() {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'scheduled task check is Windows-only' };
  }
  const r = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', "Get-ScheduledTask -TaskName 'CorneaEMR-*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty TaskName"],
    { encoding: 'utf8' }
  );
  const names = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const hasProd = names.some((n) => n.includes('ProductionBackup'));
  const hasDaily = names.some((n) => n.includes('DailyBackup'));
  if (hasProd && hasDaily) {
    return { ok: true, reason: names.join(', ') };
  }
  return {
    ok: false,
    reason: `missing tasks (found: ${names.join(', ') || 'none'}); run scripts/setup-backup.ps1`
  };
}

async function main() {
  const cfg = parseBackupConfig(ROOT);
  const prodLog = path.join(BACKUPS, 'production', 'backup.log');
  const dump = latestProductionDump(BACKUPS);

  const checks = [
    { id: 'B1', name: 'Production backup log fresh (<48h)', ...backupLogFresh(prodLog, 48) },
    { id: 'B2', name: 'Latest production .dump exists', ok: Boolean(dump), reason: dump ? `${dump.name} (${dump.size} bytes)` : 'none' },
    {
      id: 'B3',
      name: 'Dump catalog valid (pg_restore -l)',
      ...(dump ? verifyDumpCatalog(dump.path) : { ok: false, reason: 'no dump' })
    },
    {
      id: 'B4',
      name: 'Off-site encrypted copy matches latest dump',
      ...offsiteEncMatchesDump(dump, cfg.offsiteDir)
    },
    { id: 'B5', name: 'Encryption key present', ...encryptionKeyPresent(ROOT) },
    { id: 'B6', name: 'Restore drill logged (<30d)', ...drillLogFresh(BACKUPS, 30) },
    { id: 'B7', name: 'Windows backup scheduled tasks', ...checkScheduledTasks() },
    { id: 'B8', name: 'Cloud media storage integrity sample', ...(await checkMediaCloud()) }
  ];

  const pass = checks.every((c) => c.ok || c.skipped);
  const report = {
    generatedAt: new Date().toISOString(),
    project: 'P5-backup-dr',
    status: pass ? 'PASS' : checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
    checks,
    latestDump: dump ? { name: dump.name, size: dump.size, mtime: new Date(dump.mtimeMs).toISOString() } : null
  };

  if (writeReport) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const stamp = report.generatedAt.replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(REPORT_DIR, `${stamp}.json`), JSON.stringify(report, null, 2));
  }

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n=== Backup & DR verification (Project 5) ===\n');
    for (const c of checks) {
      const icon = c.ok ? 'PASS' : c.skipped ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${c.id} ${c.name}`);
      console.log(`         ${c.reason}`);
    }
    console.log(`\nOverall: ${report.status}\n`);
    if (writeReport) {
      console.log(`Report: backups/dr-reports/latest.json`);
      console.log('Dashboard: npm run dr:dashboard\n');
    }
  }

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
