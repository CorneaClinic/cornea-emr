#!/usr/bin/env node
/**
 * Verify stabilization gates G1–G7 (Project 1 — Production Readiness).
 * Usage: node scripts/verify-stabilization-gates.mjs [--json]
 *
 * Exits 0 only when all gates PASS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUPS = path.join(ROOT, 'backups');
const jsonOut = process.argv.includes('--json');

const API = (process.env.PRODUCTION_API_URL || 'https://corneaclinic-2zfpt.ondigitalocean.app').replace(
  /\/$/,
  ''
);
const CLINIC = (process.env.CLINIC_URL || 'https://corneaclinic.visionemr.net/Cornea').replace(/\/$/, '');

function readTail(file, maxLines = 200) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(-maxLines).join('\n');
}

function latestBackupDump() {
  const prod = path.join(BACKUPS, 'production');
  if (!fs.existsSync(prod)) return null;
  const dumps = fs
    .readdirSync(prod)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => ({ f, m: fs.statSync(path.join(prod, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return dumps[0] || null;
}

function backupLogFresh(hours = 48) {
  const logPath = path.join(BACKUPS, 'production', 'backup.log');
  if (!fs.existsSync(logPath)) {
    return { ok: false, reason: 'backup.log not found (run scripts/backup-production.ps1 on clinic PC)' };
  }
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  const lastOk = [...lines].reverse().find((l) => /^\d{4}-\d{2}-\d{2}.*\sOK:/.test(l));
  if (!lastOk) return { ok: false, reason: 'no OK entry in backup.log' };
  const m = lastOk.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return { ok: false, reason: 'cannot parse backup.log date' };
  const d = new Date(`${m[1]}T12:00:00Z`);
  const ageH = (Date.now() - d.getTime()) / 3_600_000;
  if (ageH > hours) return { ok: false, reason: `last OK entry ${Math.round(ageH)}h ago (limit ${hours}h)` };
  return { ok: true, reason: lastOk.trim() };
}

function offsiteEncPresent() {
  try {
    const cfgPath = path.join(ROOT, 'scripts', 'backup-config.json');
    if (!fs.existsSync(cfgPath)) return { ok: false, reason: 'backup-config.json missing' };
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
    const dir = cfg.offsiteDir;
    if (!dir || !fs.existsSync(dir)) {
      return { ok: false, reason: `offsiteDir not found: ${dir || '(unset)'}` };
    }
    const enc = fs.readdirSync(dir).filter((f) => f.endsWith('.dump.enc'));
    if (!enc.length) return { ok: false, reason: 'no .dump.enc files in offsiteDir' };
    return { ok: true, reason: `${enc.length} encrypted dump(s) in offsiteDir` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function drillLogPass() {
  const gateLog = path.join(BACKUPS, 'stabilization-gates.log');
  const content = readTail(gateLog);
  if (!content) return { ok: false, reason: 'stabilization-gates.log empty (run log-stabilization-status.mjs)' };
  const pass = /G1 Data safety: PASS/.test(content);
  return pass
    ? { ok: true, reason: 'G1 PASS recorded in stabilization-gates.log' }
    : { ok: false, reason: 'G1 not PASS in stabilization-gates.log — run npm run drill:restore-local then log --drill-pass' };
}

async function fetchHealth() {
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(20_000) });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, body: {}, error: e.message };
  }
}

function runGlobalDebug() {
  const r = spawnSync(process.execPath, ['scripts/global-debug.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return {
    exit: r.status ?? 1,
    out,
    failed: Number((out.match(/Failed:\s+(\d+)/) || [])[1] || 1),
    passed: Number((out.match(/Passed:\s+(\d+)/) || [])[1] || 0)
  };
}

function runStabilizeCheck() {
  const r = spawnSync('npm', ['run', 'stabilize:check'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: process.env
  });
  return { exit: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function gateLogPass(pattern) {
  const content = readTail(path.join(BACKUPS, 'stabilization-gates.log'));
  return new RegExp(pattern).test(content);
}

function gateEvidenceFile(name) {
  const p = path.join(BACKUPS, 'gate-evidence', name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null;
}

async function main() {
  const health = await fetchHealth();
  const debug = runGlobalDebug();
  const stabilize = runStabilizeCheck();
  const backupFresh = backupLogFresh();
  const offsite = offsiteEncPresent();
  const drill = drillLogPass();
  const latestDump = latestBackupDump();

  const g1Checks = [
    { name: 'Production backup log fresh (<48h)', ...backupFresh },
    { name: 'Off-site encrypted dump present', ...offsite },
    { name: 'Restore drill logged PASS', ...drill },
    {
      name: 'Latest .dump file exists',
      ok: Boolean(latestDump),
      reason: latestDump ? latestDump.f : 'no .dump in backups/production/'
    }
  ];
  const g1Pass = g1Checks.every((c) => c.ok);

  const g2Pass =
    debug.out.includes('DO media provider') &&
    debug.out.includes('s3') &&
    debug.out.includes('MEDIA_S3_BUCKET');

  const g3Pass =
    debug.out.includes('DO AUTH_EXPOSE_REFRESH_IN_BODY') &&
    !debug.out.includes('true — set false') &&
    debug.out.includes('DO SMTP') &&
    !debug.out.includes('SMTP_HOST or SMTP_FROM missing') &&
    (gateEvidenceFile('g3-password-reset.pass') === 'PASS' || gateLogPass(/G3 Auth hardening: PASS/));

  const g3Partial =
    debug.out.includes('DO AUTH_EXPOSE_REFRESH_IN_BODY') &&
    !debug.out.includes('true — set false') &&
    debug.out.includes('DO SMTP');

  const g4Pass = stabilize.exit === 0 && /CI on main.*success/i.test(stabilize.out);

  const g5Pass =
    gateEvidenceFile('g5-sync-matrix.pass') === 'PASS' ||
    /sync-matrix green/i.test(readTail(path.join(BACKUPS, 'stabilization-gates.log')));

  const g6Pass =
    health.ok &&
    health.body?.checks?.redis?.mode === 'redis' &&
    health.body?.checks?.redis?.ok === true;

  const g7Pass =
    health.ok &&
    health.body?.checks?.database?.ok === true &&
    (gateEvidenceFile('g7-alert-drill.pass') === 'PASS' || gateLogPass(/G7 Observability: PASS/));

  const g7Partial = health.ok && health.body?.checks?.database?.ok === true;

  const gates = {
    G1: {
      name: 'Data safety',
      status: g1Pass ? 'PASS' : g1Checks.some((c) => c.ok) ? 'PARTIAL' : 'FAIL',
      checks: g1Checks,
      operator: [
        'Run scripts/setup-backup.ps1 on clinic PC',
        'Confirm CorneaEMR-ProductionBackup scheduled task',
        'npm run drill:restore-local then npm run phase0:verified -- --drill-pass'
      ]
    },
    G2: {
      name: 'Media durability',
      status: g2Pass ? 'PASS' : 'PARTIAL',
      checks: [{ name: 'S3 media on DigitalOcean', ok: g2Pass, reason: g2Pass ? 'MEDIA_STORAGE_PROVIDER=s3' : 'global-debug S3 check failed' }]
    },
    G3: {
      name: 'Auth hardening',
      status: g3Pass ? 'PASS' : g3Partial ? 'PARTIAL' : 'FAIL',
      checks: [
        { name: 'AUTH_EXPOSE_REFRESH_IN_BODY=false', ok: debug.out.includes('DO AUTH_EXPOSE_REFRESH_IN_BODY') && !debug.out.includes('true — set false'), reason: 'DO env' },
        { name: 'SMTP configured', ok: debug.out.includes('DO SMTP') && !debug.out.includes('SMTP_HOST or SMTP_FROM missing'), reason: 'DO env' },
        { name: 'Password-reset E2E', ok: g3Pass, reason: gateEvidenceFile('g3-password-reset.pass') === 'PASS' ? 'evidence file' : 'stabilization-gates.log' }
      ],
      operator: [
        'npm run verify:password-reset -- <email>',
        'Confirm reset email received; create backups/gate-evidence/g3-password-reset.pass with content PASS'
      ]
    },
    G4: {
      name: 'Regression safety',
      status: g4Pass ? 'PASS' : 'PARTIAL',
      checks: [
        { name: 'stabilize:check', ok: stabilize.exit === 0, reason: stabilize.exit === 0 ? 'green' : 'failed' },
        { name: 'CI green on main', ok: /CI on main.*success/i.test(stabilize.out), reason: 'pentest:self-check CI probe' }
      ]
    },
    G5: {
      name: 'Sync reliability',
      status: g5Pass ? 'PASS' : 'PARTIAL',
      checks: [{ name: 'Sync test matrix', ok: g5Pass, reason: g5Pass ? 'CI or gate evidence' : 'run npm run test:sync-matrix in CI; log --sync-matrix-pass' }],
      operator: ['Ensure CI sync-matrix job green; npm run phase0:verified -- --sync-matrix-pass']
    },
    G6: {
      name: 'Security baseline',
      status: g6Pass ? 'PASS' : 'OPEN',
      checks: [{ name: 'Redis rate limits active', ok: g6Pass, reason: g6Pass ? `mode=${health.body?.checks?.redis?.mode}` : health.error || 'redis not active' }]
    },
    G7: {
      name: 'Observability',
      status: g7Pass ? 'PASS' : g7Partial ? 'PARTIAL' : 'OPEN',
      checks: [
        { name: 'API health + DB', ok: g7Partial, reason: health.ok ? 'health OK' : health.error || 'unreachable' },
        { name: 'Alert drill confirmed', ok: g7Pass, reason: gateEvidenceFile('g7-alert-drill.pass') === 'PASS' ? 'evidence file' : 'stabilization-gates.log' }
      ],
      operator: ['npm run alert-drill:fail; confirm GitHub notification; create backups/gate-evidence/g7-alert-drill.pass with PASS']
    }
  };

  const summary = Object.entries(gates).map(([id, g]) => ({
    gate: id,
    name: g.name,
    status: g.status
  }));

  const allPass = summary.every((s) => s.status === 'PASS');

  if (jsonOut) {
    console.log(JSON.stringify({ allPass, gates, summary, api: API, timestamp: new Date().toISOString() }, null, 2));
  } else {
    console.log('\n=== Stabilization Gates G1–G7 (Project 1) ===\n');
    console.log(`API: ${API}`);
    console.log(`Clinic: ${CLINIC}\n`);
    for (const row of summary) {
      const icon = row.status === 'PASS' ? 'PASS' : row.status === 'PARTIAL' ? 'PARTIAL' : row.status;
      console.log(`  ${row.gate} ${row.name}: ${icon}`);
    }
    console.log('');
    for (const [id, g] of Object.entries(gates)) {
      if (g.status === 'PASS') continue;
      console.log(`--- ${id} details ---`);
      for (const c of g.checks || []) {
        console.log(`  [${c.ok ? 'OK' : 'X'}] ${c.name}: ${c.reason || ''}`);
      }
      if (g.operator?.length) {
        console.log('  Operator actions:');
        g.operator.forEach((a) => console.log(`    • ${a}`));
      }
      console.log('');
    }
    console.log(allPass ? 'ALL GATES PASS' : 'GATES INCOMPLETE — see operator actions above');
    console.log('Log snapshot: npm run phase0:verified (after operator steps)\n');
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
