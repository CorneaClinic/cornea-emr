/**
 * Cornea Clinic — IndexedDB storage, export/import/clear
 * Phase 2 extraction from Cornea.html
 */
window.db = null;
var DB_NAME = "CorneaClinicDB";
var STORE_NAME = "patients";
var DB_VERSION = 11;
var STORE_USERS = 'users';
var STORE_SYNC_QUEUE = 'sync_queue';
var STORE_SYNC_META = 'sync_meta';
var STORE_SYNC_LOGS = 'sync_logs';
var STORE_KP_PATIENTS = 'kpPatients';
var STORE_KP_TISSUES = 'kpTissues';

function initDB() {
    try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            alert("Could not open local database. Please ensure your browser supports IndexedDB.");
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            let objectStore;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                objectStore = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            } else {
                objectStore = event.target.transaction.objectStore(STORE_NAME);
            }
            const indices = ["fullName", "phone", "visitDate", "patientId"];
            indices.forEach(idx => {
                if (!objectStore.indexNames.contains(idx)) {
                    objectStore.createIndex(idx, idx, { unique: false });
                }
            });
            if (!db.objectStoreNames.contains(STORE_KP_PATIENTS)) {
                const kp = db.createObjectStore(STORE_KP_PATIENTS, { keyPath: "id", autoIncrement: true });
                kp.createIndex('kpPatientId', 'kpPatientId', { unique: true });
                kp.createIndex('kpStatus', 'kpStatus', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_KP_TISSUES)) {
                const kt = db.createObjectStore(STORE_KP_TISSUES, { keyPath: "id", autoIncrement: true });
                kt.createIndex('kpTissueId', 'kpTissueId', { unique: true });
                kt.createIndex('kpTissueStatus', 'kpTissueStatus', { unique: false });
            }
            if (window.CorneaSync && typeof window.CorneaSync.ensureSyncStores === 'function') {
                window.CorneaSync.ensureSyncStores(db, event);
            } else {
                if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
                    const sq = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'mutation_id' });
                    sq.createIndex('status', 'status', { unique: false });
                    sq.createIndex('created_at', 'created_at', { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_SYNC_META)) {
                    db.createObjectStore(STORE_SYNC_META, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(STORE_SYNC_LOGS)) {
                    const sl = db.createObjectStore(STORE_SYNC_LOGS, { keyPath: 'id' });
                    sl.createIndex('created_at', 'created_at', { unique: false });
                }
            }
            if (window.CorneaOfflineAuth && typeof window.CorneaOfflineAuth.ensureUsersStore === 'function') {
                window.CorneaOfflineAuth.ensureUsersStore(db, event);
            }
            if (window.CorneaAudit && typeof window.CorneaAudit.ensureAuditStore === 'function') {
                window.CorneaAudit.ensureAuditStore(db);
            }
            if (window.CorneaMediaBlobStore && typeof window.CorneaMediaBlobStore.ensureStore === 'function') {
                window.CorneaMediaBlobStore.ensureStore(db, event);
            }
            if (window.CorneaKcCxl && typeof window.CorneaKcCxl.ensureStores === 'function') {
                window.CorneaKcCxl.ensureStores(db, event);
            }
            if (window.CorneaKpGraftOutcomes && typeof window.CorneaKpGraftOutcomes.ensureStores === 'function') {
                window.CorneaKpGraftOutcomes.ensureStores(db, event);
            }
            if (window.CorneaEyeBank && typeof window.CorneaEyeBank.ensureStores === 'function') {
                window.CorneaEyeBank.ensureStores(db, event);
            }
            if (window.CorneaKeratitis && typeof window.CorneaKeratitis.ensureStores === 'function') {
                window.CorneaKeratitis.ensureStores(db, event);
            }
            if (window.CorneaAppointments && typeof window.CorneaAppointments.ensureStores === 'function') {
                window.CorneaAppointments.ensureStores(db, event);
            }
        };

        request.onsuccess = (event) => {
            window.db = event.target.result;
            window.__corneaIdbReady = true;
            if (typeof window.__corneaOnCloudReady === 'function') {
                window.__corneaOnCloudReady().catch((err) => {
                    console.warn('[CorneaClinic] Cloud bootstrap after IndexedDB open failed:', err);
                });
            }
            if (typeof window.setupFieldListeners === 'function') {
                window.setupFieldListeners();
            } else             if (typeof setupFieldListeners === 'function') {
                setupFieldListeners();
            }
            // Offline auth UI is initialized by initAfterCloudCheck in Cornea.html
        };
    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

window.initDB = initDB;

