/**
 * Cornea Clinic — Cloud sync adapter (local-first)
 * IndexedDB = offline cache; PostgreSQL = source of truth via sync queue.
 */
(function (global) {
  'use strict';

  const STORAGE_TOKEN = 'corneaEmr_apiToken';
  const STORAGE_BASE = 'corneaEmr_apiBase';
  const STORAGE_EMAIL = 'corneaEmr_apiEmail';
  const DEFAULT_API_BASE = 'https://api.visionemr.net';
  const STORE_PATIENTS = 'patients';
  const STORE_KP_PATIENTS = 'kpPatients';
  const STORE_KP_TISSUES = 'kpTissues';

  let token = null;
  let baseUrl = '';

  function apiNetworkHelp() {
    if (location.protocol === 'file:') {
      return 'Open via http://127.0.0.1:8080/Cornea.html (run: node clinic-server.js) — not as a file on disk.';
    }
    const api = baseUrl || DEFAULT_API_BASE;
    if (global.CorneaAuthEnv?.isPublicDeployment?.()) {
      return `Cannot reach the clinic server at ${api}. The API PC may be off or the Cloudflare tunnel may need restarting. Ask your administrator to run scripts/restart-production-stack.ps1 on the clinic computer, then try again.`;
    }
    return `Cannot reach the API at ${api}. Start it with: cd cornea-emr/apps/api && npm run dev`;
  }

  async function probeApiReachable(url) {
    const base = (url || baseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${base}/health/live`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      return res.ok;
    } catch (_) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshLoginApiStatus() {
    const urlEl = document.getElementById('corneaLoginApiUrl');
    const statusEl = document.getElementById('corneaLoginApiStatus');
    const offlineBtn = document.getElementById('corneaLoginOfflineBtn');
    if (!statusEl || !urlEl) return;
    const url = urlEl.value.trim() || DEFAULT_API_BASE;
    statusEl.textContent = 'Checking server…';
    statusEl.style.color = 'var(--text-muted, #666)';
    statusEl.style.display = 'block';
    const ok = await probeApiReachable(url);
    if (offlineBtn) {
      offlineBtn.style.display = isPublicHost() && !ok ? '' : 'none';
    }
    if (ok) {
      statusEl.textContent = 'Server reachable';
      statusEl.style.color = 'var(--success, #2e7d32)';
    } else {
      statusEl.textContent = isPublicHost()
        ? 'Server unreachable — you can continue offline with a local account on this device.'
        : 'Server unreachable — start the API before signing in.';
      statusEl.style.color = 'var(--danger, #c62828)';
    }
  }

  function beginOfflineFallbackFromCloudModal() {
    global.CorneaAuthEnv?.enableOfflineFallback?.();
    const overlay = document.getElementById('corneaCloudLoginModal');
    if (!overlay) return;
    dismissAuthModalOverlay(overlay);
    const resolve = overlay._corneaLoginResolve;
    overlay._corneaLoginResolve = null;
    if (resolve) resolve('offline');
  }

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': localStorage.getItem('corneaEmr_deviceId') || '',
      ...(options.headers || {})
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        credentials: 'include'
      });
    } catch (networkErr) {
      const err = new Error(apiNetworkHelp());
      err.cause = networkErr;
      throw err;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.error?.message || body.error || res.statusText;
      const err = new Error(typeof message === 'string' ? message : 'Request failed');
      err.status = res.status;
      err.details = body.error?.details || body.data;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function login(email, password) {
    const data = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    token = data.accessToken;
    localStorage.setItem(STORAGE_TOKEN, token);
    if (email) localStorage.setItem(STORAGE_EMAIL, email);
    applyUserContext(data.user);
    return data.user;
  }

  function applyUserContext(user) {
    global.__corneaUser = user || null;
    if (user) {
      global.CorneaAuthEnv?.clearOfflineFallback?.();
    }
    if (user && global.CorneaOfflineAuth) {
      global.__corneaCloudMode = true;
      global.CorneaOfflineAuth.initAfterCloudCheck(true);
    } else if (!user) {
      global.CorneaAuthEnv?.lockUi?.();
    }
    if (global.CorneaSections) {
      global.CorneaSections.apply(user?.emrSections || null);
    }
    if (user?.emrSections?.user_admin && global.CorneaAdminUsers) {
      global.CorneaAdminUsers.init();
    }
  }

  async function logout() {
    try {
      if (token) {
        await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
      }
    } catch (_) { /* ignore */ }
    if (global.CorneaSync) {
      global.CorneaSync.stopLongPoll();
      global.CorneaSync.onInboundChanges = null;
    }
    token = null;
    localStorage.removeItem(STORAGE_TOKEN);
    global.__corneaCloudMode = false;
    applyUserContext(null);
    updateCloudHeader(false);
    if (global.CorneaOfflineAuth) {
      if (isPublicHost()) {
        await global.CorneaOfflineAuth.initAfterCloudCheck(false);
      } else {
        await global.CorneaOfflineAuth.onDbReady();
      }
    }
  }

  function isPublicHost() {
    return global.CorneaAuthEnv?.isPublicDeployment?.() === true;
  }

  function configureCloudLoginModal() {
    const hint = document.querySelector('#corneaCloudLoginModal .form-hint');
    if (hint) {
      hint.textContent = isPublicHost()
        ? 'Sign in with your clinic cloud account. If the clinic server is offline, use Continue offline (local data on this device only).'
        : 'Sign in with your clinic cloud account, or use offline sign in below.';
    }
  }

  function ensureLoginModal() {
    if (document.getElementById('corneaCloudLoginModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'corneaCloudLoginModal';
    overlay.className = 'emr-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="emr-modal emr-modal-sm" role="dialog" aria-modal="true" aria-labelledby="corneaCloudLoginTitle">
        <div class="emr-modal-header">
          <h2 id="corneaCloudLoginTitle"><i class="fa-solid fa-cloud"></i> Cloud Sign In</h2>
        </div>
        <div class="emr-modal-body">
          <p class="form-hint" style="margin-bottom:12px;">Sign in to sync with the Cornea EMR API. Credentials are never stored in the page source.</p>
          <div class="form-group"><label for="corneaLoginApiUrl">API URL</label>
            <input type="url" id="corneaLoginApiUrl" autocomplete="off" placeholder="http://127.0.0.1:3000" /></div>
          <div class="form-group"><label for="corneaLoginEmail">Email</label>
            <input type="email" id="corneaLoginEmail" autocomplete="username" /></div>
          <div class="form-group"><label for="corneaLoginPassword">Password</label>
            <input type="password" id="corneaLoginPassword" autocomplete="current-password" /></div>
          <p id="corneaLoginApiStatus" class="form-hint" style="display:none;margin-top:4px;"></p>
          <p id="corneaLoginError" class="form-hint" style="color:var(--danger,#c62828);display:none;"></p>
          <p style="margin-top:8px;text-align:center;font-size:0.85rem;">
            <a href="forgot-password.html" id="corneaForgotPasswordLink">Forgot password?</a>
          </p>
        </div>
        <div class="emr-modal-footer">
          <button type="button" class="btn-primary" id="corneaLoginSubmitBtn"><i class="fa-solid fa-right-to-bracket"></i> Sign in</button>
          <button type="button" class="btn-secondary" id="corneaLoginOfflineBtn" style="display:none;margin-left:8px;"><i class="fa-solid fa-laptop"></i> Continue offline</button>
        </div>
      </div>`;
    overlay.setAttribute('data-auth-modal', 'required');
    document.body.appendChild(overlay);
  }

  function openLoginModal(opts = {}) {
    ensureLoginModal();
    configureCloudLoginModal();
    const overlay = document.getElementById('corneaCloudLoginModal');
    const errEl = document.getElementById('corneaLoginError');
    const urlEl = document.getElementById('corneaLoginApiUrl');
    const emailEl = document.getElementById('corneaLoginEmail');
    const passEl = document.getElementById('corneaLoginPassword');
    if (urlEl) urlEl.value = opts.baseUrl || localStorage.getItem(STORAGE_BASE) || DEFAULT_API_BASE;
    if (emailEl) emailEl.value = opts.email || localStorage.getItem(STORAGE_EMAIL) || '';
    if (passEl) passEl.value = '';
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    refreshLoginApiStatus();
    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('corneaCloudLoginModal');
    } else {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('emr-modal-open');
    }
    global.CorneaAuthEnv?.lockUi?.();
    return new Promise((resolve) => {
      overlay._corneaLoginResolve = resolve;
    });
  }

  function dismissAuthModalOverlay(overlay) {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.emr-modal-overlay.is-open')) {
      document.body.classList.remove('emr-modal-open');
    }
  }

  function closeLoginModal(result) {
    if (!result) return;
    const overlay = document.getElementById('corneaCloudLoginModal');
    if (!overlay) return;
    dismissAuthModalOverlay(overlay);
    const resolve = overlay._corneaLoginResolve;
    overlay._corneaLoginResolve = null;
    if (resolve) resolve(result);
  }

  function bindLoginModalOnce() {
    if (bindLoginModalOnce._bound) return;
    bindLoginModalOnce._bound = true;
    ensureLoginModal();
    document.getElementById('corneaLoginApiUrl')?.addEventListener('change', () => refreshLoginApiStatus());
    document.getElementById('corneaLoginOfflineBtn')?.addEventListener('click', () => {
      beginOfflineFallbackFromCloudModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = document.getElementById('corneaCloudLoginModal');
      const pwModal = document.getElementById('corneaPwChangeModal');
      if (modal?.classList.contains('is-open') || pwModal?.classList.contains('is-open')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
    document.getElementById('corneaLoginSubmitBtn')?.addEventListener('click', async () => {
      const errEl = document.getElementById('corneaLoginError');
      const base = document.getElementById('corneaLoginApiUrl')?.value.trim();
      const email = document.getElementById('corneaLoginEmail')?.value.trim();
      const password = document.getElementById('corneaLoginPassword')?.value;
      if (!base || !email || !password) {
        if (errEl) { errEl.textContent = 'API URL, email, and password are required.'; errEl.style.display = 'block'; }
        return;
      }
      const submitBtn = document.getElementById('corneaLoginSubmitBtn');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await CorneaApi.enable({ baseUrl: base, email, password });
        global.CorneaAuthEnv?.unlockUi?.();
        closeLoginModal(true);
      } catch (e) {
        if (errEl) { errEl.textContent = e.message || 'Sign in failed'; errEl.style.display = 'block'; }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function ensurePasswordChangeModal() {
    if (document.getElementById('corneaPwChangeModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'corneaPwChangeModal';
    overlay.className = 'emr-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="emr-modal emr-modal-sm" role="dialog" aria-modal="true" aria-labelledby="corneaPwChangeTitle">
        <div class="emr-modal-header">
          <h2 id="corneaPwChangeTitle"><i class="fa-solid fa-key"></i> Change Password</h2>
        </div>
        <div class="emr-modal-body">
          <p class="form-hint" style="margin-bottom:12px;">Your password must be changed before continuing. Minimum 12 characters with upper case, lower case, a number, and a symbol.</p>
          <div class="form-group"><label for="corneaPwCurrent">Current (temporary) password</label>
            <input type="password" id="corneaPwCurrent" autocomplete="current-password" /></div>
          <div class="form-group"><label for="corneaPwNew">New password</label>
            <input type="password" id="corneaPwNew" autocomplete="new-password" /></div>
          <div class="form-group"><label for="corneaPwConfirm">Confirm new password</label>
            <input type="password" id="corneaPwConfirm" autocomplete="new-password" /></div>
          <p id="corneaPwChangeError" class="form-hint" style="color:var(--danger,#c62828);display:none;"></p>
        </div>
        <div class="emr-modal-footer">
          <button type="button" class="btn-primary" id="corneaPwChangeSubmitBtn"><i class="fa-solid fa-check"></i> Update password</button>
        </div>
      </div>`;
    overlay.setAttribute('data-auth-modal', 'required');
    document.body.appendChild(overlay);
  }

  function openPasswordChangeModal() {
    ensurePasswordChangeModal();
    const overlay = document.getElementById('corneaPwChangeModal');
    const errEl = document.getElementById('corneaPwChangeError');
    ['corneaPwCurrent', 'corneaPwNew', 'corneaPwConfirm'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('corneaPwChangeModal');
    } else {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('emr-modal-open');
    }
    return new Promise((resolve) => {
      overlay._corneaPwResolve = resolve;
    });
  }

  function closePasswordChangeModal(result) {
    if (!result) return;
    const overlay = document.getElementById('corneaPwChangeModal');
    if (!overlay) return;
    dismissAuthModalOverlay(overlay);
    const resolve = overlay._corneaPwResolve;
    overlay._corneaPwResolve = null;
    if (resolve) resolve(result);
  }

  function bindPasswordChangeModalOnce() {
    if (bindPasswordChangeModalOnce._bound) return;
    bindPasswordChangeModalOnce._bound = true;
    ensurePasswordChangeModal();
    document.getElementById('corneaPwChangeSubmitBtn')?.addEventListener('click', async () => {
      const errEl = document.getElementById('corneaPwChangeError');
      const showErr = (msg) => {
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      };
      const current = document.getElementById('corneaPwCurrent')?.value;
      const newer = document.getElementById('corneaPwNew')?.value;
      const confirmVal = document.getElementById('corneaPwConfirm')?.value;
      if (!current || !newer) { showErr('All fields are required.'); return; }
      if (newer !== confirmVal) { showErr('New passwords do not match.'); return; }

      const btn = document.getElementById('corneaPwChangeSubmitBtn');
      if (btn) btn.disabled = true;
      try {
        await api('/api/v1/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current, newPassword: newer })
        });
        closePasswordChangeModal(true);
      } catch (e) {
        showErr(e.message || 'Password change failed.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  async function promptPasswordChangeIfNeeded(user) {
    if (!user?.mustChangePassword) return;
    bindPasswordChangeModalOnce();
    await openPasswordChangeModal();
  }

  function collectFormData() {
    if (typeof global.collectFormDataObject === 'function') {
      const data = global.collectFormDataObject();
      data.lastModified = new Date().toISOString();
      return data;
    }
    const form = document.getElementById('patientForm');
    const data = {};
    if (!form) return data;
    form.querySelectorAll('input, textarea, select').forEach((input) => {
      if (input.type === 'radio') {
        if (input.checked) data[input.name] = input.value;
      } else if (input.id) {
        data[input.id] = input.value;
      }
    });
    data.lastModified = new Date().toISOString();
    const currentId = document.getElementById('currentRecordId')?.value;
    if (currentId) data.id = parseInt(currentId, 10);
    const uuid = document.getElementById('currentRecordUuid')?.value;
    if (uuid) data.uuid = uuid;
    return data;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!global.db) return resolve([]);
      const req = global.db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(storeName, id) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([storeName], 'readonly').objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function bootstrapCloudUi(self) {
    if (!global.db || !global.CorneaSync) return;
    if (global.CorneaSync._bootstrapped) {
      global.CorneaSync.onInboundChanges = (summary) => self.handleInboundSyncChanges(summary);
      if (!global.CorneaSync.longPollActive) global.CorneaSync.startLongPoll();
      await global.CorneaSync.syncAll().catch(() => {});
      return;
    }
    global.CorneaSync._bootstrapped = true;
    await global.CorneaSync.migrateExistingRecords();
    global.CorneaSync.onInboundChanges = (summary) => self.handleInboundSyncChanges(summary);
    global.CorneaSync.init(api);
    global.CorneaSync.startLongPoll();
    await global.CorneaSync.syncAll();
    await self.refreshRecordsList();
    if (typeof global.updateDashboardStats === 'function') {
      global.updateDashboardStats();
    }
    updateCloudHeader(true);
  }

  async function ensureCloudBootstrap(self) {
    if (global.db) global.__corneaIdbReady = true;
    if (global.__corneaIdbReady && global.db) {
      await bootstrapCloudUi(self);
      return;
    }
    global.__corneaOnCloudReady = () => bootstrapCloudUi(self);
  }

  function bindCloudHeaderActions(wrap) {
    wrap.querySelector('#corneaCloudLogoutBtn')?.addEventListener('click', async () => {
      if (!confirm('Sign out of cloud sync? Local records remain on this device.')) return;
      await logout();
    });
    wrap.querySelector('#corneaCloudSignInBtn')?.addEventListener('click', () => {
      bindLoginModalOnce();
      openLoginModal();
    });
  }

  function updateCloudHeader(connected) {
    const header = document.querySelector('.topbar-right') || document.querySelector('.page-header');
    if (!header) return;

    let wrap = document.getElementById('corneaCloudBadgeWrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.id = 'corneaCloudBadgeWrap';
      wrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:12px;';
      header.appendChild(wrap);
    }

    if (connected) {
      wrap.innerHTML = `
        <span id="corneaCloudBadge" class="cornea-cloud-badge" title="Offline cache with PostgreSQL sync"
          style="padding:4px 10px;border-radius:999px;font-size:0.72rem;font-weight:600;background:#e8f5e9;color:#2e7d32;display:inline-flex;align-items:center;gap:6px;">
          <i class="fa-solid fa-cloud"></i> Cloud Sync
        </span>
        <button type="button" id="corneaCloudLogoutBtn" class="btn-secondary btn-sm" style="font-size:0.72rem;padding:4px 8px;">Sign out</button>`;
    } else {
      wrap.innerHTML = `
        <button type="button" id="corneaCloudSignInBtn" class="btn-primary btn-sm" style="font-size:0.72rem;padding:4px 10px;">
          <i class="fa-solid fa-cloud"></i> Sign in to Cloud
        </button>`;
    }

    bindCloudHeaderActions(wrap);
    if (connected && global.CorneaSync) global.CorneaSync.updateSyncBadge();
  }

  function showCloudBadge(visible) {
    updateCloudHeader(!!visible);
  }

  const CorneaApi = {
    isEnabled: () => !!baseUrl && !!token,

    getBaseUrl: () => baseUrl,

    async request(path, options = {}) {
      return api(path, options);
    },

    async logout() {
      await logout();
    },

    async signIn() {
      bindLoginModalOnce();
      const ok = await openLoginModal();
      return !!ok;
    },

    async tryConnect(opts = {}) {
      bindLoginModalOnce();
      const url = (opts.baseUrl || localStorage.getItem(STORAGE_BASE) || DEFAULT_API_BASE).replace(/\/$/, '');
      baseUrl = url;
      localStorage.setItem(STORAGE_BASE, url);
      token = localStorage.getItem(STORAGE_TOKEN);

      if (token) {
        try {
          const me = await api('/api/v1/auth/me');
          global.__corneaCloudMode = true;
          applyUserContext(me.user);
          this.patchGlobals();
          showCloudBadge(true);
          await promptPasswordChangeIfNeeded(me.user);
          await ensureCloudBootstrap(this);
          console.info('[CorneaApi] Restored cloud session:', url);
          return true;
        } catch (_) {
          token = null;
          localStorage.removeItem(STORAGE_TOKEN);
        }
      }

      updateCloudHeader(false);

      if (opts.prompt !== false) {
        const apiUp = await probeApiReachable(url);
        if (isPublicHost() && !apiUp) {
          global.CorneaAuthEnv?.enableOfflineFallback?.();
          return false;
        }
        const signedIn = await openLoginModal({ baseUrl: url });
        if (signedIn === 'offline') {
          return false;
        }
        if (!signedIn) updateCloudHeader(false);
        return !!signedIn;
      }
      return false;
    },

    async enable(opts) {
      baseUrl = (opts.baseUrl || localStorage.getItem(STORAGE_BASE) || DEFAULT_API_BASE).replace(/\/$/, '');
      if (!baseUrl) throw new Error('baseUrl required');
      localStorage.setItem(STORAGE_BASE, baseUrl);
      global.__corneaCloudMode = true;

      try {
        let profileUser = null;
        if (opts.token) {
          token = opts.token;
          localStorage.setItem(STORAGE_TOKEN, token);
        } else if (opts.email && opts.password) {
          profileUser = await login(opts.email, opts.password);
          await promptPasswordChangeIfNeeded(profileUser);
        } else {
          token = localStorage.getItem(STORAGE_TOKEN);
        }
        if (!token) throw new Error('Login required');

        if (!profileUser) {
          const me = await api('/api/v1/auth/me');
          profileUser = me.user;
          applyUserContext(profileUser);
        }

        this.patchGlobals();
        showCloudBadge(true);

        await ensureCloudBootstrap(this);

        if (typeof global.updateDiagnosisIcdStatusMessage === 'function') {
          global.updateDiagnosisIcdStatusMessage();
        }
        if (typeof global.renderIcdReadOnlyView === 'function') {
          global.renderIcdReadOnlyView();
        }

        console.info('[CorneaApi] Sync mode enabled:', baseUrl);
        return true;
      } catch (err) {
        global.__corneaCloudMode = false;
        updateCloudHeader(false);
        throw err;
      }
    },

    patchGlobals() {
      const self = this;
      const sync = () => global.CorneaSync;

      global.saveToDatabase = async function () {
        const form = document.getElementById('patientForm');
        if (!form || !form.checkValidity()) {
          if (form) form.reportValidity();
          return;
        }
        if (typeof global.syncMedicalAdviceJSON === 'function') {
          global.syncMedicalAdviceJSON();
        }
        if (global.CorneaVisitMedia) {
          global.CorneaVisitMedia.syncToHiddenField();
        }

        try {
          const data = collectFormData();
          let existingForSave = null;
          if (data.id != null && !Number.isNaN(data.id)) {
            existingForSave = await idbGet(STORE_PATIENTS, data.id);
          }
          if (window.CorneaSectionAttribution && existingForSave) {
            window.CorneaSectionAttribution.applyBeforeSave(data, existingForSave);
          }
          if (global.CorneaPatientFlow) {
            global.CorneaPatientFlow.applyOnSave(data, existingForSave);
          }
          if (global.CorneaVisualAcuity) {
            global.CorneaVisualAcuity.applyBeforeSave(data);
          }
          const saved = await sync().saveVisitLocal(data);

          document.getElementById('currentRecordId').value = saved.id;
          const uuidEl = document.getElementById('currentRecordUuid');
          if (uuidEl) uuidEl.value = saved.uuid || '';
          global._currentViewRecordId = saved.id;

          alert('Patient record saved locally. Syncing to cloud…');
          closeEmrModal('emrPatientModal');
          renderPatientReadOnly(saved, 'patientReadOnlyContent');
          updatePatientReadOnlyToolbar(true);
          await self.refreshRecordsList();
          global.updateDashboardStats();
          global.refreshPatientVisitHistory();
          if (global.CorneaPatientFlow) global.CorneaPatientFlow.refresh();
          global.switchTab('formTab');
          sync().scheduleDrain(true);
          if (saved.uuid && global.CorneaVisitMedia) {
            global.CorneaVisitMedia.flushPendingUploads(saved.uuid).catch((e) => {
              console.warn('[CorneaVisitMedia]', e.message);
            });
          }
        } catch (e) {
          alert('Error saving record: ' + e.message);
        }
      };

      global.loadAndEditRecord = async function (id) {
        try {
          const data = await idbGet(STORE_PATIENTS, id);
          if (!data) throw new Error('Record not found locally');
          global._currentViewRecordId = data.id;
          document.getElementById('currentRecordId').value = data.id;
          const uuidEl = document.getElementById('currentRecordUuid');
          if (uuidEl) uuidEl.value = data.uuid || '';
          global.populateFormFromData(data);
          global.refreshPatientVisitHistory();
          global.openPatientFormModal('edit');
        } catch (e) {
          alert('Could not load record: ' + e.message);
        }
      };

      global.viewRecordReadOnly = async function (id, target) {
        try {
          const data = await idbGet(STORE_PATIENTS, id);
          if (!data) throw new Error('Record not found locally');
          global._currentViewRecordId = data.id;
          document.getElementById('currentRecordId').value = data.id;
          const uuidEl = document.getElementById('currentRecordUuid');
          if (uuidEl) uuidEl.value = data.uuid || '';
          global.populateFormFromData(data);
          const panel = target === 'records' ? 'recordReadOnlyContent' : 'patientReadOnlyContent';
          global.renderPatientReadOnly(data, panel);
          global.updatePatientReadOnlyToolbar(true);
          if (target === 'records') global.switchTab('recordsTab');
          else global.switchTab('formTab');
        } catch (e) {
          alert('Could not load record: ' + e.message);
        }
      };

      global.deleteRecord = async function (id) {
        if (!confirm('Are you sure you want to permanently delete this record?')) return;
        try {
          await sync().deleteVisitLocal(id);
          await self.refreshRecordsList();
          global.updateDashboardStats();
          global.refreshPatientVisitHistory();
          sync().scheduleDrain(true);
        } catch (e) {
          alert('Delete failed: ' + e.message);
        }
      };

      global.updateDashboardStats = async function () {
        const records = await idbGetAll(STORE_PATIENTS);
        const today = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        let maleCount = 0;
        let femaleCount = 0;
        let latestDate = null;

        records.forEach((r) => {
          if (r.visitDate === today) todayCount++;
          if (r.sex === 'Male') maleCount++;
          if (r.sex === 'Female') femaleCount++;
          if (r.lastModified && (!latestDate || r.lastModified > latestDate)) latestDate = r.lastModified;
        });

        const set = (id, v) => {
          const el = document.getElementById(id);
          if (el) el.textContent = v;
        };
        set('statTotalPatients', records.length);
        set('statTodayVisits', todayCount);
        set('statSexRatio', `${maleCount} / ${femaleCount}`);
        const lastEl = document.getElementById('statLastUpdated');
        if (lastEl && latestDate) {
          lastEl.textContent = new Date(latestDate).toLocaleDateString();
        }

        const recent = [...records]
          .sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
          .slice(0, 5);
        const recentBody = document.getElementById('recentActivityBody');
        if (recentBody) {
          recentBody.innerHTML = recent.map((r) => `
            <tr>
              <td><strong>${escapeHtml(r.fullName)}</strong></td>
              <td><span class="patient-id-badge">${escapeHtml(r.patientId)}</span></td>
              <td>${escapeHtml(r.visitDate || '')}</td>
              <td><button type="button" class="btn-info" onclick="viewRecordReadOnly(${r.id})"><i class="fa-solid fa-eye"></i> View</button></td>
            </tr>`).join('') || '<tr><td colspan="4">No activity yet.</td></tr>';
        }

        if (global.navigator.onLine !== false && sync()) {
          sync().pull().catch(() => {});
        }
      };

      global.refreshPatientVisitHistory = async function () {
        const patientId = document.getElementById('patientId')?.value?.trim();
        const currentRecordId = document.getElementById('currentRecordId')?.value;

        if (!patientId) {
          global._patientVisitsCache = [];
          global.renderVisitHistorySidebar([], null);
          return;
        }

        const records = await idbGetAll(STORE_PATIENTS);
        const visits = records
          .filter((r) => r.patientId === patientId)
          .sort((a, b) => String(a.visitDate).localeCompare(String(b.visitDate)))
          .map((v) => ({
            id: v.id,
            uuid: v.uuid,
            visitDate: v.visitDate || '',
            chiefComplaint: v.chiefComplaint || '',
            diagnosis: v.diagnosis || '',
            patientId: v.patientId,
            fullName: v.fullName || '',
            dob: v.dob || '',
            sex: v.sex || '',
            phone: v.phone || '',
            address: v.address || '',
            sync_status: v.sync_status
          }));

        global._patientVisitsCache = visits;
        global.renderVisitHistorySidebar(
          visits,
          currentRecordId ? parseInt(currentRecordId, 10) : null
        );
        global.autofillPatientInfoFromPreviousVisit(patientId, visits);
      };

      global.loadRecords = function () {
        self.refreshRecordsList().catch((e) => console.warn('[CorneaApi] loadRecords failed', e));
      };

      const originalSaveKpPatient = global.saveKpPatient;
      global.saveKpPatient = async function () {
        if (!originalSaveKpPatient) return;
        const name = document.getElementById('kpFullName')?.value?.trim();
        if (!name) { alert('Full name is required.'); return; }

        const data = global.collectKpPatientForm?.() || {};
        if (!data.kpPatientId && global.kpNextId) {
          data.kpPatientId = await global.kpNextId(STORE_KP_PATIENTS, 'KP-P-');
        }
        if (!data.kpRegDate) data.kpRegDate = new Date().toISOString().split('T')[0];
        const recordId = document.getElementById('kpRecordId')?.value;
        if (recordId) data.id = parseInt(recordId, 10);

        try {
          const saved = await sync().saveKpLocal(STORE_KP_PATIENTS, data, 'kp_patient');
          alert('Keratoplasty patient saved locally. Syncing…');
          closeEmrModal('kpPatientModal');
          global.resetKpPatientForm();
          await global.initKeratoplastyTab();
          sync().scheduleDrain(true);
        } catch (e) {
          alert('Error saving patient: ' + e.message);
        }
      };

      const originalSaveKpTissue = global.saveKpTissue;
      global.saveKpTissue = async function () {
        const data = global.collectKpTissueForm?.() || {};
        if (!data.kpTissueId && global.kpNextId) {
          data.kpTissueId = await global.kpNextId(STORE_KP_TISSUES, 'KP-T-');
        }
        const recordId = document.getElementById('kpTissueRecordId')?.value;
        if (recordId) data.id = parseInt(recordId, 10);

        try {
          await sync().saveKpLocal(STORE_KP_TISSUES, data, 'kp_tissue');
          alert('Tissue record saved locally. Syncing…');
          closeEmrModal('kpTissueModal');
          global.resetKpTissueForm();
          await global.initKeratoplastyTab();
          sync().scheduleDrain(true);
        } catch (e) {
          alert('Error saving tissue: ' + e.message);
        }
      };

      global.deleteKpPatient = async function (id) {
        if (!confirm('Delete this keratoplasty patient record?')) return;
        await sync().deleteKpLocal(STORE_KP_PATIENTS, id, 'kp_patient');
        await global.initKeratoplastyTab();
        sync().scheduleDrain(true);
      };

      global.deleteKpTissue = async function (id) {
        if (!confirm('Delete this tissue record?')) return;
        await sync().deleteKpLocal(STORE_KP_TISSUES, id, 'kp_tissue');
        await global.initKeratoplastyTab();
        sync().scheduleDrain(true);
      };
    },

    async refreshRecordsList() {
      const body = document.getElementById('recordsBody');
      if (!body) return;

      const records = await idbGetAll(STORE_PATIENTS);
      const sorted = records.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));

      body.innerHTML = sorted.length ? sorted.map((r) => {
        const syncIcon = r.sync_status === 'synced'
          ? '<i class="fa-solid fa-cloud" title="Synced"></i>'
          : r.sync_status === 'conflict'
            ? '<i class="fa-solid fa-triangle-exclamation" title="Conflict"></i>'
            : '<i class="fa-solid fa-clock" title="Pending sync"></i>';
        return `
        <tr>
          <td><span class="patient-id-badge">${escapeHtml(r.patientId || '—')}</span> ${syncIcon}</td>
          <td>${escapeHtml(r.fullName || 'Unnamed')}</td>
          <td>${escapeHtml(r.visitDate || '')}</td>
          <td>${escapeHtml(r.phone || '—')}</td>
          <td class="no-print records-actions">
            <button type="button" class="btn-info" onclick="viewRecordReadOnly(${r.id}, 'records')"><i class="fa-solid fa-eye"></i> View</button>
            <button type="button" class="btn-secondary btn-sm" onclick="loadAndEditRecord(${r.id})"><i class="fa-solid fa-pen"></i> Edit</button>
            <button type="button" class="btn-danger btn-sm" onclick="deleteRecord(${r.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      }).join('') : '<tr><td colspan="5"><div class="empty-state">No records found.</div></td></tr>';

      if (global.CorneaSync) global.CorneaSync.updateSyncBadge();
    },

    handleInboundSyncChanges(summary) {
      if (!summary || (summary.applied === 0 && summary.deleted === 0)) return;

      if (typeof global.loadRecords === 'function') global.loadRecords();
      if (typeof global.updateDashboardStats === 'function') {
        global.updateDashboardStats();
      }
      if (summary.entityTypes?.some((t) => t === 'kp_patient' || t === 'kp_tissue')) {
        if (typeof global.initKeratoplastyTab === 'function') {
          global.initKeratoplastyTab().catch(() => {});
        }
      }
      if (typeof global.refreshPatientVisitHistory === 'function') {
        global.refreshPatientVisitHistory();
      }
      if (global.CorneaPatientFlow) global.CorneaPatientFlow.refresh();

      const currentId = global._currentViewRecordId;
      if (currentId != null && summary.entityTypes?.includes('visit')) {
        const recordsTab = document.getElementById('recordsTab');
        const onRecords = recordsTab?.classList.contains('active');
        if (typeof global.viewRecordReadOnly === 'function') {
          global.viewRecordReadOnly(currentId, onRecords ? 'records' : undefined).catch(() => {});
        }
      }

      this.showRemoteUpdateToast(summary);
    },

    showRemoteUpdateToast(summary) {
      const count = (summary.applied || 0) + (summary.deleted || 0);
      if (count < 1) return;

      let toast = document.getElementById('corneaSyncRemoteToast');
      if (toast) toast.remove();

      const label = count === 1
        ? '1 record updated from another device'
        : `${count} records updated from another device`;

      toast = document.createElement('div');
      toast.id = 'corneaSyncRemoteToast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:10001;background:#1565c0;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-size:0.88rem;max-width:320px;display:flex;gap:10px;align-items:center;';
      toast.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i><span>${escapeHtml(label)}</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
    }
  };

  global.CorneaApi = CorneaApi;
})(typeof window !== 'undefined' ? window : globalThis);
