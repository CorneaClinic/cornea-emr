/**
 * Deployment environment — local vs public (internet-facing) clinic UI.
 */
(function (global) {
  'use strict';

  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'clinic.local', '']);

  function isPublicDeployment() {
    const host = (global.location?.hostname || '').toLowerCase();
    if (LOCAL_HOSTS.has(host)) return false;
    if (global.location?.protocol === 'file:') return false;
    return true;
  }

  function isLocalDeployment() {
    return !isPublicDeployment();
  }

  global.CorneaAuthEnv = Object.freeze({
    isPublicDeployment,
    isLocalDeployment
  });
})(typeof window !== 'undefined' ? window : globalThis);
