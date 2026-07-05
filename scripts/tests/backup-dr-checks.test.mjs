import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  backupLogFresh,
  offsiteEncMatchesDump,
  drillLogFresh,
  encryptionKeyPresent
} from '../lib/backup-dr-checks.mjs';

describe('backup-dr-checks (P5)', () => {
  it('detects fresh backup log entry', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cornea-dr-'));
    const log = path.join(dir, 'backup.log');
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(log, `${today} 18:14:05  OK: test.dump (100 KB)\n`);
    assert.equal(backupLogFresh(log, 48).ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('flags stale backup log', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cornea-dr-'));
    const log = path.join(dir, 'backup.log');
    fs.writeFileSync(log, '2020-01-01 10:00:00  OK: old.dump\n');
    assert.equal(backupLogFresh(log, 48).ok, false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('matches off-site enc to dump size', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cornea-dr-'));
    const dumpDir = path.join(dir, 'production');
    fs.mkdirSync(dumpDir, { recursive: true });
    const dumpPath = path.join(dumpDir, 'test.dump');
    fs.writeFileSync(dumpPath, 'x'.repeat(1000));
    const dump = { name: 'test.dump', path: dumpPath, size: 1000 };
    const offsite = path.join(dir, 'offsite');
    fs.mkdirSync(path.join(offsite, 'production'), { recursive: true });
    fs.writeFileSync(path.join(offsite, 'production', 'test.dump.enc'), 'y'.repeat(1100));
    assert.equal(offsiteEncMatchesDump(dump, offsite).ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads drill pass from log', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cornea-dr-'));
    const log = path.join(dir, 'dr-drill.log');
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(log, `${today} 12:00:00  DRILL PASS — test\n`);
    assert.equal(drillLogFresh(dir, 30).ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('requires encryption key file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cornea-dr-'));
    assert.equal(encryptionKeyPresent(dir).ok, false);
    fs.writeFileSync(path.join(dir, 'backup-encryption.key'), Buffer.alloc(32).toString('base64'));
    assert.equal(encryptionKeyPresent(dir).ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
