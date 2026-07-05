/**
 * Project 3 — offline data security: idle lock, device trust, data expiry, lock screen.
 */
(function offlineSecurityModule(global) {
  'use strict';

  const TRUST_KEY = 'corneaDeviceTrust';
  const LAST_UNLOCK_KEY = 'corneaLastUnlockAt';
  const CLOUD_IDLE_MS = 15 * 60 * 1000;
  const OFFLINE_IDLE_MS = 30 * 60 * 1000;
  const TRUST_DAYS = 90;
  const OFFLINE_MAX_AGE_DAYS = 30;

  let idleTimer = null;
  let activityBound = false;

  function now() {
    return Date.now();
  }

  function deviceId() {
    let id = localStorage.getItem('corneaEmr_deviceId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('corneaEmr_deviceId', id);
    }
    return id;
  }

  function readTrust() {
    try {
      const raw = localStorage.getItem(TRUST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeTrust(record) {
    if (!record) {
      localStorage.removeItem(TRUST_KEY);
      return;
    }
    localStorage.setItem(TRUST_KEY, JSON.stringify(record));
  }

  function isDeviceTrusted(userKey) {
    const t = readTrust();
    if (!t?.trustedUntil || !t?.userKey) return false;
    if (userKey && t.userKey !== userKey) return false;
    return now() < t.trustedUntil;
  }

  function markDeviceTrusted(userKey, days) {
    const d = days || TRUST_DAYS;
    writeTrust({
      deviceId: deviceId(),
      userKey: userKey || 'local',
      trustedUntil: now() + d * 24 * 60 * 60 * 1000,
      markedAt: new Date().toISOString()
    });
  }

  function revokeDeviceTrust() {
    writeTrust(null);
  }

  function touchUnlockTime() {
    localStorage.setItem(LAST_UNLOCK_KEY, String(now()));
  }

  function daysSinceUnlock() {
    const ts = Number(localStorage.getItem(LAST_UNLOCK_KEY) || '0');
    if (!ts) return Infinity;
    return (now() - ts) / (24 * 60 * 60 * 1000);
  }

  async function unlockAfterOfflineLogin(password) {
    const salt = 'cornea-offline-phi-v1';
    await global.CorneaIdbCrypto.unlockWithPassword(password, salt);
    touchUnlockTime();
    await global.CorneaSecurePatients?.migratePlainRecords?.();
    resetIdleTimer();
  }

  async function unlockAfterCloudLogin(accessToken) {
    await global.CorneaIdbCrypto.unlockWithCloudSession(accessToken, deviceId());
    touchUnlockTime();
    await global.CorneaSecurePatients?.migratePlainRecords?.();
    resetIdleTimer();
  }

  function ensureLockScreen() {
    if (document.getElementById('corneaSessionLock')) return;
    const el = document.createElement('div');
    el.id = 'corneaSessionLock';
    el.className = 'cornea-session-lock';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="cornea-session-lock-card" role="dialog" aria-modal="true" aria-labelledby="corneaSessionLockTitle">
        <div class="cornea-session-lock-icon"><i class="fa-solid fa-lock"></i></div>
        <h2 id="corneaSessionLockTitle">Session locked</h2>
        <p id="corneaSessionLockMsg">Your session was locked due to inactivity. Sign in again to view patient data on this device.</p>
        <button type="button" class="btn-primary" id="corneaSessionLockSignIn">
          <i class="fa-solid fa-right-to-bracket"></i> Sign in
        </button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('corneaSessionLockSignIn')?.addEventListener('click', async () => {
      hideLockScreen();
      if (global.__corneaCloudMode || global.CorneaAuthEnv?.isPublicDeployment?.()) {
        await global.CorneaApi?.signIn?.();
      } else {
        global.CorneaOfflineAuth?.logout?.(false);
      }
    });
  }

  function showLockScreen(reason) {
    ensureLockScreen();
    const el = document.getElementById('corneaSessionLock');
    const msg = document.getElementById('corneaSessionLockMsg');
    if (msg) {
      msg.textContent = reason === 'expiry'
        ? 'Local patient data on this device is too old. Sign in to cloud sync to refresh, or sign in offline to continue.'
        : 'Your session was locked due to inactivity. Sign in again to view patient data on this device.';
    }
    if (el) {
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
    }
    global.CorneaAuthEnv?.lockUi?.();
  }

  function hideLockScreen() {
    const el = document.getElementById('corneaSessionLock');
    if (el) {
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
    }
    global.CorneaAuthEnv?.unlockUi?.();
  }

  async function lockSession(reason) {
    global.CorneaIdbCrypto?.clearSessionKey?.();
    if (idleTimer) clearTimeout(idleTimer);
    if (global.CorneaSync) global.CorneaSync.stopLongPoll?.();
    if (global.__corneaCloudMode && global.CorneaApi?.logout) {
      await global.CorneaApi.logout();
    } else {
      global.CorneaOfflineAuth?.logout?.(true);
    }
    showLockScreen(reason || 'idle');
  }

  function idleMs() {
    return global.__corneaCloudMode ? CLOUD_IDLE_MS : OFFLINE_IDLE_MS;
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!global.CorneaIdbCrypto?.hasSessionKey?.()) return;
    idleTimer = setTimeout(() => {
      lockSession('idle').catch((err) => console.warn('[CorneaOfflineSecurity] idle lock', err));
    }, idleMs());
  }

  function bindActivity() {
    if (activityBound) return;
    activityBound = true;
    const bump = () => {
      if (global.CorneaIdbCrypto?.hasSessionKey?.()) resetIdleTimer();
      global.CorneaOfflineAuth?.touchSession?.();
    };
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach((ev) => {
      document.addEventListener(ev, bump, { passive: true });
    });
  }

  async function purgeExpiredLocalPhi() {
    if (!global.db) return;
    const stores = [
      typeof STORE_NAME !== 'undefined' ? STORE_NAME : 'patients',
      'media_blobs',
      'sync_queue'
    ];
    for (const name of stores) {
      if (!global.db.objectStoreNames.contains(name)) continue;
      await new Promise((resolve) => {
        const req = global.db.transaction([name], 'readwrite').objectStore(name).clear();
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    }
    global.CorneaIdbCrypto?.clearSessionKey?.();
    if (global.CorneaSync) {
      try {
        await global.CorneaSync.setMeta?.('pull_cursor', '0');
      } catch (_) { /* ignore */ }
    }
  }

  async function checkDataExpiry() {
    const age = daysSinceUnlock();
    const userKey = global.__corneaUser?.email
      || global.CorneaOfflineAuth?.getCurrentUser?.()?.username
      || 'local';
    if (isDeviceTrusted(userKey)) return;
    if (age <= OFFLINE_MAX_AGE_DAYS) return;

    const proceed = confirm(
      `Local patient data on this device has not been unlocked for ${Math.floor(age)} days.\n\n` +
      'For security, local copies should be refreshed. Clear local patient data now? (Cloud data is not deleted.)'
    );
    if (proceed) {
      await purgeExpiredLocalPhi();
      alert('Local patient cache cleared. Sign in to download records from cloud.');
      showLockScreen('expiry');
    }
  }

  function renderSecurityPanel() {
    const el = document.getElementById('offlineSecurityStatus');
    if (!el) return;
    const trusted = isDeviceTrusted(
      global.__corneaUser?.email || global.CorneaOfflineAuth?.getCurrentUser?.()?.username
    );
    const enc = global.CorneaIdbCrypto?.hasSessionKey?.() ? 'Active' : 'Locked';
    const idleMin = Math.round(idleMs() / 60000);
    el.innerHTML = `
      <ul class="offline-security-list">
        <li><strong>Local encryption:</strong> ${enc} (AES-256-GCM)</li>
        <li><strong>Idle lock:</strong> ${idleMin} minutes of inactivity</li>
        <li><strong>Device trust:</strong> ${trusted ? `Trusted until ${new Date(readTrust().trustedUntil).toLocaleDateString()}` : 'Not trusted'}</li>
        <li><strong>Local data refresh:</strong> required every ${OFFLINE_MAX_AGE_DAYS} days without trust</li>
      </ul>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button type="button" class="btn-secondary btn-sm" id="btnTrustDevice">Trust this device (90 days)</button>
        <button type="button" class="btn-secondary btn-sm" id="btnRevokeTrust">Revoke device trust</button>
        <button type="button" class="btn-danger btn-sm" id="btnLockNow">Lock session now</button>
      </div>`;
    document.getElementById('btnTrustDevice')?.addEventListener('click', () => {
      const userKey = global.__corneaUser?.email || global.CorneaOfflineAuth?.getCurrentUser?.()?.username || 'local';
      markDeviceTrusted(userKey, TRUST_DAYS);
      renderSecurityPanel();
    });
    document.getElementById('btnRevokeTrust')?.addEventListener('click', () => {
      revokeDeviceTrust();
      renderSecurityPanel();
    });
    document.getElementById('btnLockNow')?.addEventListener('click', () => {
      lockSession('manual').catch(console.warn);
    });
  }

  function injectStyles() {
    if (document.getElementById('corneaOfflineSecurityStyles')) return;
    const style = document.createElement('style');
    style.id = 'corneaOfflineSecurityStyles';
    style.textContent = `
      .cornea-session-lock {
        position: fixed; inset: 0; z-index: 10001;
        display: none; align-items: center; justify-content: center;
        background: rgba(13, 33, 55, 0.92); padding: 24px;
      }
      .cornea-session-lock.is-open { display: flex; }
      .cornea-session-lock-card {
        background: #fff; border-radius: 12px; padding: 28px 32px;
        max-width: 420px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      }
      .cornea-session-lock-icon { font-size: 2rem; color: var(--primary-mid, #1565c0); margin-bottom: 12px; }
      .offline-security-list { margin: 0; padding-left: 18px; font-size: 0.85rem; color: var(--text-secondary); }
      .offline-security-list li { margin-bottom: 6px; }
    `;
    document.head.appendChild(style);
  }

  async function onAppReady() {
    injectStyles();
    ensureLockScreen();
    bindActivity();
    hideLockScreen();
    await checkDataExpiry();
    renderSecurityPanel();
  }

  global.CorneaOfflineSecurity = {
    CLOUD_IDLE_MS,
    OFFLINE_IDLE_MS,
    OFFLINE_MAX_AGE_DAYS,
    deviceId,
    isDeviceTrusted,
    markDeviceTrusted,
    revokeDeviceTrust,
    unlockAfterOfflineLogin,
    unlockAfterCloudLogin,
    lockSession,
    resetIdleTimer,
    purgeExpiredLocalPhi,
    checkDataExpiry,
    renderSecurityPanel,
    onAppReady,
    hideLockScreen
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(onAppReady, 500);
    });
  } else {
    setTimeout(onAppReady, 500);
  }
})(typeof window !== 'undefined' ? window : globalThis);
