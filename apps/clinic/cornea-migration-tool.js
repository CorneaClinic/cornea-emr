/**
 * Cornea Clinic — IndexedDB migration exporter
 *
 * Reads all clinical IndexedDB stores, builds a checksum-verified export bundle,
 * and optionally uploads to PostgreSQL via the admin migration API.
 *
 * Usage (in Cornea.html or migrate.html):
 *   await CorneaMigration.exportAll();
 *   await CorneaMigration.downloadExport();
 *   await CorneaMigration.analyzeOnServer({ baseUrl, accessToken });
 *   await CorneaMigration.importToServer({ baseUrl, accessToken, dryRun: true });
 */
(function (global) {
  'use strict';

  const DB_NAME = 'CorneaClinicDB';
  const EXPORT_VERSION = '1.0';
  const CLINICAL_STORES = ['patients', 'kpPatients', 'kpTissues'];

  /** @type {Record<string, unknown[]> | null} */
  let lastExport = null;

  /**
   * @param {unknown} value
   */
  async function sha256(value) {
    const data = new TextEncoder().encode(JSON.stringify(value));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * @param {string} dbName
   * @param {number} [version]
   */
  function openDatabase(dbName = DB_NAME, version) {
    return new Promise((resolve, reject) => {
      const request = version != null ? indexedDB.open(dbName, version) : indexedDB.open(dbName);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * @param {IDBDatabase} db
   * @param {string} storeName
   */
  function readStore(db, storeName) {
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error(`Failed to read store: ${storeName}`));
    });
  }

  /**
   * Detect duplicate keys within an export bundle (client-side preview).
   * @param {ReturnType<typeof buildBundle>} bundle
   */
  function detectDuplicatesInExport(bundle) {
    const issues = [];
    const visitLocalIds = new Map();
    const visitUuids = new Map();

    for (const record of bundle.patients) {
      if (record.id != null) {
        const key = String(record.id);
        if (visitLocalIds.has(key)) {
          issues.push({ entity: 'visit', type: 'duplicate_local_id', value: key });
        } else {
          visitLocalIds.set(key, record);
        }
      }
      if (record.uuid) {
        const key = String(record.uuid);
        if (visitUuids.has(key)) {
          issues.push({ entity: 'visit', type: 'duplicate_uuid', value: key });
        } else {
          visitUuids.set(key, record);
        }
      }
    }

    const kpPatientIds = new Map();
    for (const record of bundle.kpPatients) {
      if (!record.kpPatientId) continue;
      const key = String(record.kpPatientId);
      if (kpPatientIds.has(key)) {
        issues.push({ entity: 'kp_patient', type: 'duplicate_kp_patient_id', value: key });
      } else {
        kpPatientIds.set(key, record);
      }
    }

    const kpTissueIds = new Map();
    for (const record of bundle.kpTissues) {
      if (!record.kpTissueId) continue;
      const key = String(record.kpTissueId);
      if (kpTissueIds.has(key)) {
        issues.push({ entity: 'kp_tissue', type: 'duplicate_kp_tissue_id', value: key });
      } else {
        kpTissueIds.set(key, record);
      }
    }

    return issues;
  }

  /**
   * @param {Record<string, unknown[]>} stores
   * @param {{ dbVersion?: number | null, source?: string }} meta
   */
  async function buildBundle(stores, meta = {}) {
    const patients = stores.patients || [];
    const kpPatients = stores.kpPatients || [];
    const kpTissues = stores.kpTissues || [];

    const base = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      source: meta.source || DB_NAME,
      dbVersion: meta.dbVersion ?? null,
      patients,
      kpPatients,
      kpTissues
    };

    const checksums = {
      patients: await sha256(patients),
      kpPatients: await sha256(kpPatients),
      kpTissues: await sha256(kpTissues),
      bundle: await sha256({ patients, kpPatients, kpTissues })
    };

    return {
      ...base,
      checksums,
      counts: {
        visits: patients.length,
        kpPatients: kpPatients.length,
        kpTissues: kpTissues.length
      }
    };
  }

  /**
   * Read all clinical IndexedDB records without modifying the database.
   * @param {{ db?: IDBDatabase }} [options]
   */
  async function exportAll(options = {}) {
    const db = options.db || global.db || (await openDatabase());
    const stores = {};

    for (const name of CLINICAL_STORES) {
      stores[name] = await readStore(db, name);
    }

    const bundle = await buildBundle(stores, {
      dbVersion: db.version,
      source: DB_NAME
    });

    bundle.localDuplicates = detectDuplicatesInExport(bundle);
    lastExport = bundle;
    return bundle;
  }

  /**
   * Load export from a previously downloaded JSON file.
   * @param {File | Blob} file
   */
  async function loadExportFile(file) {
    const text = await file.text();
    const raw = JSON.parse(text);

    if (Array.isArray(raw)) {
      const bundle = await buildBundle({ patients: raw, kpPatients: [], kpTissues: [] }, {
        source: 'legacy-array'
      });
      bundle.localDuplicates = detectDuplicatesInExport(bundle);
      lastExport = bundle;
      return bundle;
    }

    if (!raw || !Array.isArray(raw.patients)) {
      throw new Error('Export file must be a full bundle or legacy visits array');
    }

    const bundle = await buildBundle(
      {
        patients: raw.patients,
        kpPatients: Array.isArray(raw.kpPatients) ? raw.kpPatients : [],
        kpTissues: Array.isArray(raw.kpTissues) ? raw.kpTissues : []
      },
      {
        dbVersion: raw.dbVersion ?? raw.db_version ?? null,
        source: raw.source || DB_NAME
      }
    );

    if (raw.checksums) {
      for (const key of ['patients', 'kpPatients', 'kpTissues', 'bundle']) {
        if (raw.checksums[key] && raw.checksums[key] !== bundle.checksums[key]) {
          throw new Error(`Checksum mismatch for "${key}" — file may be corrupted`);
        }
      }
    }

    bundle.localDuplicates = detectDuplicatesInExport(bundle);
    lastExport = bundle;
    return bundle;
  }

  /**
   * @param {ReturnType<typeof buildBundle>} [bundle]
   */
  function downloadExport(bundle = lastExport) {
    if (!bundle) {
      throw new Error('No export available — call exportAll() or loadExportFile() first');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CorneaClinic_Migration_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return bundle;
  }

  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {string} options.accessToken
   * @param {ReturnType<typeof buildBundle>} [options.bundle]
   */
  async function analyzeOnServer(options) {
    const bundle = options.bundle || lastExport;
    if (!bundle) throw new Error('No export bundle — export or load a file first');

    const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}/api/v1/admin/migration/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.accessToken}`
      },
      body: JSON.stringify({ bundle })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || body.error || `Analyze failed (${res.status})`);
    }
    return body;
  }

  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {string} options.accessToken
   * @param {boolean} [options.dryRun]
   * @param {boolean} [options.forceUpdate]
   * @param {boolean} [options.skipExisting]
   * @param {ReturnType<typeof buildBundle>} [options.bundle]
   */
  async function importToServer(options) {
    const bundle = options.bundle || lastExport;
    if (!bundle) throw new Error('No export bundle — export or load a file first');

    const res = await fetch(`${options.baseUrl.replace(/\/$/, '')}/api/v1/admin/migration/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.accessToken}`
      },
      body: JSON.stringify({
        bundle,
        dryRun: options.dryRun === true,
        forceUpdate: options.forceUpdate === true,
        skipExisting: options.skipExisting !== false
      })
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || body.error || `Import failed (${res.status})`);
    }
    return body;
  }

  /**
   * Login helper for migrate.html
   * @param {{ baseUrl: string, email: string, password: string }} creds
   */
  async function login(creds) {
    const res = await fetch(`${creds.baseUrl.replace(/\/$/, '')}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Login failed (${res.status})`);
    }
    return {
      accessToken: data.accessToken || data.data?.accessToken,
      refreshToken: data.refreshToken || data.data?.refreshToken,
      user: data.user || data.data?.user
    };
  }

  global.CorneaMigration = {
    DB_NAME,
    CLINICAL_STORES,
    exportAll,
    loadExportFile,
    downloadExport,
    analyzeOnServer,
    importToServer,
    login,
    detectDuplicatesInExport,
    getLastExport: () => lastExport
  };
})(typeof window !== 'undefined' ? window : globalThis);
