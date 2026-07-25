/**
 * Encrypted read/write wrapper for the patients (visit) IndexedDB store.
 */
(function securePatientsModule(global) {
  'use strict';

  const MARKER = '_phiEnc';
  const STORE = typeof STORE_NAME !== 'undefined' ? STORE_NAME : 'patients';

  /** @type {CryptoKey[]} */
  let legacyKeys = [];

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
    const meta = {};
    // Never write id: undefined — IndexedDB keyPath + autoIncrement rejects it (DataError).
    if (record.id != null && record.id !== '' && !Number.isNaN(Number(record.id))) {
      meta.id = typeof record.id === 'number' ? record.id : Number(record.id);
    }
    const sensitive = {};
    for (const [k, v] of Object.entries(record)) {
      if (k === 'id' || k === MARKER) continue;
      if (META_KEYS.includes(k)) meta[k] = v;
      else sensitive[k] = v;
    }
    return { meta, sensitive };
  }

  /** Strip invalid primary keys so autoIncrement can assign a new id. */
  function sanitizePrimaryKey(record) {
    if (!record || typeof record !== 'object') return record;
    if (record.id == null || record.id === '' || Number.isNaN(Number(record.id))) {
      delete record.id;
    } else if (typeof record.id !== 'number') {
      record.id = Number(record.id);
    }
    return record;
  }

  async function wrapRecord(record) {
    if (!record || record[MARKER]) return record;
    sanitizePrimaryKey(record);
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
    if (!global.CorneaIdbCrypto?.hasSessionKey?.() && !legacyKeys.length) {
      return {
        ...meta,
        fullName: '[Locked]',
        patientId: meta.patientId || '—',
        _locked: true
      };
    }
    try {
      const result = await global.CorneaIdbCrypto.tryDecryptJsonWithFallbacks(enc, legacyKeys);
      if (!result) {
        return {
          ...meta,
          fullName: '[Decrypt error]',
          patientId: meta.patientId || '—',
          _locked: true,
          _decryptError: true
        };
      }
      const plain = { ...meta, ...result.data };
      // Lazily re-wrap records that only opened with a legacy token-derived key.
      if (result.usedLegacy && plain.id != null) {
        queueMicrotask(() => {
          put(plain).catch((err) => console.warn('[CorneaSecurePatients] rewrap failed', err));
        });
      }
      return plain;
    } catch (err) {
      console.error('[CorneaSecurePatients] decrypt failed', err);
      return {
        ...meta,
        fullName: '[Decrypt error]',
        patientId: meta.patientId || '—',
        _locked: true,
        _decryptError: true
      };
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
    sanitizePrimaryKey(record);
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

  /** Flatten GET /api/v1/visits/:id (nested) into the local IndexedDB visit shape. */
  function visitApiToLegacy(visit, localRow) {
    const patient = visit.patient && typeof visit.patient === 'object' ? visit.patient : {};
    const payload = visit.payload && typeof visit.payload === 'object' ? visit.payload : {};
    // Already-legacy sync payloads (from pull/serverState) are flat.
    if (visit.fullName || visit.uuid) {
      return {
        ...visit,
        id: localRow.id,
        uuid: visit.uuid || visit.id || localRow.uuid,
        patientId: visit.patientId || patient.mrn || localRow.patientId,
        sync_status: 'synced',
        revision: visit.revision ?? localRow.revision ?? 0
      };
    }
    return {
      ...payload,
      id: localRow.id,
      uuid: visit.id || localRow.uuid,
      patientId: patient.mrn || localRow.patientId || '',
      fullName: patient.fullName || '',
      dob: patient.dob || '',
      sex: patient.sex || '',
      phone: patient.phone || '',
      address: patient.address || '',
      visitDate: visit.visitDate || localRow.visitDate || '',
      revision: visit.revision ?? localRow.revision ?? 0,
      sync_status: 'synced',
      updated_at: visit.updatedAt || visit.updated_at || localRow.updated_at,
      lastModified: visit.updatedAt || visit.updated_at || localRow.lastModified
    };
  }

  async function fetchVisitForRecovery(apiFn, row) {
    const uuid = row.uuid;
    if (uuid) {
      try {
        const res = await apiFn(`/api/v1/visits/${encodeURIComponent(uuid)}`);
        return res?.data || res;
      } catch (err) {
        console.warn('[CorneaSecurePatients] recover by uuid failed', uuid, err?.message || err);
      }
    }
    const legacyId = row.id != null ? Number(row.id) : NaN;
    if (!Number.isNaN(legacyId)) {
      try {
        const res = await apiFn(`/api/v1/visits/legacy/${legacyId}`);
        return res?.data || res;
      } catch (err) {
        console.warn('[CorneaSecurePatients] recover by legacy id failed', legacyId, err?.message || err);
      }
    }
    return null;
  }

  /**
   * Recover records that fail local decrypt by re-pulling plaintext from cloud.
   */
  async function recoverFromCloud(apiFn) {
    if (!global.db || typeof apiFn !== 'function') return { recovered: 0, failed: 0 };
    const rows = await promisifyRequest(
      global.db.transaction([STORE], 'readonly').objectStore(STORE).getAll()
    );
    let recovered = 0;
    let failed = 0;
    for (const row of rows || []) {
      if (!row?.[MARKER]) continue;
      const probe = await unwrapRecord(row);
      if (!probe?._decryptError) continue;
      try {
        const visit = await fetchVisitForRecovery(apiFn, row);
        if (!visit || typeof visit !== 'object') {
          failed += 1;
          continue;
        }
        const plain = visitApiToLegacy(visit, row);
        delete plain._phiEnc;
        delete plain._locked;
        delete plain._decryptError;
        delete plain.patient;
        delete plain.payload;
        await put(plain);
        recovered += 1;
      } catch (err) {
        console.warn('[CorneaSecurePatients] cloud recover failed', row.uuid || row.id, err?.message || err);
        failed += 1;
      }
    }
    return { recovered, failed };
  }

  function setLegacyKeys(keys) {
    legacyKeys = (keys || []).filter(Boolean);
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
    sanitizePrimaryKey,
    isPlainPhi,
    get,
    put,
    getAll,
    getAllByIndex,
    remove,
    forEachCursor,
    migratePlainRecords,
    recoverFromCloud,
    setLegacyKeys
  };
})(typeof window !== 'undefined' ? window : globalThis);
