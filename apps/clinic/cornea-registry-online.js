/**
 * Phase 2.1 M2.2 — registry modules use direct REST (not sync queue).
 * While signed in to cloud, writes require connectivity; local-only mode unchanged.
 */
(function (global) {
  'use strict';

  const bindings = new Map();

  function isCloudRegistryMode() {
    return !!(global.__corneaCloudMode && global.CorneaApi?.isEnabled?.());
  }

  function isRegistryOnline() {
    if (!isCloudRegistryMode()) return true;
    return global.navigator?.onLine !== false;
  }

  function requireCloudOnline(registryLabel) {
    if (isRegistryOnline()) return true;
    const name = registryLabel || 'This registry';
    alert(
      `${name} requires an internet connection while signed in to cloud. ` +
        'Reconnect, then try again. Cached data remains available to view offline.'
    );
    return false;
  }

  function updateBanner(bannerId, registryLabel) {
    const el = bannerId && document.getElementById(bannerId);
    if (!el) return;
    const show = isCloudRegistryMode() && !isRegistryOnline();
    el.hidden = !show;
    if (show) {
      el.textContent =
        `${registryLabel}: saves need internet while signed in to cloud — cached records are read-only offline.`;
    }
  }

  function setWriteControlsDisabled(selectors, disabled) {
    (selectors || []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        btn.disabled = disabled;
        if (disabled) btn.setAttribute('title', 'Reconnect to the internet to save');
        else btn.removeAttribute('title');
      });
    });
  }

  function refreshBinding(key) {
    const cfg = bindings.get(key);
    if (!cfg) return;
    const offline = isCloudRegistryMode() && !isRegistryOnline();
    updateBanner(cfg.bannerId, cfg.registryLabel);
    setWriteControlsDisabled(cfg.writeSelectors, offline);
  }

  function bindRegistryOfflineUi(key, config) {
    bindings.set(key, config);
    if (!config._wired) {
      config._wired = true;
      global.addEventListener('online', () => refreshBinding(key));
      global.addEventListener('offline', () => refreshBinding(key));
    }
    refreshBinding(key);
    return () => refreshBinding(key);
  }

  global.CorneaRegistryOnline = {
    isCloudRegistryMode,
    isRegistryOnline,
    requireCloudOnline,
    updateBanner,
    bindRegistryOfflineUi,
    refresh: (key) => refreshBinding(key)
  };
})(typeof window !== 'undefined' ? window : globalThis);
