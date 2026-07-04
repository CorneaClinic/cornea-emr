/**
 * SSO helpers for cloud login (OIDC redirect + LDAP directory sign-in).
 */
(function (global) {
  'use strict';

  const STORAGE_BASE = 'corneaEmr_apiBase';

  function normalizeBase(url) {
    return String(url || '').trim().replace(/\/$/, '');
  }

  function ssoCallbackPath() {
    const path = global.location?.pathname || '/';
    const dir = path.replace(/[^/]*$/, '');
    return `${global.location?.origin || ''}${dir}sso-callback.html`;
  }

  /**
   * @param {string} baseUrl
   */
  async function fetchSsoConfig(baseUrl) {
    const base = normalizeBase(baseUrl);
    if (!base) {
      return { oidc: { enabled: false }, ldap: { enabled: false } };
    }
    try {
      const res = await fetch(`${base}/api/v1/auth/sso/config`, { credentials: 'include' });
      if (!res.ok) {
        return { oidc: { enabled: false }, ldap: { enabled: false } };
      }
      const body = await res.json();
      return body.data || body;
    } catch (_) {
      return { oidc: { enabled: false }, ldap: { enabled: false } };
    }
  }

  /**
   * @param {string} baseUrl
   * @param {string} [returnUrl]
   */
  function buildOidcLoginUrl(baseUrl, returnUrl) {
    const base = normalizeBase(baseUrl);
    const url = new URL(`${base}/api/v1/auth/sso/oidc/login`);
    url.searchParams.set('returnUrl', returnUrl || ssoCallbackPath());
    return url.toString();
  }

  /**
   * @param {string} baseUrl
   * @param {string} email
   * @param {string} password
   */
  async function loginViaLdap(baseUrl, email, password) {
    const base = normalizeBase(baseUrl);
    const res = await fetch(`${base}/api/v1/auth/sso/ldap/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = body.error?.message || body.error || res.statusText;
      throw new Error(typeof message === 'string' ? message : 'Directory sign-in failed');
    }
    return body;
  }

  function bindSsoButtonsOnce() {
    if (bindSsoButtonsOnce._bound) return;
    bindSsoButtonsOnce._bound = true;

    document.getElementById('corneaLoginOidcBtn')?.addEventListener('click', () => {
      const base = normalizeBase(document.getElementById('corneaLoginApiUrl')?.value);
      if (!base) return;
      localStorage.setItem(STORAGE_BASE, base);
      global.location.href = buildOidcLoginUrl(base);
    });

    document.getElementById('corneaLoginLdapBtn')?.addEventListener('click', async () => {
      const errEl = document.getElementById('corneaLoginError');
      const base = normalizeBase(document.getElementById('corneaLoginApiUrl')?.value);
      const email = document.getElementById('corneaLoginEmail')?.value.trim();
      const password = document.getElementById('corneaLoginPassword')?.value;
      const btn = document.getElementById('corneaLoginLdapBtn');
      if (!base || !email || !password) {
        if (errEl) {
          errEl.textContent = 'API URL, email, and password are required for directory sign-in.';
          errEl.style.display = 'block';
        }
        return;
      }
      const label = btn?.innerHTML;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';
      }
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      try {
        localStorage.setItem(STORAGE_BASE, base);
        const data = await loginViaLdap(base, email, password);
        if (global.CorneaApi?.enable) {
          await global.CorneaApi.enable({
            baseUrl: base,
            token: data.accessToken,
            email: data.user?.email || email
          });
        }
        const overlay = document.getElementById('corneaCloudLoginModal');
        overlay?.classList.remove('is-open');
        overlay?.setAttribute('aria-hidden', 'true');
        if (overlay?._corneaLoginResolve) {
          overlay._corneaLoginResolve(true);
          overlay._corneaLoginResolve = null;
        }
        global.CorneaAuthEnv?.unlockUi?.();
      } catch (e) {
        if (errEl) {
          errEl.textContent = e.message || 'Directory sign-in failed';
          errEl.style.display = 'block';
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          if (label) btn.innerHTML = label;
        }
      }
    });
  }

  /**
   * Show/hide SSO buttons based on API config.
   * @param {string} baseUrl
   */
  async function refreshLoginPanel(baseUrl) {
    bindSsoButtonsOnce();
    const panel = document.getElementById('corneaLoginSsoPanel');
    const oidcBtn = document.getElementById('corneaLoginOidcBtn');
    const ldapBtn = document.getElementById('corneaLoginLdapBtn');
    if (!panel || !oidcBtn || !ldapBtn) return;

    const config = await fetchSsoConfig(baseUrl);
    const oidcOn = config?.oidc?.enabled === true;
    const ldapOn = config?.ldap?.enabled === true;

    oidcBtn.style.display = oidcOn ? '' : 'none';
    ldapBtn.style.display = ldapOn ? '' : 'none';
    panel.style.display = oidcOn || ldapOn ? '' : 'none';
  }

  global.CorneaSso = {
    fetchSsoConfig,
    buildOidcLoginUrl,
    loginViaLdap,
    refreshLoginPanel,
    ssoCallbackPath
  };
})(typeof window !== 'undefined' ? window : globalThis);
