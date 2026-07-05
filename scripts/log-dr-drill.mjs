#!/usr/bin/env node
/**
 * Append DR drill result to backups/dr-drill.log
 * Usage: node scripts/log-dr-drill.mjs [--pass|--fail] [--note "message"]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKUPS = path.join(ROOT, 'backups');
const DRILL_LOG = path.join(BACKUPS, 'dr-drill.log');
const EVIDENCE = path.join(BACKUPS, 'gate-evidence');

const pass = process.argv.includes('--pass') || !process.argv.includes('--fail');
const noteIdx = process.argv.indexOf('--note');
const note = noteIdx >= 0 ? process.argv[noteIdx + 1] : '';

const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
const status = pass ? 'DRILL PASS' : 'DRILL FAIL';
const line = `${ts}  ${status}${note ? ` — ${note}` : ''}\n`;

fs.mkdirSync(BACKUPS, { recursive: true });
fs.mkdirSync(EVIDENCE, { recursive: true });
fs.appendFileSync(DRILL_LOG, line, 'utf8');
fs.writeFileSync(path.join(EVIDENCE, 'p5-dr-drill.pass'), pass ? 'PASS' : 'FAIL', 'utf8');
console.log(line.trim());
