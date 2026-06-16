/**
 * Deployment environment and authentication gate.
 */
(function (global) {
  'use strict';

  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'clinic.local', '']);

  const AUTH_MODAL_IDS = new Set([
    'corneaCloudLoginModal',
    'corneaPwChangeModal'
  ]);

  const OFFLINE_FALLBACK_KEY = 'corneaEmr_offlineFallback';

  function isPublicDeployment() {
    const host = (global.location?.hostname || '').toLowerCase();
    if (LOCAL_HOSTS.has(host)) return false;
    if (global.location?.protocol === 'file:') return false;
    return true;
  }

  function isLocalDeployment() {
    return !isPublicDeployment();
  }

  function isAuthenticated() {
    if (global.__corneaCloudMode && global.CorneaApi?.isEnabled?.()) return true;
    if (global.CorneaOfflineAuth?.getCurrentUser?.()) return true;
    return false;
  }

  function isAuthModal(modalId) {
    return AUTH_MODAL_IDS.has(modalId);
  }

  function lockUi() {
    document.body.classList.add('cornea-auth-pending');
  }

  function unlockUi() {
    document.body.classList.remove('cornea-auth-pending');
  }

  function enableOfflineFallback() {
    try {
      sessionStorage.setItem(OFFLINE_FALLBACK_KEY, '1');
    } catch (_) { /* ignore */ }
  }

  function clearOfflineFallback() {
    try {
      sessionStorage.removeItem(OFFLINE_FALLBACK_KEY);
    } catch (_) { /* ignore */ }
  }

  function isOfflineFallbackActive() {
    try {
      return sessionStorage.getItem(OFFLINE_FALLBACK_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  /** Offline sign-in allowed on local install, or on public site when the clinic API is unreachable. */
  function allowsOfflineAuth() {
    return isLocalDeployment() || isOfflineFallbackActive();
  }

  global.CorneaAuthEnv = {
    isPublicDeployment,
    isLocalDeployment,
    isAuthenticated,
    isAuthModal,
    lockUi,
    unlockUi,
    enableOfflineFallback,
    clearOfflineFallback,
    isOfflineFallbackActive,
    allowsOfflineAuth,
    AUTH_MODAL_IDS
  };

  lockUi();
})(typeof window !== 'undefined' ? window : globalThis);
