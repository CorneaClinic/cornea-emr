/**
 * Collaborative record edit locks — acquire, renew, release, revision check (Project 8 + P4 registries)
 */
(function (global) {
  'use strict';

  const HEARTBEAT_MS = 90 * 1000;

  const ENTITY = Object.freeze({
    visit: 'visit',
    kc_patient: 'kc_patient',
    keratitis_case: 'keratitis_case',
    dry_eye_case: 'dry_eye_case',
    kp_patient: 'kp_patient',
    kp_tissue: 'kp_tissue'
  });

  const REVISION_PATHS = Object.freeze({
    [ENTITY.visit]: (id) => `/api/v1/visits/${id}`,
    [ENTITY.kc_patient]: (id) => `/api/v1/kc-registry/${id}`,
    [ENTITY.keratitis_case]: (id) => `/api/v1/keratitis-registry/${id}`,
    [ENTITY.dry_eye_case]: (id) => `/api/v1/dry-eye-registry/${id}`,
    [ENTITY.kp_patient]: (id) => `/api/v1/keratoplasty-patients/${id}`,
    [ENTITY.kp_tissue]: (id) => `/api/v1/corneal-tissues/${id}`
  });

  const MODAL_RELEASE = new Set([
    'emrPatientModal',
    'kcPatientModal',
    'ukCaseModal',
    'deCaseModal',
    'kpPatientModal',
    'kpTissueModal'
  ]);

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

  function showLockConflictDialog(lockedByName, entityLabel) {
    const label = entityLabel || 'record';
    return new Promise((resolve) => {
      let overlay = document.getElementById('recordLockConflictOverlay');
      if (overlay) overlay.remove();
      overlay = document.createElement('div');
      overlay.id = 'recordLockConflictOverlay';
      overlay.className = 'record-lock-overlay';
      overlay.innerHTML = `
        <div class="record-lock-dialog" role="dialog" aria-modal="true">
          <h3><i class="fa-solid fa-user-lock"></i> ${global.escapeHtml?.(label) || label} in use</h3>
          <p><strong>${global.escapeHtml?.(lockedByName) || lockedByName}</strong> is currently editing this ${global.escapeHtml?.(label) || label} on another device.</p>
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

  async function acquireEntityLock(entityType, entityId, { force, entityLabel } = {}) {
    if (!apiOn() || !entityId) return { ok: true, skipped: true };
    try {
      const res = await api('/api/v1/record-locks/acquire', {
        method: 'POST',
        body: JSON.stringify({
          entityType,
          entityId,
          deviceId: deviceId(),
          force: !!force
        })
      });
      _active = { entityType, entityId, lock: res?.data };
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
        const choice = await showLockConflictDialog(name, entityLabel);
        if (choice === 'takeover') {
          return acquireEntityLock(entityType, entityId, { force: true, entityLabel });
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

  async function acquireVisitLock(visitUuid, options) {
    return acquireEntityLock(ENTITY.visit, visitUuid, { ...options, entityLabel: 'visit' });
  }

  async function checkEntityRevision(entityType, entityUuid, localRevision) {
    if (!apiOn() || !entityUuid) return { ok: true };
    const pathFn = REVISION_PATHS[entityType];
    if (!pathFn) return { ok: true, skipped: true };
    try {
      const res = await api(pathFn(entityUuid));
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

  async function checkServerRevision(visitUuid, localRevision) {
    return checkEntityRevision(ENTITY.visit, visitUuid, localRevision);
  }

  async function confirmStaleSave(stale, entityLabel) {
    const label = entityLabel || 'record';
    return global.confirm(
      `The cloud copy of this ${label} was updated (revision ${stale.serverRevision}) while you were editing (your base: ${stale.localRevision}).\n\n` +
      'Save anyway? This may create a sync conflict you can resolve from the sync badge.'
    );
  }

  async function beforeEditEntity(entityType, entityUuid, { entityLabel, onViewOnly } = {}) {
    await releaseActive();
    if (!entityUuid) {
      hideBanner();
      return { ok: true };
    }
    const result = await acquireEntityLock(entityType, entityUuid, { entityLabel });
    if (result.blocked) {
      if (result.viewOnly && typeof onViewOnly === 'function') {
        onViewOnly();
      }
      return { ok: false, viewOnly: !!result.viewOnly, lock: result.lock };
    }
    return { ok: true };
  }

  async function beforeEditVisit(record) {
    return beforeEditEntity(ENTITY.visit, record?.uuid, {
      entityLabel: 'visit',
      onViewOnly: record?.id && typeof global.viewRecordReadOnly === 'function'
        ? () => global.viewRecordReadOnly(Number(record.id), 'records')
        : undefined
    });
  }

  async function beforeSaveEntity(entityType, uuid, revision, entityLabel) {
    if (uuid && revision != null) {
      const rev = await checkEntityRevision(entityType, uuid, revision);
      if (rev.stale) {
        const proceed = await confirmStaleSave(rev, entityLabel);
        if (!proceed) return false;
      }
    }
    return true;
  }

  async function beforeSaveVisit(data) {
    return beforeSaveEntity(ENTITY.visit, data?.uuid, data?.revision, 'visit');
  }

  function handleSaveConflict(err, entityLabel) {
    if (err?.status !== 409) return false;
    const details = err.details || {};
    if (details.serverRevision != null && details.expectedRevision != null) {
      alert(
        `${entityLabel || 'Record'} was updated by another user (cloud revision ${details.serverRevision}, yours ${details.expectedRevision}).\n\n` +
        'Refresh the list and re-open the record to merge changes.'
      );
      return true;
    }
    return false;
  }

  async function fetchLockMap(entityType) {
    if (!apiOn()) return new Map();
    try {
      const q = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
      const res = await api(`/api/v1/record-locks/active${q}`);
      const map = new Map();
      for (const lock of res?.data || []) {
        map.set(lock.entityId, lock);
      }
      return map;
    } catch (_) {
      return new Map();
    }
  }

  async function fetchVisitLockMap() {
    return fetchLockMap(ENTITY.visit);
  }

  function installHooks() {
    const origOpen = global.openPatientFormModal;
    if (origOpen && !origOpen._recordLockWrapped) {
      global.openPatientFormModal = async function (mode) {
        try {
          if (mode === 'edit' && apiOn()) {
            const uuid = document.getElementById('currentRecordUuid')?.value;
            const localId = document.getElementById('currentRecordId')?.value;
            let record = { uuid, id: localId ? Number(localId) : undefined };
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
            if (!editResult.ok) return;
          }
          if (mode === 'new') void releaseActive();
          return origOpen.call(this, mode);
        } catch (err) {
          console.error('[RecordLock] openPatientFormModal failed:', err);
          throw err;
        }
      };
      global.openPatientFormModal._recordLockWrapped = true;
    }

    const origClose = global.closeEmrModal;
    if (origClose && !origClose._recordLockWrapped) {
      global.closeEmrModal = function (modalId) {
        if (MODAL_RELEASE.has(modalId)) releaseActive();
        return origClose.call(this, modalId);
      };
      global.closeEmrModal._recordLockWrapped = true;
    }

    window.addEventListener('beforeunload', () => {
      releaseActive();
    });
  }

  global.CorneaRecordLock = {
    ENTITY,
    acquireVisitLock,
    acquireEntityLock,
    releaseActive,
    checkServerRevision,
    checkEntityRevision,
    beforeEditVisit,
    beforeEditEntity,
    beforeSaveVisit,
    beforeSaveEntity,
    handleSaveConflict,
    installHooks,
    getActiveLock: () => _active,
    fetchVisitLockMap,
    fetchLockMap
  };

  installHooks();
})(typeof window !== 'undefined' ? window : globalThis);
