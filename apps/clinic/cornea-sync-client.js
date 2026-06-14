/**
 * Cornea Clinic — Offline cache + sync client
 * IndexedDB is a local replica; PostgreSQL is the source of truth.
 */
(function (global) {
  'use strict';

  const STORE_PATIENTS = 'patients';
  const STORE_KP_PATIENTS = 'kpPatients';
  const STORE_KP_TISSUES = 'kpTissues';
  const STORE_SYNC_QUEUE = 'sync_queue';
  const STORE_SYNC_META = 'sync_meta';
  const STORE_SYNC_LOGS = 'sync_logs';

  const META_DEVICE_ID = 'device_id';
  const META_PULL_CURSOR = 'pull_cursor';
  const META_LAST_SYNC = 'last_sync_at';

  const MAX_BATCH = 25;
  const MAX_ATTEMPTS = 8;
  const BASE_RETRY_MS = 2000;
  const SYNC_INTERVAL_MS = 30000;

  function uuid() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function tx(storeNames, mode = 'readonly') {
    return global.db.transaction(storeNames, mode);
  }

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getDeviceId() {
    let id = localStorage.getItem('corneaEmr_deviceId');
    if (!id) {
      id = uuid();
      localStorage.setItem('corneaEmr_deviceId', id);
    }
    return id;
  }

  const CorneaSync = {
    STORE_SYNC_QUEUE,
    STORE_SYNC_META,
    STORE_SYNC_LOGS,

    /** @type {((path: string, options?: object) => Promise<any>) | null} */
    api: null,
    draining: false,
    pullInProgress: false,
    retryTimer: null,
    intervalTimer: null,
    channel: typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cornea-sync') : null,

    init(apiFn) {
      this.api = apiFn;
      if (this.channel) {
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'queue-changed') {
            this.scheduleDrain();
          }
        };
      }
      global.addEventListener('online', () => this.scheduleDrain(true));
      this.startInterval();
    },

    startInterval() {
      if (this.intervalTimer) return;
      this.intervalTimer = setInterval(() => {
        if (global.navigator.onLine !== false) {
          this.syncAll().catch(() => {});
        }
      }, SYNC_INTERVAL_MS);
    },

    scheduleDrain(immediate = false) {
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      const delay = immediate ? 100 : 500;
      this.retryTimer = setTimeout(() => {
        this.syncAll().catch((err) => console.warn('[CorneaSync]', err.message));
      }, delay);
    },

    async syncAll() {
      if (!this.api || !global.db) return;
      await this.pull();
      await this.drainQueue();
    },

    async getMeta(key) {
      const store = tx([STORE_SYNC_META]).objectStore(STORE_SYNC_META);
      return promisifyRequest(store.get(key));
    },

    async setMeta(key, value) {
      const store = tx([STORE_SYNC_META], 'readwrite').objectStore(STORE_SYNC_META);
      await promisifyRequest(store.put({ key, value }));
    },

    async log(level, message, details = null) {
      const entry = {
        id: uuid(),
        level,
        message,
        details,
        created_at: new Date().toISOString()
      };

      try {
        const store = tx([STORE_SYNC_LOGS], 'readwrite').objectStore(STORE_SYNC_LOGS);
        await promisifyRequest(store.add(entry));

        const countReq = store.count();
        const count = await promisifyRequest(countReq);
        if (count > 500) {
          const cursor = await promisifyRequest(store.openCursor());
          if (cursor) {
            await promisifyRequest(cursor.delete());
          }
        }
      } catch (err) {
        console.warn('[CorneaSync] log failed', err);
      }

      this.updateSyncBadge();
      return entry;
    },

    async getLogs(limit = 50) {
      const store = tx([STORE_SYNC_LOGS]).objectStore(STORE_SYNC_LOGS);
      const all = await promisifyRequest(store.getAll());
      return all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },

    async enqueue(mutation) {
      const entry = {
        mutation_id: mutation.mutationId || uuid(),
        entity_type: mutation.entityType,
        operation: mutation.operation,
        entity_id: mutation.entityId || null,
        local_id: mutation.localId ?? null,
        base_revision: mutation.baseRevision ?? null,
        payload: mutation.payload ?? null,
        created_at: new Date().toISOString(),
        attempts: 0,
        last_error: null,
        status: 'pending'
      };

      const store = tx([STORE_SYNC_QUEUE], 'readwrite').objectStore(STORE_SYNC_QUEUE);

      // Coalesce: editing the same record again while its previous upsert is
      // still queued replaces the queued payload instead of stacking a second
      // mutation that would conflict with the first one's revision bump.
      if (entry.operation === 'upsert' && entry.local_id != null) {
        const all = await promisifyRequest(store.getAll());
        const existing = all.find((i) =>
          i.status === 'pending' &&
          i.operation === 'upsert' &&
          i.entity_type === entry.entity_type &&
          i.local_id === entry.local_id
        );
        if (existing) {
          existing.payload = entry.payload;
          existing.entity_id = entry.entity_id || existing.entity_id;
          existing.created_at = entry.created_at;
          await promisifyRequest(store.put(existing));
          this.scheduleDrain(true);
          this.updateSyncBadge();
          return existing;
        }
      }

      await promisifyRequest(store.put(entry));
      await this.log('info', `Queued ${entry.operation} ${entry.entity_type}`, {
        mutationId: entry.mutation_id
      });

      if (this.channel) {
        this.channel.postMessage({ type: 'queue-changed' });
      }

      this.scheduleDrain(true);
      this.updateSyncBadge();
      return entry;
    },

    async getPendingQueue() {
      const store = tx([STORE_SYNC_QUEUE]).objectStore(STORE_SYNC_QUEUE);
      const all = await promisifyRequest(store.getAll());
      return all
        .filter((item) => item.status === 'pending' || item.status === 'error')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async getQueueStats() {
      const store = tx([STORE_SYNC_QUEUE]).objectStore(STORE_SYNC_QUEUE);
      const all = await promisifyRequest(store.getAll());
      return {
        pending: all.filter((i) => i.status === 'pending' || i.status === 'error').length,
        conflicts: all.filter((i) => i.status === 'conflict').length,
        failed: all.filter((i) => i.status === 'failed').length,
        online: global.navigator.onLine !== false
      };
    },

    async getConflicts() {
      const store = tx([STORE_SYNC_QUEUE]).objectStore(STORE_SYNC_QUEUE);
      const all = await promisifyRequest(store.getAll());
      return all
        .filter((i) => i.status === 'conflict')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    async removeQueueItem(mutationId) {
      const store = tx([STORE_SYNC_QUEUE], 'readwrite').objectStore(STORE_SYNC_QUEUE);
      await promisifyRequest(store.delete(mutationId));
    },

    async markQueueError(mutationId, error, attempts) {
      const store = tx([STORE_SYNC_QUEUE], 'readwrite').objectStore(STORE_SYNC_QUEUE);
      const item = await promisifyRequest(store.get(mutationId));
      if (!item) return;
      item.attempts = attempts;
      item.last_error = String(error);
      item.status = attempts >= MAX_ATTEMPTS ? 'failed' : 'error';
      await promisifyRequest(store.put(item));
    },

    async markQueueConflict(mutationId, details) {
      const store = tx([STORE_SYNC_QUEUE], 'readwrite').objectStore(STORE_SYNC_QUEUE);
      const item = await promisifyRequest(store.get(mutationId));
      if (!item) return;
      item.status = 'conflict';
      item.last_error = details?.error || 'Conflict';
      item.conflict = details;
      await promisifyRequest(store.put(item));
      await this.log('warn', 'Sync conflict detected', details);
      return item;
    },

    storeForEntity(entityType) {
      if (entityType === 'visit') return STORE_PATIENTS;
      if (entityType === 'kp_patient') return STORE_KP_PATIENTS;
      if (entityType === 'kp_tissue') return STORE_KP_TISSUES;
      return null;
    },

    /** Flag the local record so the UI can show it is in conflict (keeps local data). */
    async markRecordConflict(entityType, localId) {
      const storeName = this.storeForEntity(entityType);
      if (!storeName || localId == null) return;
      const store = tx([storeName], 'readwrite').objectStore(storeName);
      const record = await promisifyRequest(store.get(localId));
      if (!record) return;
      record.sync_status = 'conflict';
      await promisifyRequest(store.put(record));
    },

    notifyConflict(count) {
      const msg = count === 1
        ? 'A record was changed on another device while you edited it.'
        : `${count} records were changed on another device while you edited them.`;
      console.warn('[CorneaSync]', msg);

      let toast = document.getElementById('corneaSyncToast');
      if (toast) toast.remove();
      toast = document.createElement('div');
      toast.id = 'corneaSyncToast';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:10001;background:#c62828;color:#fff;padding:14px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:0.9rem;max-width:340px;cursor:pointer;display:flex;gap:10px;align-items:center;';
      toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>${this.escapeHtml(msg)}<br><u>Click to review and resolve.</u></span>`;
      toast.onclick = () => {
        toast.remove();
        this.showConflictPanel();
      };
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 15000);
    },

    /**
     * Resolve a conflict.
     * choice 'server' — discard local edit, accept the server version.
     * choice 'local'  — keep local edit, re-push it on top of the server revision.
     */
    async resolveConflict(mutationId, choice) {
      const store = tx([STORE_SYNC_QUEUE]).objectStore(STORE_SYNC_QUEUE);
      const item = await promisifyRequest(store.get(mutationId));
      if (!item || item.status !== 'conflict') return false;

      const serverState = item.conflict?.serverState || item.conflict?.details?.serverState;
      const serverRevision = item.conflict?.serverRevision ?? item.conflict?.details?.serverRevision;

      if (choice === 'server') {
        if (serverState) {
          // Write directly (bypasses the hasLocalEdits guard — the user chose
          // to discard their local edit).
          const storeName = this.storeForEntity(item.entity_type);
          if (storeName) {
            const s = tx([storeName], 'readwrite').objectStore(storeName);
            await promisifyRequest(s.put({
              ...serverState,
              id: item.local_id ?? serverState.id,
              uuid: serverState.uuid || item.entity_id || serverState.entityId,
              revision: serverRevision ?? serverState.revision ?? 0,
              sync_status: 'synced'
            }));
          }
        } else if (item.local_id != null) {
          // Server deleted the record; remove the local copy too.
          const storeName = this.storeForEntity(item.entity_type);
          if (storeName) {
            const s = tx([storeName], 'readwrite').objectStore(storeName);
            await promisifyRequest(s.delete(item.local_id));
          }
        }
        await this.removeQueueItem(mutationId);
        await this.log('info', 'Conflict resolved: kept server version', { mutationId });
      } else {
        // Keep local: clear conflict, retry with the server's revision as base.
        const writeStore = tx([STORE_SYNC_QUEUE], 'readwrite').objectStore(STORE_SYNC_QUEUE);
        item.status = 'pending';
        item.attempts = 0;
        item.last_error = null;
        if (serverRevision != null) item.base_revision = serverRevision;
        if (item.payload && serverRevision != null) item.payload.revision = serverRevision;
        delete item.conflict;
        await promisifyRequest(writeStore.put(item));

        const storeName = this.storeForEntity(item.entity_type);
        if (storeName && item.local_id != null) {
          const s = tx([storeName], 'readwrite').objectStore(storeName);
          const record = await promisifyRequest(s.get(item.local_id));
          if (record) {
            record.sync_status = 'pending';
            if (serverRevision != null) record.revision = serverRevision;
            await promisifyRequest(s.put(record));
          }
        }
        await this.log('info', 'Conflict resolved: kept local version, re-pushing', { mutationId });
        this.scheduleDrain(true);
      }

      this.updateSyncBadge();
      return true;
    },

    decorateRecord(record) {
      if (!record.sync_status) record.sync_status = 'pending';
      if (record.revision == null) record.revision = 0;
      if (!record.client_mutation_id) record.client_mutation_id = uuid();
      return record;
    },

    async saveVisitLocal(data) {
      let existing = null;
      if (data?.id != null) {
        const readStore = tx([STORE_PATIENTS], 'readonly').objectStore(STORE_PATIENTS);
        existing = await promisifyRequest(readStore.get(data.id));
      }
      if (existing) {
        if (existing.uuid && !data.uuid) data.uuid = existing.uuid;
        if (existing.revision != null && data.revision == null) data.revision = existing.revision;
        if (existing.client_mutation_id && !data.client_mutation_id) {
          data.client_mutation_id = existing.client_mutation_id;
        }
      }

      this.decorateRecord(data);
      data.sync_status = 'pending';
      data.lastModified = new Date().toISOString();

      const store = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
      const savedId = await promisifyRequest(store.put(data));

      await this.enqueue({
        entityType: 'visit',
        operation: data.uuid ? 'upsert' : 'upsert',
        entityId: data.uuid || null,
        localId: savedId,
        baseRevision: data.revision || 0,
        payload: { ...data, id: savedId }
      });

      return { ...data, id: savedId };
    },

    async deleteVisitLocal(id) {
      const store = tx([STORE_PATIENTS], 'readonly').objectStore(STORE_PATIENTS);
      const existing = await promisifyRequest(store.get(id));
      if (!existing) return;

      const writeStore = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
      await promisifyRequest(writeStore.delete(id));

      await this.enqueue({
        entityType: 'visit',
        operation: 'delete',
        entityId: existing.uuid || null,
        localId: id,
        baseRevision: existing.revision || 0,
        payload: null
      });
    },

    async saveKpLocal(storeName, data, entityType) {
      this.decorateRecord(data);
      data.sync_status = 'pending';
      data.lastModified = new Date().toISOString();

      const store = tx([storeName], 'readwrite').objectStore(storeName);
      const savedId = await promisifyRequest(store.put(data));

      await this.enqueue({
        entityType,
        operation: data.uuid ? 'upsert' : 'upsert',
        entityId: data.uuid || null,
        localId: savedId,
        baseRevision: data.revision || 0,
        payload: { ...data, id: savedId }
      });

      return { ...data, id: savedId };
    },

    async deleteKpLocal(storeName, id, entityType) {
      const store = tx([storeName], 'readonly').objectStore(storeName);
      const existing = await promisifyRequest(store.get(id));
      if (!existing) return;

      const writeStore = tx([storeName], 'readwrite').objectStore(storeName);
      await promisifyRequest(writeStore.delete(id));

      await this.enqueue({
        entityType,
        operation: 'delete',
        entityId: existing.uuid || null,
        localId: id,
        baseRevision: existing.revision || 0,
        payload: null
      });
    },

    async applyServerVisit(data) {
      if (!data) return;
      const localId = data.id ?? data.localId;
      if (await this.hasLocalEdits(STORE_PATIENTS, typeof localId === 'number' ? localId : data.id)) return;
      const store = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
      const record = {
        ...data,
        id: typeof localId === 'number' ? localId : data.id,
        uuid: data.uuid || data.entityId,
        revision: data.revision ?? 0,
        sync_status: 'synced',
        updated_at: data.updated_at || data.lastModified
      };
      await promisifyRequest(store.put(record));
    },

    /**
     * True when the local copy has unsent edits (pending/conflict). Inbound
     * pull changes must not overwrite them; the push will surface a proper
     * conflict the user can resolve.
     */
    async hasLocalEdits(storeName, localId) {
      if (localId == null) return false;
      try {
        const store = tx([storeName]).objectStore(storeName);
        const existing = await promisifyRequest(store.get(localId));
        return !!existing && (existing.sync_status === 'pending' || existing.sync_status === 'conflict');
      } catch (_) {
        return false;
      }
    },

    async applyInboundChange(change) {
      if (change.entityType === 'visit' && change.data) {
        await this.applyServerVisit(change.data);
        return;
      }

      if (change.entityType === 'kp_patient' && change.data) {
        if (await this.hasLocalEdits(STORE_KP_PATIENTS, change.data.id)) return;
        const store = tx([STORE_KP_PATIENTS], 'readwrite').objectStore(STORE_KP_PATIENTS);
        const record = { ...change.data, sync_status: 'synced', revision: change.revision ?? 0 };
        await promisifyRequest(store.put(record));
        return;
      }

      if (change.entityType === 'kp_tissue' && change.data) {
        if (await this.hasLocalEdits(STORE_KP_TISSUES, change.data.id)) return;
        const store = tx([STORE_KP_TISSUES], 'readwrite').objectStore(STORE_KP_TISSUES);
        const record = { ...change.data, sync_status: 'synced', revision: change.revision ?? 0 };
        await promisifyRequest(store.put(record));
      }
    },

    async applyDeletion(deleted) {
      if (deleted.entityType === 'visit' && deleted.localId != null) {
        const store = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
        await promisifyRequest(store.delete(deleted.localId));
      }
    },

    async pull() {
      if (!this.api || this.pullInProgress || global.navigator.onLine === false) return;
      this.pullInProgress = true;

      try {
        let cursor = (await this.getMeta(META_PULL_CURSOR))?.value || '0';
        let hasMore = true;

        while (hasMore) {
          const prevCursor = cursor;
          const { data } = await this.api(
            `/api/v1/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=500&deviceId=${encodeURIComponent(getDeviceId())}`,
            { headers: { 'X-Device-Id': getDeviceId() } }
          );

          for (const change of data.changes || []) {
            await this.applyInboundChange(change);
          }
          for (const tombstone of data.deleted || []) {
            await this.applyDeletion(tombstone);
          }

          cursor = data.cursor || cursor;
          hasMore = data.hasMore ?? ((data.changes || []).length >= 500);
          if (hasMore && cursor === prevCursor) break;
        }

        await this.setMeta(META_PULL_CURSOR, cursor);
        await this.setMeta(META_LAST_SYNC, new Date().toISOString());
        await this.setMeta(META_DEVICE_ID, getDeviceId());
        await this.log('info', 'Pull completed', { cursor });
      } catch (err) {
        await this.log('error', 'Pull failed', { error: err.message });
        throw err;
      } finally {
        this.pullInProgress = false;
        this.updateSyncBadge();
      }
    },

    async drainQueue() {
      if (!this.api || this.draining || global.navigator.onLine === false) return;
      this.draining = true;

      let newConflicts = 0;

      try {
        const pending = await this.getPendingQueue();
        if (!pending.length) {
          this.updateSyncBadge();
          return;
        }

        for (let i = 0; i < pending.length; i += MAX_BATCH) {
          const batch = pending.slice(i, i + MAX_BATCH);
          const mutations = batch.map((item) => ({
            mutationId: item.mutation_id,
            entityType: item.entity_type,
            operation: item.operation,
            entityId: item.entity_id,
            localId: item.local_id,
            baseRevision: item.base_revision,
            payload: item.payload
          }));

          const { data } = await this.api('/api/v1/sync/push', {
            method: 'POST',
            headers: { 'X-Device-Id': getDeviceId() },
            body: JSON.stringify({ deviceId: getDeviceId(), mutations })
          });

          for (const result of data.results || []) {
            const queueItem = batch.find((b) => b.mutation_id === result.mutationId);
            if (!queueItem) continue;

            if (result.status === 'ok') {
              await this.removeQueueItem(result.mutationId);
              await this.applyPushSuccess(queueItem, result);
              await this.log('info', `Synced ${queueItem.entity_type}`, {
                mutationId: result.mutationId,
                entityId: result.entityId
              });
            } else if (result.status === 'conflict') {
              // Keep the local version on disk; flag the record and let the
              // user decide (resolveConflict) instead of silently overwriting.
              await this.markQueueConflict(result.mutationId, result.details || result);
              await this.markRecordConflict(queueItem.entity_type, queueItem.local_id);
              newConflicts++;
            } else {
              const attempts = (queueItem.attempts || 0) + 1;
              await this.markQueueError(result.mutationId, result.error || 'Push failed', attempts);
              if (attempts < MAX_ATTEMPTS) {
                const backoff = BASE_RETRY_MS * Math.pow(2, Math.min(attempts, 5));
                await this.log('warn', `Push retry scheduled in ${backoff}ms`, {
                  mutationId: result.mutationId,
                  attempts
                });
                setTimeout(() => this.scheduleDrain(true), backoff);
              } else {
                await this.log('error', 'Push failed permanently', {
                  mutationId: result.mutationId,
                  error: result.error
                });
              }
            }
          }
        }

        await this.setMeta(META_LAST_SYNC, new Date().toISOString());
        if (newConflicts > 0) {
          this.notifyConflict(newConflicts);
        }
      } catch (err) {
        await this.log('error', 'Queue drain failed', { error: err.message });
        const backoff = BASE_RETRY_MS * 2;
        setTimeout(() => this.scheduleDrain(true), backoff);
      } finally {
        this.draining = false;
        this.updateSyncBadge();
      }
    },

    async applyPushSuccess(queueItem, result) {
      if (queueItem.entity_type === 'visit' && result.serverState) {
        const record = {
          ...result.serverState,
          id: result.localId ?? result.serverState.id,
          uuid: result.entityId,
          revision: result.revision,
          sync_status: 'synced'
        };
        const store = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
        await promisifyRequest(store.put(record));
        if (global.CorneaVisitMedia && result.entityId) {
          global.CorneaVisitMedia.flushPendingUploads(result.entityId).catch((err) => {
            console.warn('[CorneaVisitMedia] Post-sync upload:', err.message);
          });
        }
        return;
      }

      if (queueItem.entity_type === 'kp_patient' && result.serverState) {
        const store = tx([STORE_KP_PATIENTS], 'readwrite').objectStore(STORE_KP_PATIENTS);
        await promisifyRequest(store.put({
          ...result.serverState,
          id: result.localId ?? result.serverState.id,
          uuid: result.entityId,
          revision: result.revision,
          sync_status: 'synced'
        }));
        return;
      }

      if (queueItem.entity_type === 'kp_tissue' && result.serverState) {
        const store = tx([STORE_KP_TISSUES], 'readwrite').objectStore(STORE_KP_TISSUES);
        await promisifyRequest(store.put({
          ...result.serverState,
          id: result.localId ?? result.serverState.id,
          uuid: result.entityId,
          revision: result.revision,
          sync_status: 'synced'
        }));
      }
    },

    async migrateExistingRecords() {
      if (!global.db) return;

      const patientsStore = tx([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
      const patients = await promisifyRequest(patientsStore.getAll());
      for (const record of patients) {
        if (!record.sync_status) {
          record.sync_status = record.uuid ? 'pending' : 'pending_upload';
          record.revision = record.revision ?? 0;
          record.client_mutation_id = record.client_mutation_id || uuid();
          await promisifyRequest(patientsStore.put(record));

          if (!record.uuid) {
            await this.enqueue({
              entityType: 'visit',
              operation: 'upsert',
              localId: record.id,
              baseRevision: 0,
              payload: { ...record }
            });
          }
        }
      }

      for (const [storeName, entityType] of [
        [STORE_KP_PATIENTS, 'kp_patient'],
        [STORE_KP_TISSUES, 'kp_tissue']
      ]) {
        const store = tx([storeName], 'readwrite').objectStore(storeName);
        const rows = await promisifyRequest(store.getAll());
        for (const record of rows) {
          if (!record.sync_status) {
            record.sync_status = record.uuid ? 'pending' : 'pending_upload';
            record.revision = record.revision ?? 0;
            record.client_mutation_id = record.client_mutation_id || uuid();
            await promisifyRequest(store.put(record));
            if (!record.uuid) {
              await this.enqueue({
                entityType,
                operation: 'upsert',
                localId: record.id,
                baseRevision: 0,
                payload: { ...record }
              });
            }
          }
        }
      }

      await this.log('info', 'Migrated legacy IndexedDB records to sync queue', {
        patients: patients.length
      });
    },

    updateSyncBadge() {
      this.getQueueStats().then((stats) => {
        let el = document.getElementById('corneaSyncBadge');
        if (!el) {
          const header = document.querySelector('.topbar-right') || document.querySelector('.page-header');
          if (!header) return;
          el = document.createElement('span');
          el.id = 'corneaSyncBadge';
          el.style.cssText = 'margin-left:8px;padding:4px 10px;border-radius:999px;font-size:0.72rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;';
          header.appendChild(el);
        }

        if (!stats.online) {
          el.style.background = '#fff3e0';
          el.style.color = '#e65100';
          el.style.cursor = 'default';
          el.onclick = null;
          el.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Offline';
        } else if (stats.conflicts > 0) {
          el.style.background = '#ffebee';
          el.style.color = '#c62828';
          el.style.cursor = 'pointer';
          el.title = 'Click to resolve sync conflicts';
          el.onclick = () => this.showConflictPanel();
          el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${stats.conflicts} conflict(s)`;
        } else if (stats.pending > 0) {
          el.style.background = '#e3f2fd';
          el.style.color = '#1565c0';
          el.style.cursor = 'default';
          el.onclick = null;
          el.innerHTML = `<i class="fa-solid fa-rotate"></i> ${stats.pending} pending`;
        } else {
          el.style.background = '#e8f5e9';
          el.style.color = '#2e7d32';
          el.style.cursor = 'default';
          el.onclick = null;
          el.innerHTML = '<i class="fa-solid fa-check"></i> Synced';
        }
      }).catch(() => {});
    },

    conflictLabel(item) {
      const p = item.payload || {};
      const server = item.conflict?.serverState || item.conflict?.details?.serverState || {};
      const name = p.fullName || server.fullName || p.donorName || server.donorName || '';
      const ref = p.patientId || server.patientId || p.kpPatientId || p.kpTissueId || '';
      const kind = item.entity_type === 'visit' ? 'Visit'
        : item.entity_type === 'kp_patient' ? 'KP patient'
        : item.entity_type === 'kp_tissue' ? 'Tissue' : item.entity_type;
      return `${kind}${ref ? ` ${ref}` : ''}${name ? ` — ${name}` : ''}`;
    },

    async showConflictPanel() {
      const conflicts = await this.getConflicts();
      let overlay = document.getElementById('corneaSyncConflictPanel');
      if (overlay) overlay.remove();
      if (!conflicts.length) return;

      overlay = document.createElement('div');
      overlay.id = 'corneaSyncConflictPanel';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });

      const card = document.createElement('div');
      card.style.cssText = 'background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:80vh;overflow:auto;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,0.25);font-family:inherit;';

      const rows = conflicts.map((item) => {
        const when = new Date(item.created_at).toLocaleString();
        return `
          <div style="border:1px solid #ffcdd2;border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="font-weight:600;margin-bottom:4px;">${this.escapeHtml(this.conflictLabel(item))}</div>
            <div style="font-size:0.8rem;color:#666;margin-bottom:10px;">Your edit from ${this.escapeHtml(when)} clashed with a newer change on the server.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button data-choice="local" data-id="${this.escapeHtml(item.mutation_id)}" style="padding:6px 14px;border-radius:6px;border:1px solid #1565c0;background:#1565c0;color:#fff;cursor:pointer;font-size:0.85rem;">Keep my version</button>
              <button data-choice="server" data-id="${this.escapeHtml(item.mutation_id)}" style="padding:6px 14px;border-radius:6px;border:1px solid #bbb;background:#fff;color:#333;cursor:pointer;font-size:0.85rem;">Use server version</button>
            </div>
          </div>`;
      }).join('');

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;font-size:1.05rem;color:#c62828;"><i class="fa-solid fa-triangle-exclamation"></i> Sync conflicts (${conflicts.length})</h3>
          <button id="corneaSyncConflictClose" style="border:none;background:none;font-size:1.2rem;cursor:pointer;color:#666;">&times;</button>
        </div>
        ${rows}`;

      card.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-choice]');
        if (btn) {
          btn.disabled = true;
          await this.resolveConflict(btn.dataset.id, btn.dataset.choice);
          const remaining = await this.getConflicts();
          overlay.remove();
          if (remaining.length) await this.showConflictPanel();
          else if (typeof global.loadRecords === 'function') global.loadRecords();
          return;
        }
        if (e.target.id === 'corneaSyncConflictClose') overlay.remove();
      });

      overlay.appendChild(card);
      document.body.appendChild(overlay);
    },

    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },

    ensureSyncStores(db, event) {
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const q = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'mutation_id' });
        q.createIndex('status', 'status', { unique: false });
        q.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_META)) {
        db.createObjectStore(STORE_SYNC_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_LOGS)) {
        const logs = db.createObjectStore(STORE_SYNC_LOGS, { keyPath: 'id' });
        logs.createIndex('created_at', 'created_at', { unique: false });
      }
    }
  };

  global.CorneaSync = CorneaSync;
})(typeof window !== 'undefined' ? window : globalThis);
