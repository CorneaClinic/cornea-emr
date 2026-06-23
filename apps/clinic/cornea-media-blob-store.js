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
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).put({
        localId,
        blob,
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
      req.onsuccess = () => resolve(req.result || null);
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
