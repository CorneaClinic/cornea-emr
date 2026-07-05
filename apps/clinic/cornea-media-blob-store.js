/**
 * IndexedDB blob store for pending clinical media (avoids base64 in visit JSON).
 */
(function (global) {
  'use strict';

  const STORE = 'media_blobs';

  function ensureStore(db, event) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE, { keyPath: 'localId' });
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.db) return reject(new Error('Database not ready'));
      resolve(global.db);
    });
  }

  async function putBlob(localId, blob, meta) {
    const db = await openDb();
    let storedBlob = blob;
    let enc = null;
    if (global.CorneaIdbCrypto?.hasSessionKey?.()) {
      try {
        enc = await global.CorneaIdbCrypto.encryptBlob(blob);
        storedBlob = null;
      } catch (_) { /* store plain if encrypt fails */ }
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).put({
        localId,
        blob: storedBlob,
        enc,
        mimeType: meta?.mimeType || blob.type,
        filename: meta?.filename || 'upload',
        savedAt: new Date().toISOString()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getBlob(localId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readonly');
      const req = tx.objectStore(STORE).get(localId);
      req.onsuccess = async () => {
        const row = req.result || null;
        if (!row) return resolve(null);
        if (row.enc && global.CorneaIdbCrypto?.hasSessionKey?.()) {
          try {
            const blob = await global.CorneaIdbCrypto.decryptBlob(row.enc);
            return resolve({ ...row, blob });
          } catch (err) {
            return reject(err);
          }
        }
        resolve(row);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteBlob(localId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).delete(localId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  global.CorneaMediaBlobStore = {
    STORE,
    ensureStore,
    putBlob,
    getBlob,
    deleteBlob
  };
})(window);
