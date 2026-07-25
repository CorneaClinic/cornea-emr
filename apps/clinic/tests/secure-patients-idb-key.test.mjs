/**
 * Regression: encrypted new-visit put must not set id: undefined.
 * IndexedDB autoIncrement rejects an explicit invalid keyPath value.
 *
 * Run: node apps/clinic/tests/secure-patients-idb-key.test.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
require('fake-indexeddb/auto');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  ✓', msg);
  } else {
    failed += 1;
    console.error('  ✗', msg);
  }
}

function loadSecurePatients(global) {
  const src = readFileSync(join(root, 'cornea-secure-patients.js'), 'utf8');
  // Module attaches to global / window.
  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'globalThis', src + '\n;return window.CorneaSecurePatients;');
  return run(global, global);
}

async function openPatientsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('secure-patients-key-test', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run() {
  console.log('secure-patients-idb-key.test.mjs\n');

  const global = {
    db: null,
    CorneaIdbCrypto: {
      hasSessionKey: () => true,
      encryptJson: async (obj) => ({ v: 1, payload: JSON.stringify(obj) }),
      decryptJson: async (wrapped) => JSON.parse(wrapped.payload)
    }
  };

  const Secure = loadSecurePatients(global);
  assert(!!Secure?.put, 'CorneaSecurePatients.put is available');
  assert(typeof Secure.put === 'function', 'put is a function');

  // Guard: the bug was always writing meta.id even when undefined.
  const wrapped = await Secure.wrapRecord({
    fullName: 'New Patient',
    patientId: 'CC-2026-0001',
    visitDate: '2026-07-25',
    uuid: '11111111-1111-4111-8111-111111111111',
    revision: 0,
    sync_status: 'pending'
  });
  assert(!Object.prototype.hasOwnProperty.call(wrapped, 'id'), 'wrapRecord omits id for new visits');
  assert(!!wrapped._phiEnc, 'wrapRecord encrypts sensitive fields');

  global.db = await openPatientsDb();

  const record = {
    fullName: 'New Patient',
    phone: '+252 61 0000000',
    patientId: 'CC-2026-0001',
    visitDate: '2026-07-25',
    uuid: '22222222-2222-4222-8222-222222222222',
    revision: 0,
    sync_status: 'pending',
    client_mutation_id: '33333333-3333-4333-8333-333333333333'
  };

  let savedId;
  try {
    savedId = await Secure.put(record);
    assert(typeof savedId === 'number' && Number.isFinite(savedId), 'put assigns numeric autoIncrement id');
    assert(record.id === savedId, 'put writes id back onto the record');
  } catch (err) {
    assert(false, `put new encrypted visit must not throw: ${err.message}`);
  }

  // Explicit invalid keys must be stripped, not written.
  const bad = { id: undefined, fullName: 'Bad', patientId: 'CC-2', visitDate: '2026-07-25' };
  try {
    const id = await Secure.put(bad);
    assert(typeof id === 'number', 'put strips undefined id and autoIncrements');
  } catch (err) {
    assert(false, `undefined id must be stripped: ${err.message}`);
  }

  const badNull = { id: null, fullName: 'BadNull', patientId: 'CC-3', visitDate: '2026-07-25' };
  try {
    const id = await Secure.put(badNull);
    assert(typeof id === 'number', 'put strips null id and autoIncrements');
  } catch (err) {
    assert(false, `null id must be stripped: ${err.message}`);
  }

  // Update path keeps the existing numeric id.
  record.fullName = 'Updated Name';
  const again = await Secure.put(record);
  assert(again === savedId, 'update keeps the same local id');

  const loaded = await Secure.get(savedId);
  assert(loaded?.fullName === 'Updated Name', 'get decrypts updated fullName');
  assert(loaded?.patientId === 'CC-2026-0001', 'get keeps plaintext patientId meta');

  global.db.close();
  indexedDB.deleteDatabase('secure-patients-key-test');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
