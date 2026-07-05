#!/usr/bin/env node
/**
 * Project 5 — backup & DR verification helpers (exported for tests).
 */
import fs from 'fs';
import path from 'path';

export function readTail(file, maxLines = 300) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(-maxLines).join('\n');
}

export function parseBackupConfig(repoRoot) {
  const cfgPath = path.join(repoRoot, 'scripts', 'backup-config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return {};
  }
}

export function latestProductionDump(backupsDir) {
  const prod = path.join(backupsDir, 'production');
  if (!fs.existsSync(prod)) return null;
  const dumps = fs
    .readdirSync(prod)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => {
      const full = path.join(prod, f);
      const st = fs.statSync(full);
      return { name: f, path: full, size: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dumps[0] || null;
}

export function backupLogFresh(logPath, maxAgeHours = 48) {
  if (!fs.existsSync(logPath)) {
    return { ok: false, reason: 'backup.log not found' };
  }
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  const lastOk = [...lines].reverse().find(
    (l) => /^\d{4}-\d{2}-\d{2}.*\sOK:\s.*\.dump\s*\(/.test(l) && !/Off-site/.test(l)
  );
  if (!lastOk) return { ok: false, reason: 'no OK entry in backup.log' };
  const m = lastOk.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return { ok: false, reason: 'cannot parse backup.log timestamp' };
  const ts = new Date(`${m[1]}T${m[2]}`);
  const ageH = (Date.now() - ts.getTime()) / 3_600_000;
  if (ageH > maxAgeHours) {
    return { ok: false, reason: `last OK ${Math.round(ageH)}h ago (limit ${maxAgeHours}h)`, lastOk: lastOk.trim() };
  }
  return { ok: true, reason: lastOk.trim(), ageHours: Math.round(ageH * 10) / 10 };
}

export function offsiteEncMatchesDump(dump, offsiteDir) {
  if (!dump) return { ok: false, reason: 'no production dump' };
  if (!offsiteDir) return { ok: false, reason: 'offsiteDir not configured' };
  const prodOffsite = path.join(offsiteDir, 'production');
  const encPath = path.join(prodOffsite, `${dump.name}.enc`);
  if (!fs.existsSync(encPath)) {
    return { ok: false, reason: `missing off-site file: ${encPath}` };
  }
  const encSize = fs.statSync(encPath).size;
  if (encSize < dump.size) {
    return { ok: false, reason: `off-site smaller than dump (${encSize} < ${dump.size})` };
  }
  return { ok: true, reason: `${path.basename(encPath)} (${encSize} bytes)`, encPath };
}

export function drillLogFresh(backupsDir, maxAgeDays = 30) {
  const candidates = [
    path.join(backupsDir, 'dr-drill.log'),
    path.join(backupsDir, 'stabilization-gates.log')
  ];
  for (const file of candidates) {
    const content = readTail(file);
    if (!content) continue;
    const passLine = [...content.split(/\r?\n/)].reverse().find((l) => /DRILL PASS|G1 Data safety: PASS|drill.*PASS/i.test(l));
    if (!passLine) continue;
    const dm = passLine.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dm) continue;
    const d = new Date(`${dm[1]}T12:00:00Z`);
    const ageDays = (Date.now() - d.getTime()) / 86_400_000;
    if (ageDays <= maxAgeDays) {
      return { ok: true, reason: passLine.trim(), source: path.basename(file), ageDays: Math.round(ageDays) };
    }
    return { ok: false, reason: `last drill ${Math.round(ageDays)}d ago (limit ${maxAgeDays}d)`, source: path.basename(file) };
  }
  return { ok: false, reason: 'no drill PASS in dr-drill.log or stabilization-gates.log' };
}

export function encryptionKeyPresent(repoRoot) {
  const keyPath = path.join(repoRoot, 'backup-encryption.key');
  if (!fs.existsSync(keyPath)) {
    return { ok: false, reason: 'backup-encryption.key missing' };
  }
  const len = fs.readFileSync(keyPath, 'utf8').trim().length;
  if (len < 32) return { ok: false, reason: 'encryption key file too short' };
  return { ok: true, reason: 'backup-encryption.key present' };
}
