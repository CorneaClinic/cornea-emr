#!/usr/bin/env node
/**
 * Fail CI when clinic scripts redeclare IndexedDB store globals from storage.js.
 * Non-IIFE scripts share window scope; duplicate const/var breaks module load order.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLINIC = path.join(__dirname, '..', 'apps', 'clinic');

const SKIP_DIRS = new Set(['node_modules']);
const SKIP_FILES = /^(build-phase|patch-phase)\d+\.js$/;

function listJsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      out.push(...listJsFiles(path.join(dir, ent.name)));
    } else if (ent.name.endsWith('.js') && !SKIP_FILES.test(ent.name)) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

function isIifeWrapped(source) {
  const trimmed = source.replace(/^\uFEFF?/, '').trimStart();
  return /^\(async\s+function|\(function/.test(trimmed);
}

function canonicalStoreGlobals() {
  const storagePath = path.join(CLINIC, 'js', 'storage.js');
  const source = fs.readFileSync(storagePath, 'utf8');
  const names = new Set();
  for (const m of source.matchAll(/^\s*var\s+(STORE_\w+)\s*=/gm)) {
    names.add(m[1]);
  }
  if (!names.size) {
    throw new Error('No STORE_* globals found in js/storage.js');
  }
  return names;
}

function findTopLevelRedeclarations(filePath, source, forbidden) {
  const hits = [];
  const lines = source.split(/\r?\n/);
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    const decl = line.match(/^\s*(?:const|var|let)\s+(STORE_\w+)\s*=/);
    if (depth === 0 && decl && forbidden.has(decl[1])) {
      hits.push({ line: i + 1, name: decl[1] });
    }
    depth += open - close;
    if (depth < 0) depth = 0;
  }
  return hits;
}

function main() {
  const forbidden = canonicalStoreGlobals();
  const files = listJsFiles(CLINIC);
  const violations = [];

  for (const file of files) {
    const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
    if (rel.endsWith('js/storage.js')) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (isIifeWrapped(source)) continue;
    const hits = findTopLevelRedeclarations(file, source, forbidden);
    for (const h of hits) {
      violations.push(`${rel}:${h.line} redeclares ${h.name} (owned by js/storage.js)`);
    }
  }

  if (violations.length) {
    console.error('Clinic global store collision(s):\n');
    for (const v of violations) console.error(`  ✗ ${v}`);
    console.error('\nUse globals from js/storage.js or wrap the module in an IIFE.');
    process.exit(1);
  }

  console.log(`Clinic globals OK — ${forbidden.size} store names, ${files.length} JS files scanned`);
}

main();
