/**
 * Encrypted read/write wrapper for the patients (visit) IndexedDB store.
 */
(function securePatientsModule(global) {
  'use strict';

  const MARKER = '_phiEnc';
  const STORE = typeof STORE_NAME !== 'undefined' ? STORE_NAME : 'patients';

  function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function isPlainPhi(record) {
    return record && !record[MARKER] && (record.fullName || record.phone || record.diagnosis);
  }

  const META_KEYS = ['uuid', 'patientId', 'visitDate', 'sync_status', 'revision', 'client_mutation_id', 'updated_at', 'lastModified'];

  function splitRecord(record) {
    const meta = { id: record.id };
    const sensitive = {};
    for (const [k, v] of Object.entries(record)) {
      if (k === 'id' || k === MARKER) continue;
      if (META_KEYS.includes(k)) meta[k] = v;
      else sensitive[k] = v;
    }
    return { meta, sensitive };
  }

  async function wrapRecord(record) {
    if (!record || record[MARKER]) return record;
    if (!global.CorneaIdbCrypto?.hasSessionKey?.()) return record;
    const { meta, sensitive } = splitRecord(record);
    if (!Object.keys(sensitive).length) return record;
    const payload = await global.CorneaIdbCrypto.encryptJson(sensitive);
    return { ...meta, [MARKER]: payload };
  }

  async function unwrapRecord(stored) {
    if (!stored) return stored;
    if (!stored[MARKER]) return stored;
    const { [MARKER]: enc, ...meta } = stored;
    if (!global.CorneaIdbCrypto?.hasSessionKey?.()) {
      return {
        ...meta,
        fullName: '[Locked]',
        patientId: meta.patientId || '—',
        _locked: true
      };
    }
    try {
      const sensitive = await global.CorneaIdbCrypto.decryptJson(enc);
      return { ...meta, ...sensitive };
    } catch (err) {
      console.error('[CorneaSecurePatients] decrypt failed', err);
      return { ...meta, fullName: '[Decrypt error]', _locked: true };
    }
  }

  async function get(id) {
    if (!global.db) return null;
    const raw = await promisifyRequest(
      global.db.transaction([STORE], 'readonly').objectStore(STORE).get(id)
    );
    return unwrapRecord(raw);
  }

  async function put(record) {
    if (!global.db) throw new Error('Database not ready');
    const wrapped = await wrapRecord(record);
    const id = await promisifyRequest(
      global.db.transaction([STORE], 'readwrite').objectStore(STORE).put(wrapped)
    );
    return typeof id === 'number' ? id : record.id;
  }

  async function getAll() {
    if (!global.db) return [];
    const rows = await promisifyRequest(
      global.db.transaction([STORE], 'readonly').objectStore(STORE).getAll()
    );
    const out = [];
    for (const row of rows || []) {
      out.push(await unwrapRecord(row));
    }
    return out;
  }

  async function remove(id) {
    if (!global.db) return;
    await promisifyRequest(
      global.db.transaction([STORE], 'readwrite').objectStore(STORE).delete(id)
    );
  }

  async function forEachCursor(direction, fn) {
    if (!global.db) return;
    return new Promise((resolve, reject) => {
      const store = global.db.transaction([STORE], 'readonly').objectStore(STORE);
      const req = store.openCursor(null, direction || 'prev');
      req.onerror = () => reject(req.error);
      req.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve();
          return;
        }
        try {
          const record = await unwrapRecord(cursor.value);
          await fn(record, cursor);
          cursor.continue();
        } catch (err) {
          reject(err);
        }
      };
    });
  }

  async function migratePlainRecords(onProgress) {
    if (!global.db || !global.CorneaIdbCrypto?.hasSessionKey?.()) return { migrated: 0 };
    const rows = await promisifyRequest(
      global.db.transaction([STORE], 'readonly').objectStore(STORE).getAll()
    );
    let migrated = 0;
    for (const row of rows || []) {
      if (!isPlainPhi(row)) continue;
      const plain = await unwrapRecord(row);
      await put(plain);
      migrated += 1;
      if (onProgress) onProgress(migrated);
    }
    return { migrated };
  }

  async function getAllByIndex(indexName, value) {
    if (!global.db) return [];
    const rows = await promisifyRequest(
      global.db.transaction([STORE], 'readonly').objectStore(STORE).index(indexName).getAll(value)
    );
    const out = [];
    for (const row of rows || []) {
      out.push(await unwrapRecord(row));
    }
    return out;
  }

  global.CorneaSecurePatients = {
    MARKER,
    STORE,
    wrapRecord,
    unwrapRecord,
    isPlainPhi,
    get,
    put,
    getAll,
    getAllByIndex,
    remove,
    forEachCursor,
    migratePlainRecords
  };
})(typeof window !== 'undefined' ? window : globalThis);
