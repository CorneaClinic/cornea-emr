/**
 * Collaborative record edit locks — acquire, renew, release, revision check (Project 8)
 */
(function (global) {
  'use strict';

  const HEARTBEAT_MS = 90 * 1000;
  const ENTITY_VISIT = 'visit';

  let _active = null;
  let _heartbeat = null;

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function api(path, options) {
    return global.CorneaApi.request(path, options);
  }

  function deviceId() {
    try {
      return localStorage.getItem('corneaEmr_deviceId') || '';
    } catch (_) {
      return '';
    }
  }

  function currentUserId() {
    return global.__corneaUser?.id || null;
  }

  function bannerEl() {
    return document.getElementById('recordLockBanner');
  }

  function showBanner(message, tone) {
    const el = bannerEl();
    if (!el) return;
    el.hidden = false;
    el.className = `record-lock-banner record-lock-banner--${tone || 'info'}`;
    el.innerHTML = message;
  }

  function hideBanner() {
    const el = bannerEl();
    if (el) {
      el.hidden = true;
      el.innerHTML = '';
    }
  }

  function stopHeartbeat() {
    if (_heartbeat) {
      clearInterval(_heartbeat);
      _heartbeat = null;
    }
  }

  async function releaseActive() {
    stopHeartbeat();
    hideBanner();
    const prev = _active;
    _active = null;
    if (!apiOn() || !prev?.entityId) return;
    try {
      await api('/api/v1/record-locks/release', {
        method: 'POST',
        body: JSON.stringify({
          entityType: prev.entityType,
          entityId: prev.entityId
        })
      });
    } catch (_) { /* best effort */ }
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (!apiOn() || !_active?.entityId) return;
    _heartbeat = setInterval(async () => {
      if (!_active?.entityId) return;
      try {
        await api('/api/v1/record-locks/renew', {
          method: 'POST',
          body: JSON.stringify({
            entityType: _active.entityType,
            entityId: _active.entityId,
            deviceId: deviceId()
          })
        });
      } catch (err) {
        console.warn('[RecordLock] Renew failed:', err);
        showBanner(
          '<i class="fa-solid fa-triangle-exclamation"></i> Edit lock expired or lost — another user may be editing. Save soon or re-open the record.',
          'warn'
        );
      }
    }, HEARTBEAT_MS);
  }

  async function acquireVisitLock(visitUuid, { force } = {}) {
    if (!apiOn() || !visitUuid) return { ok: true, skipped: true };
    try {
      const res = await api('/api/v1/record-locks/acquire', {
        method: 'POST',
        body: JSON.stringify({
          entityType: ENTITY_VISIT,
          entityId: visitUuid,
          deviceId: deviceId(),
          force: !!force
        })
      });
      _active = { entityType: ENTITY_VISIT, entityId: visitUuid, lock: res?.data };
      showBanner(
        '<i class="fa-solid fa-lock"></i> You have this record checked out for editing. Others will see an in-use warning.',
        'ok'
      );
      startHeartbeat();
      return { ok: true, lock: res?.data };
    } catch (err) {
      if (err.status === 409) {
        const lock = err.details?.lock || err.details;
        const name = lock?.lockedByName || 'Another user';
        const choice = await showLockConflictDialog(name);
        if (choice === 'takeover') {
          return acquireVisitLock(visitUuid, { force: true });
        }
        if (choice === 'view') {
          return { ok: false, blocked: true, viewOnly: true, lock };
        }
        return { ok: false, blocked: true, lock };
      }
      console.warn('[RecordLock] Acquire failed:', err);
      return { ok: false, error: err };
    }
  }

  function showLockConflictDialog(lockedByName) {
    return new Promise((resolve) => {
      let overlay = document.getElementById('recordLockConflictOverlay');
      if (overlay) overlay.remove();
      overlay = document.createElement('div');
      overlay.id = 'recordLockConflictOverlay';
      overlay.className = 'record-lock-overlay';
      overlay.innerHTML = `
        <div class="record-lock-dialog" role="dialog" aria-modal="true">
          <h3><i class="fa-solid fa-user-lock"></i> Record in use</h3>
          <p><strong>${global.escapeHtml?.(lockedByName) || lockedByName}</strong> is currently editing this visit on another device.</p>
          <p class="form-hint">Opening anyway may cause a sync conflict. Prefer view-only until they finish.</p>
          <div class="record-lock-dialog-actions">
            <button type="button" class="btn-secondary" data-choice="cancel">Cancel</button>
            <button type="button" class="btn-secondary" data-choice="view">View read-only</button>
            <button type="button" class="btn-primary" data-choice="takeover">Take over editing</button>
          </div>
        </div>`;
      overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-choice]');
        if (!btn) return;
        overlay.remove();
        resolve(btn.dataset.choice);
      });
      document.body.appendChild(overlay);
    });
  }

  async function checkServerRevision(visitUuid, localRevision) {
    if (!apiOn() || !visitUuid) return { ok: true };
    try {
      const res = await api(`/api/v1/visits/${visitUuid}`);
      const serverRev = res?.data?.revision;
      if (serverRev != null && localRevision != null && Number(serverRev) > Number(localRevision)) {
        return {
          ok: false,
          stale: true,
          serverRevision: serverRev,
          localRevision: Number(localRevision)
        };
      }
      return { ok: true, serverRevision: serverRev };
    } catch (err) {
      console.warn('[RecordLock] Revision check failed:', err);
      return { ok: true, skipped: true };
    }
  }

  async function confirmStaleSave(stale) {
    return global.confirm(
      `The cloud copy of this visit was updated (revision ${stale.serverRevision}) while you were editing (your base: ${stale.localRevision}).\n\n` +
      'Save anyway? This may create a sync conflict you can resolve from the sync badge.'
    );
  }

  async function beforeEditVisit(record) {
    await releaseActive();
    if (!record?.uuid) {
      hideBanner();
      return { ok: true };
    }
    const result = await acquireVisitLock(record.uuid);
    if (result.blocked) {
      return { ok: false, viewOnly: !!result.viewOnly, lock: result.lock };
    }
    return { ok: true };
  }

  async function fetchVisitLockMap() {
    if (!apiOn()) return new Map();
    try {
      const res = await api('/api/v1/record-locks/active?entityType=visit');
      const map = new Map();
      for (const lock of res?.data || []) {
        map.set(lock.entityId, lock);
      }
      return map;
    } catch (_) {
      return new Map();
    }
  }

  async function beforeSaveVisit(data) {
    if (data?.uuid && data.revision != null) {
      const rev = await checkServerRevision(data.uuid, data.revision);
      if (rev.stale) {
        const proceed = await confirmStaleSave(rev);
        if (!proceed) return false;
      }
    }
    return true;
  }

  function installHooks() {
    const origOpen = global.openPatientFormModal;
    if (origOpen && !origOpen._recordLockWrapped) {
      global.openPatientFormModal = async function (mode) {
        if (mode === 'edit' && apiOn()) {
          const uuid = document.getElementById('currentRecordUuid')?.value;
          const localId = document.getElementById('currentRecordId')?.value;
          let record = { uuid };
          if (localId && global.db) {
            try {
              record = await new Promise((resolve) => {
                const req = global.db.transaction(['patients'], 'readonly').objectStore('patients').get(Number(localId));
                req.onsuccess = () => resolve(req.result || record);
                req.onerror = () => resolve(record);
              });
            } catch (_) { /* ignore */ }
          }
          const editResult = await beforeEditVisit(record);
          if (!editResult.ok) {
            if (editResult.viewOnly && localId && typeof global.viewRecordReadOnly === 'function') {
              global.viewRecordReadOnly(Number(localId), 'records');
            }
            return;
          }
        }
        if (mode === 'new') await releaseActive();
        return origOpen.call(this, mode);
      };
      global.openPatientFormModal._recordLockWrapped = true;
    }

    const origClose = global.closeEmrModal;
    if (origClose && !origClose._recordLockWrapped) {
      global.closeEmrModal = function (modalId) {
        if (modalId === 'emrPatientModal') releaseActive();
        return origClose.call(this, modalId);
      };
      global.closeEmrModal._recordLockWrapped = true;
    }

    window.addEventListener('beforeunload', () => {
      releaseActive();
    });
  }

  global.CorneaRecordLock = {
    acquireVisitLock,
    releaseActive,
    checkServerRevision,
    beforeEditVisit,
    beforeSaveVisit,
    installHooks,
    getActiveLock: () => _active,
    fetchVisitLockMap
  };

  installHooks();
})(typeof window !== 'undefined' ? window : globalThis);
