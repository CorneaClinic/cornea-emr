/**
 * Shared helpers for cloud auth pages (forgot / reset password).
 */
(function (global) {
  'use strict';

  const STORAGE_BASE = 'corneaEmr_apiBase';
  const DEFAULT_API_BASE = 'https://corneaclinic-2zfpt.ondigitalocean.app';

  function getApiBase() {
    return (localStorage.getItem(STORAGE_BASE) || DEFAULT_API_BASE).replace(/\/$/, '');
  }

  function setApiBase(url) {
    const base = (url || '').trim().replace(/\/$/, '');
    if (base) localStorage.setItem(STORAGE_BASE, base);
    return base;
  }

  function queryParam(name) {
    return new URLSearchParams(global.location.search).get(name) || '';
  }

  /**
   * @param {string} path e.g. /api/v1/auth/password-reset/request
   * @param {object} body
   */
  async function apiPost(path, body) {
    const base = getApiBase();
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.error || res.statusText;
      throw new Error(typeof msg === 'string' ? msg : 'Request failed');
    }
    return data;
  }

  /** Min 12 chars, upper, lower, number — matches API policy. */
  function validateNewPassword(password) {
    const p = String(password || '');
    if (p.length < 12) return 'Password must be at least 12 characters.';
    if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
      return 'Password must include uppercase, lowercase, and a number.';
    }
    return null;
  }

  global.CorneaAuthPages = {
    getApiBase,
    setApiBase,
    queryParam,
    apiPost,
    validateNewPassword,
    DEFAULT_API_BASE
  };
})(typeof window !== 'undefined' ? window : globalThis);
