/**
 * Node smoke tests for Pentacam + Sirius CSV parsers.
 * Run: node apps/clinic/tests/topography-import.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clinicDir = join(__dirname, '..');

function loadParser() {
  const code = readFileSync(join(clinicDir, 'cornea-pentacam-import.js'), 'utf8');
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox.globalThis;
  vm.runInNewContext(code, sandbox, { filename: 'cornea-pentacam-import.js' });
  return sandbox.window.CorneaTopographyImport || sandbox.globalThis.CorneaTopographyImport;
}

const parser = loadParser();
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', msg);
  }
}

const pentacamCsv = `Patient,Eye,Exam Date,Kmax,Kmean,Pachy Min,BAD-D
Doe John,OD,2025-03-01,48.2,44.1,512,1.45
Doe John,OS,2025-03-01,47.8,43.9,518,1.32`;

const siriusCsv = `Patient;Eye;Date;Kmax;Kmean;CCT;Thin Pach;ISV;IVA;CKI
Smith;OD;15.02.2025;49.1;44.5;540;498;32;0.28;1.04
Smith;OS;15.02.2025;48.0;43.8;535;505;28;0.22;0.98`;

const pentacam = parser.parsePentacamCsv(pentacamCsv);
assert(pentacam.readings.length === 2, 'Pentacam: two readings');
assert(pentacam.readings[0].device === 'Pentacam', 'Pentacam device tag');
assert(pentacam.readings[0].kmax === 48.2, 'Pentacam Kmax');

const sirius = parser.parseSiriusCsv(siriusCsv);
assert(sirius.readings.length === 2, 'Sirius: two readings');
assert(sirius.readings[0].device === 'Sirius', 'Sirius device tag');
assert(sirius.readings[0].thinnestPachy === 498, 'Sirius thin pachymetry');
assert(sirius.readings[0].badD === 1.04, 'Sirius CKI mapped to badD');
assert(sirius.readings[0].notes?.includes('ISV'), 'Sirius index notes');

const auto = parser.parseTopographyCsv(siriusCsv);
assert(auto.device === 'Sirius', 'Auto-detect Sirius format');

const kcRow = parser.toKcTopoRow(sirius.readings[0], 42);
assert(kcRow.kcTopoDevice === 'Sirius', 'KC row device Sirius');
assert(kcRow.kcTopoNotes.includes('Sirius'), 'KC row import note');

console.log(`Topography import tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
