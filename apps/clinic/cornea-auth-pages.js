/**
 * Shared helpers for cloud auth pages (forgot / reset password).
 */
(function (global) {
  'use strict';

  const STORAGE_BASE = 'corneaEmr_apiBase';
  const DEFAULT_API_BASE = 'https://corneaclinic-2zfpt.ondigitalocean.app';
  const LEGACY_API_BASE = 'https://api.visionemr.net';
  const API_CANDIDATES = [DEFAULT_API_BASE, LEGACY_API_BASE];

  function isPublicHost() {
    const host = (global.location?.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === 'clinic.local' || !host) {
      return false;
    }
    return global.location?.protocol !== 'file:';
  }

  function isUnusableApiUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return true;
    try {
      const u = new URL(raw);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      if (isPublicHost() && u.protocol === 'http:') return true;
      return false;
    } catch (_) {
      return true;
    }
  }

  function queryParam(name) {
    return new URLSearchParams(global.location.search).get(name) || '';
  }

  function normalizeBase(url) {
    return String(url || '').trim().replace(/\/$/, '');
  }

  function getApiBase() {
    const fromQuery = queryParam('api');
    if (fromQuery && !isUnusableApiUrl(fromQuery)) {
      return normalizeBase(fromQuery);
    }

    const stored = localStorage.getItem(STORAGE_BASE);
    if (stored && !isUnusableApiUrl(stored)) {
      return normalizeBase(stored);
    }

    if (isPublicHost()) {
      return DEFAULT_API_BASE;
    }

    return normalizeBase(stored || DEFAULT_API_BASE);
  }

  function setApiBase(url) {
    const base = normalizeBase(url);
    if (base && !isUnusableApiUrl(base)) {
      localStorage.setItem(STORAGE_BASE, base);
    }
    return base;
  }

  function apiCandidates(preferred) {
    const list = [];
    const add = (url) => {
      const base = normalizeBase(url);
      if (base && !list.includes(base)) list.push(base);
    };
    add(preferred);
    add(getApiBase());
    for (const c of API_CANDIDATES) add(c);
    if (!isPublicHost()) add('http://127.0.0.1:3000');
    return list;
  }

  /**
   * @param {string} base
   * @param {string} path
   * @param {object} body
   */
  async function apiPostAt(base, path, body) {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      const msg = err?.message || '';
      if (msg === 'Failed to fetch' || err instanceof TypeError) {
        throw new Error(
          isPublicHost()
            ? `Cannot reach the API at ${base}. Use ${DEFAULT_API_BASE} and check your connection.`
            : `Cannot reach the API at ${base}. Start the API server (npm run dev in apps/api).`
        );
      }
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.error || res.statusText;
      throw new Error(typeof msg === 'string' ? msg : 'Request failed');
    }
    return data;
  }

  /**
   * @param {string} path e.g. /api/v1/auth/password-reset/request
   * @param {object} body
   * @param {string} [preferredBase]
   */
  async function apiPost(path, body, preferredBase) {
    let lastErr;
    for (const base of apiCandidates(preferredBase)) {
      try {
        const data = await apiPostAt(base, path, body);
        setApiBase(base);
        return data;
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || '');
        const retryable =
          msg.includes('Cannot reach the API') ||
          msg === 'Failed to fetch' ||
          err instanceof TypeError;
        if (!retryable) throw err;
      }
    }
    throw lastErr || new Error('Request failed');
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

  /**
   * Pre-fill API URL on auth pages; on production, lock to the live API.
   * @param {HTMLInputElement | null} inputEl
   */
  function initApiUrlField(inputEl) {
    if (!inputEl) return;
    const base = getApiBase();
    inputEl.value = base;
    if (isPublicHost()) {
      inputEl.readOnly = true;
      inputEl.title = 'Production API (fixed for this site)';
    }
  }

  global.CorneaAuthPages = {
    getApiBase,
    setApiBase,
    queryParam,
    apiPost,
    validateNewPassword,
    initApiUrlField,
    DEFAULT_API_BASE,
    API_CANDIDATES
  };
})(typeof window !== 'undefined' ? window : globalThis);