window.exportDatabase = async function() {
    if (!window.CorneaOfflineAuth?.hasPermission?.('database:export')) {
        alert('You do not have permission to export the database.');
        return;
    }
    if (!window.db) return;
    if (window.CorneaMigration) {
        try {
            const bundle = await CorneaMigration.exportAll({ db: window.db });
            CorneaMigration.downloadExport(bundle);
            return;
        } catch (err) {
            console.warn('[exportDatabase] Full migration export failed, falling back to visits-only.', err);
        }
    }
    window.db.transaction([STORE_NAME], "readonly").objectStore(STORE_NAME).getAll().onsuccess = (e) => {
        const blob = new Blob([JSON.stringify(e.target.result, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CorneaClinic_Export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
};

window.importDatabase = function(input) {
    if (!window.CorneaOfflineAuth?.hasPermission?.('database:import')) {
        alert('You do not have permission to import the database.');
        if (input) input.value = '';
        return;
    }
    if (!window.db) return;
    const file = input.files[0];
    if (!file) return;

    const reqP = (req) => new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    // Imports one store; skips records whose uuid or natural key already exists.
    async function importStore(storeName, records, naturalKey) {
        if (!records.length || !window.db.objectStoreNames.contains(storeName)) {
            return { storeName, added: 0, skipped: 0 };
        }

        const existing = await reqP(
            window.db.transaction([storeName], 'readonly').objectStore(storeName).getAll()
        );
        const seenUuids = new Set(existing.map(r => r.uuid).filter(Boolean));
        const seenNatural = new Set(existing.map(naturalKey).filter(Boolean));

        return new Promise((resolve) => {
            const txn = window.db.transaction([storeName], 'readwrite');
            const store = txn.objectStore(storeName);
            let added = 0, skipped = 0;

            for (const item of records) {
                const rec = { ...item };
                delete rec.id;
                const natural = naturalKey(rec);
                if ((rec.uuid && seenUuids.has(rec.uuid)) || (natural && seenNatural.has(natural))) {
                    skipped++;
                    continue;
                }
                if (rec.uuid) seenUuids.add(rec.uuid);
                if (natural) seenNatural.add(natural);
                if (!rec.uuid) {
                    // No server identity — let the sync client enqueue it for upload
                    delete rec.sync_status;
                    delete rec.client_mutation_id;
                    delete rec.revision;
                }
                const req = store.add(rec);
                req.onsuccess = () => { added++; };
                req.onerror = (ev) => { ev.preventDefault(); skipped++; };
            }

            const done = () => resolve({ storeName, added, skipped });
            txn.oncomplete = done;
            txn.onerror = done;
            txn.onabort = done;
        });
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const raw = JSON.parse(e.target.result);

            // Accept both the full export bundle and the legacy visits array
            let bundle;
            if (Array.isArray(raw)) {
                bundle = { patients: raw, kpPatients: [], kpTissues: [] };
            } else if (raw && Array.isArray(raw.patients)) {
                bundle = {
                    patients: raw.patients,
                    kpPatients: Array.isArray(raw.kpPatients) ? raw.kpPatients : [],
                    kpTissues: Array.isArray(raw.kpTissues) ? raw.kpTissues : []
                };
            } else {
                throw new Error('Unrecognized backup format');
            }

            const results = [
                await importStore(STORE_NAME, bundle.patients,
                    r => (r.patientId && r.visitDate) ? `${r.patientId}|${r.visitDate}` : ''),
                await importStore(STORE_KP_PATIENTS, bundle.kpPatients,
                    r => r.kpPatientId || ''),
                await importStore(STORE_KP_TISSUES, bundle.kpTissues,
                    r => r.kpTissueId || '')
            ];

            const labels = { [STORE_NAME]: 'Patient visits', [STORE_KP_PATIENTS]: 'Keratoplasty patients', [STORE_KP_TISSUES]: 'Corneal tissues' };
            alert('Import finished:\n' + results
                .map(r => `${labels[r.storeName] || r.storeName}: ${r.added} added, ${r.skipped} skipped`)
                .join('\n'));

            if (window.CorneaAudit) {
                await window.CorneaAudit.logRestore({
                    fileName: file.name,
                    importedAt: new Date().toISOString(),
                    results: results.map((r) => ({
                        store: labels[r.storeName] || r.storeName,
                        added: r.added,
                        skipped: r.skipped
                    }))
                });
            }

            loadRecords();
            updateDashboardStats();
            window.refreshPatientVisitHistory?.();
            if (typeof window.initKeratoplastyTab === 'function') {
                window.initKeratoplastyTab();
            }
            if (window.CorneaSync && window.CorneaApi?.isEnabled?.()) {
                await CorneaSync.migrateExistingRecords();
                CorneaSync.scheduleDrain(true);
            }
        } catch (err) {
            alert('Error importing file: ' + (err.message || "ensure it's a valid backup JSON."));
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
};

window.clearAllData = async function() {
    if (!window.CorneaOfflineAuth?.hasPermission?.('database:clear')) {
        alert('You do not have permission to clear all data.');
        return;
    }
    if (!window.db) return;
    const cloudNote = (window.CorneaApi?.isEnabled?.())
        ? "\n\nNote: this clears only the data on THIS device. Cloud data is not deleted and will re-download on the next sync."
        : "";
    if (!confirm("CRITICAL WARNING: This will delete ALL local patient records, keratoplasty records, tissue records, and any unsynced changes. This action cannot be undone. Proceed?" + cloudNote)) {
        return;
    }

    const clearStore = (name) => new Promise((resolve) => {
        try {
            const req = window.db.transaction([name], "readwrite").objectStore(name).clear();
            req.onsuccess = resolve;
            req.onerror = resolve;
        } catch (_) { resolve(); }
    });

    await clearStore(STORE_NAME);
    await clearStore(STORE_KP_PATIENTS);
    await clearStore(STORE_KP_TISSUES);
    await clearStore(STORE_SYNC_QUEUE);
    await clearStore('sync_logs');
    // Reset the pull cursor so a connected device re-downloads everything.
    try {
        if (window.CorneaSync) await CorneaSync.setMeta('pull_cursor', '0');
    } catch (_) { /* ignore */ }

    alert("All local data cleared.");
    loadRecords();
    updateDashboardStats();
    window.refreshPatientVisitHistory?.();
    if (typeof window.initKeratoplastyTab === 'function') {
        window.initKeratoplastyTab();
    }
    if (window.CorneaSync) CorneaSync.updateSyncBadge();
};
