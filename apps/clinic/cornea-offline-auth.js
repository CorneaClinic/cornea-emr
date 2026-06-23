/**
 * Cornea Clinic — offline user authentication (IndexedDB + Web Crypto).
 * Cloud sign-in takes precedence when active.
 */
(function (global) {
  'use strict';

  const STORE_USERS = 'users';
  const SESSION_KEY = 'corneaOfflineSession';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const PBKDF2_ITERATIONS = 120000;

  const ROLES = Object.freeze([
    'administrator',
    'consultant',
    'resident',
    'nurse',
    'technician',
    'receptionist'
  ]);

  const ROLE_LABELS = Object.freeze({
    administrator: 'Administrator',
    consultant: 'Consultant',
    resident: 'Resident',
    nurse: 'Nurse',
    technician: 'Technician',
    receptionist: 'Receptionist'
  });

  const PERMISSIONS = Object.freeze({
    VISITS_WRITE: 'visits:write',
    VISITS_DELETE: 'visits:delete',
    FLOW_MOVE: 'flow:move',
    FLOW_COMPLETE: 'flow:complete',
    DATABASE_EXPORT: 'database:export',
    DATABASE_IMPORT: 'database:import',
    DATABASE_CLEAR: 'database:clear',
    USERS_MANAGE: 'users:manage',
    KP_WRITE: 'kp:write'
  });

  const ROLE_SECTIONS = Object.freeze({
    administrator: {
      dashboard: true, patient_form: true, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: true, kc_registry: true, clinical_media: true, database: true, user_admin: true
    },
    consultant: {
      dashboard: true, patient_form: true, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: true, kc_registry: true, clinical_media: true, database: false, user_admin: false
    },
    resident: {
      dashboard: true, patient_form: true, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: true, kc_registry: true, clinical_media: true, database: false, user_admin: false
    },
    nurse: {
      dashboard: true, patient_form: true, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: false, kc_registry: true, clinical_media: true, database: false, user_admin: false
    },
    technician: {
      dashboard: true, patient_form: true, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: false, kc_registry: true, clinical_media: true, database: false, user_admin: false
    },
    receptionist: {
      dashboard: true, patient_form: false, records: true, audit_trail: true, patient_flow: true,
      keratoplasty: false, kc_registry: false, clinical_media: false, database: false, user_admin: false
    }
  });

  const ALL_PERMS = Object.values(PERMISSIONS);
  const CLINICAL = ALL_PERMS.filter((p) => p !== PERMISSIONS.USERS_MANAGE && !p.startsWith('database:'));
  const ROLE_PERMISSIONS = Object.freeze({
    administrator: ALL_PERMS,
    consultant: [...CLINICAL, PERMISSIONS.FLOW_MOVE, PERMISSIONS.FLOW_COMPLETE],
    resident: [...CLINICAL.filter((p) => p !== PERMISSIONS.VISITS_DELETE), PERMISSIONS.FLOW_MOVE, PERMISSIONS.FLOW_COMPLETE],
    nurse: [PERMISSIONS.VISITS_WRITE, PERMISSIONS.KP_WRITE, PERMISSIONS.FLOW_MOVE, PERMISSIONS.FLOW_COMPLETE],
    technician: [PERMISSIONS.VISITS_WRITE, PERMISSIONS.FLOW_MOVE],
    receptionist: [PERMISSIONS.FLOW_MOVE]
  });

  /** @type {object | null} */
  let currentUser = null;
  let idleTimer = null;
  let dbReady = false;

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uuid() {
    return crypto.randomUUID();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function tx(storeNames, mode = 'readonly') {
    return global.db.transaction(storeNames, mode);
  }

  function storeOp(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      if (!global.db) {
        reject(new Error('Database not ready'));
        return;
      }
      const request = fn(tx([storeName], mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function ensureUsersStore(db, event) {
    if (!db.objectStoreNames.contains(STORE_USERS)) {
      const users = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
      users.createIndex('username', 'username', { unique: true });
      users.createIndex('isActive', 'isActive', { unique: false });
    }
  }

  async function hashPassword(password, saltB64) {
    const enc = new TextEncoder();
    const salt = saltB64
      ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
      : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return {
      algorithm: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: btoa(String.fromCharCode(...salt)),
      hash
    };
  }

  async function verifyPassword(password, record) {
    if (!record?.salt || !record?.hash) return false;
    const derived = await hashPassword(password, record.salt);
    return derived.hash === record.hash;
  }

  function publicUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      fullName: row.fullName,
      role: row.role,
      roleLabel: ROLE_LABELS[row.role] || row.role,
      isActive: row.isActive !== false,
      mustChangePassword: !!row.mustChangePassword,
      lastLoginAt: row.lastLoginAt || null
    };
  }

  async function getUserByUsername(username) {
    const key = String(username || '').trim().toLowerCase();
    if (!key) return null;
    return storeOp(STORE_USERS, 'readonly', (s) => s.index('username').get(key));
  }

  async function getUserById(id) {
    if (!id) return null;
    return storeOp(STORE_USERS, 'readonly', (s) => s.get(id));
  }

  async function listUsers() {
    const rows = await storeOp(STORE_USERS, 'readonly', (s) => s.getAll());
    return (rows || []).map(publicUser).sort((a, b) =>
      (a.fullName || a.username).localeCompare(b.fullName || b.username)
    );
  }

  async function saveUser(row) {
    row.updatedAt = nowIso();
    await storeOp(STORE_USERS, 'readwrite', (s) => s.put(row));
    return publicUser(row);
  }

  async function ensureDefaultAdmin() {
    const count = await storeOp(STORE_USERS, 'readonly', (s) => s.count());
    if (count > 0) return null;
    const password = 'Admin@ChangeMe1';
    const passwordRecord = await hashPassword(password);
    const admin = {
      id: uuid(),
      username: 'admin',
      fullName: 'Administrator',
      role: 'administrator',
      password: passwordRecord,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    await saveUser(admin);
    return { username: 'admin', password };
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeSession(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      lastActivity: Date.now(),
      expiresAt: Date.now() + SESSION_TIMEOUT_MS
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isSessionValid(session) {
    if (!session?.userId || !session.expiresAt) return false;
    return Date.now() < session.expiresAt;
  }

  function touchSession() {
    const session = readSession();
    if (!session) return;
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    resetIdleTimer();
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!currentUser || global.__corneaCloudMode) return;
    idleTimer = setTimeout(() => {
      global.CorneaOfflineAuth.logout(true);
      alert('Your session expired due to inactivity. Please sign in again.');
    }, SESSION_TIMEOUT_MS);
  }

  function applyAccess(user) {
    currentUser = user;
    if (global.CorneaSections && user?.role) {
      global.CorneaSections.apply(ROLE_SECTIONS[user.role] || null);
    }
    updateTopbar(user);
    toggleAdminPanels();
    if (user?.role === 'administrator') {
      renderOfflineUsersAdmin();
    }
  }

  function updateTopbar(user) {
    const wrap = document.getElementById('corneaTopbarUser');
    const nameEl = document.getElementById('corneaTopbarUserName');
    if (!wrap || !nameEl) return;
    if (user && !global.__corneaCloudMode) {
      nameEl.textContent = user.fullName || user.username;
      wrap.style.display = 'flex';
    } else if (!global.__corneaCloudMode) {
      wrap.style.display = 'none';
    }
  }

  function toggleAdminPanels() {
    const cloudPanel = document.getElementById('adminUsersPanel');
    const offlinePanel = document.getElementById('offlineUsersPanel');
    const cloudOn = !!global.__corneaCloudMode;
    if (cloudPanel) cloudPanel.style.display = cloudOn ? '' : 'none';
    if (offlinePanel) offlinePanel.style.display = cloudOn ? 'none' : '';
  }

  function updateOfflineLoginCopy() {
    const subtitle = document.querySelector('#corneaOfflineLogin .cornea-offline-login-header p');
    if (global.CorneaAuthEnv?.isPublicDeployment?.() && global.CorneaAuthEnv?.isOfflineFallbackActive?.()) {
      if (subtitle) {
        subtitle.textContent = 'Clinic server offline — records stay on this device until cloud sync is available.';
      }
    } else if (subtitle) {
      subtitle.textContent = 'Offline sign in';
    }
  }

  function showApp(show) {
    if (show) {
      global.CorneaAuthEnv?.unlockUi?.();
    } else {
      global.CorneaAuthEnv?.lockUi?.();
    }
    const overlay = document.getElementById('corneaOfflineLogin');
    if (overlay) {
      overlay.classList.toggle('is-open', !show);
      overlay.setAttribute('aria-hidden', show ? 'true' : 'false');
    }
    if (show) {
      if (typeof global.updateDashboardStats === 'function') global.updateDashboardStats();
      if (typeof global.loadRecords === 'function') global.loadRecords();
    }
  }

  function ensureLoginUi() {
    if (document.getElementById('corneaOfflineLogin')) return;

    const style = document.createElement('style');
    style.textContent = `
      body.cornea-auth-pending .main-wrapper,
      body.cornea-auth-pending #sidebar,
      body.cornea-auth-pending .sidebar-overlay,
      body.cornea-auth-pending .topbar { visibility: hidden !important; pointer-events: none !important; }
      body.cornea-auth-pending #corneaCloudLoginModal.is-open,
      body.cornea-auth-pending #corneaPwChangeModal.is-open,
      body.cornea-auth-pending #corneaOfflineLogin.is-open {
        visibility: visible !important; pointer-events: auto !important;
      }
      #corneaOfflineLogin {
        position: fixed; inset: 0; z-index: 10000;
        display: none; align-items: center; justify-content: center;
        background: linear-gradient(145deg, #0d2137 0%, #1a3a5c 50%, #0f2840 100%);
        padding: 24px;
      }
      #corneaOfflineLogin.is-open { display: flex; }
      .cornea-offline-login-card {
        width: 100%; max-width: 420px;
        background: #fff; border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        overflow: hidden;
      }
      .cornea-offline-login-header {
        background: var(--primary-mid, #1565c0);
        color: #fff; padding: 24px; text-align: center;
      }
      .cornea-offline-login-header h1 { margin: 0 0 6px; font-size: 1.35rem; }
      .cornea-offline-login-body { padding: 24px; }
      .cornea-topbar-user {
        display: flex; align-items: center; gap: 10px;
        font-size: 0.85rem; color: var(--text-secondary, #5a6b7d);
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'corneaOfflineLogin';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cornea-offline-login-card" role="dialog" aria-modal="true" aria-labelledby="corneaOfflineLoginTitle">
        <div class="cornea-offline-login-header">
          <h1 id="corneaOfflineLoginTitle"><i class="fa-solid fa-eye"></i> Cornea Clinic</h1>
          <p style="margin:0;opacity:0.9;font-size:0.9rem;">Offline sign in</p>
        </div>
        <div class="cornea-offline-login-body">
          <p id="corneaOfflineBootstrapHint" class="form-hint" style="display:none;margin-bottom:12px;padding:10px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;"></p>
          <div class="form-group">
            <label for="corneaOfflineUsername">Username</label>
            <input type="text" id="corneaOfflineUsername" autocomplete="username" autocapitalize="off" />
          </div>
          <div class="form-group">
            <label for="corneaOfflinePassword">Password</label>
            <input type="password" id="corneaOfflinePassword" autocomplete="current-password" />
          </div>
          <p id="corneaOfflineLoginError" class="form-hint" style="color:var(--danger,#c62828);display:none;"></p>
          <p class="form-hint" style="font-size:0.8rem;margin-top:10px;line-height:1.45;">
            Offline accounts are stored only on this device. Your <strong>cloud email and password</strong> do not work here — use <strong>Cloud sign in instead</strong>.
          </p>
          <button type="button" class="btn-primary" id="corneaOfflineLoginBtn" style="width:100%;margin-top:8px;">
            <i class="fa-solid fa-right-to-bracket"></i> Sign in
          </button>
          <button type="button" class="btn-secondary btn-sm" id="corneaOfflineCloudBtn" style="width:100%;margin-top:10px;">
            <i class="fa-solid fa-cloud"></i> Cloud sign in instead
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('corneaOfflineLoginBtn')?.addEventListener('click', () => {
      submitLogin().catch((err) => showLoginError(err.message));
    });
    document.getElementById('corneaOfflinePassword')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitLogin().catch((err) => showLoginError(err.message));
    });
    document.getElementById('corneaOfflineCloudBtn')?.addEventListener('click', async () => {
      clearLoginError();
      const offline = document.getElementById('corneaOfflineLogin');
      if (offline) {
        offline.classList.remove('is-open');
        offline.style.display = 'none';
      }
      const openCloud = global.CorneaApiForceCloudSignIn || global.CorneaApi?.signIn;
      if (!openCloud) {
        showLoginError('Cloud sign-in is not available. Reload the page and try again.');
        if (offline) { offline.style.display = ''; offline.classList.add('is-open'); }
        return;
      }
      try {
        const ok = await openCloud();
        if (ok) {
          showApp(true);
        } else if (offline) {
          offline.style.display = '';
          offline.classList.add('is-open');
        }
      } catch (err) {
        showLoginError(err.message || 'Cloud sign-in failed');
        if (offline) { offline.style.display = ''; offline.classList.add('is-open'); }
      }
    });
    document.getElementById('corneaLogoutBtn')?.addEventListener('click', async () => {
      if (global.__corneaCloudMode && global.CorneaApi?.logout) {
        await global.CorneaApi.logout();
      } else {
        global.CorneaOfflineAuth.logout(false);
      }
    });
  }

  function showLoginError(msg) {
    const el = document.getElementById('corneaOfflineLoginError');
    if (el) {
      el.textContent = msg || 'Sign in failed';
      el.style.display = 'block';
    }
  }

  function clearLoginError() {
    const el = document.getElementById('corneaOfflineLoginError');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  async function submitLogin() {
    clearLoginError();
    const username = document.getElementById('corneaOfflineUsername')?.value.trim();
    const password = document.getElementById('corneaOfflinePassword')?.value;
    if (!username || !password) throw new Error('Username and password are required');
    await login(username, password);
  }

  async function login(username, password) {
    const row = await getUserByUsername(username);
    if (!row || row.isActive === false) {
      throw new Error('Invalid username or password');
    }
    const ok = await verifyPassword(password, row.password);
    if (!ok) throw new Error('Invalid username or password');

    row.lastLoginAt = nowIso();
    if (row.mustChangePassword) {
      await promptPasswordChange(row, password);
    } else {
      await saveUser(row);
    }

    const user = publicUser(row);
    writeSession(user);
    applyAccess(user);
    showApp(true);
    resetIdleTimer();

    if (row.mustChangePassword) {
      const refreshed = await getUserById(row.id);
      applyAccess(publicUser(refreshed));
    }
    return user;
  }

  async function promptPasswordChange(row, currentPassword) {
    const newPass = prompt(
      'You must set a new password before continuing.\nMinimum 8 characters with upper, lower, and a number.'
    );
    if (!newPass) throw new Error('Password change is required');
    validatePassword(newPass);
    if (newPass === currentPassword) throw new Error('New password must differ from the temporary password');
    row.password = await hashPassword(newPass);
    row.mustChangePassword = false;
    await saveUser(row);
  }

  function validatePassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must include upper case, lower case, and a number');
    }
  }

  async function restoreSession() {
    if (global.__corneaCloudMode) return true;
    const session = readSession();
    if (!isSessionValid(session)) {
      clearSession();
      return false;
    }
    const row = await getUserById(session.userId);
    if (!row || row.isActive === false) {
      clearSession();
      return false;
    }
    applyAccess(publicUser(row));
    showApp(true);
    resetIdleTimer();
    return true;
  }

  async function createUser({ username, fullName, role, password, isActive = true }) {
    requirePermission(PERMISSIONS.USERS_MANAGE);
    validatePassword(password);
    if (!ROLES.includes(role)) throw new Error('Invalid role');
    const key = String(username).trim().toLowerCase();
    if (!key || !fullName?.trim()) throw new Error('Username and full name are required');
    if (await getUserByUsername(key)) throw new Error('Username already exists');

    const row = {
      id: uuid(),
      username: key,
      fullName: fullName.trim(),
      role,
      password: await hashPassword(password),
      isActive: !!isActive,
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    return saveUser(row);
  }

  async function updateUser(id, patch) {
    requirePermission(PERMISSIONS.USERS_MANAGE);
    const row = await getUserById(id);
    if (!row) throw new Error('User not found');
    if (id === currentUser?.id && patch.isActive === false) {
      throw new Error('You cannot disable your own account');
    }
    if (id === currentUser?.id && patch.role && patch.role !== 'administrator') {
      throw new Error('You cannot remove your own administrator role');
    }
    if (patch.fullName != null) row.fullName = String(patch.fullName).trim();
    if (patch.role != null) {
      if (!ROLES.includes(patch.role)) throw new Error('Invalid role');
      row.role = patch.role;
    }
    if (patch.isActive != null) row.isActive = !!patch.isActive;
    if (patch.password) {
      validatePassword(patch.password);
      row.password = await hashPassword(patch.password);
      row.mustChangePassword = true;
    }
    const saved = await saveUser(row);
    if (id === currentUser?.id) applyAccess(saved);
    return saved;
  }

  function isAuthenticated() {
    if (global.__corneaCloudMode && global.CorneaApi?.isEnabled?.()) return true;
    return !!currentUser;
  }

  function requirePermission(permission) {
    if (!hasPermission(permission)) {
      throw new Error('You do not have permission for this action');
    }
  }

  function shouldEnforce() {
    return isAuthenticated() && !global.__corneaCloudMode;
  }

  function hasPermission(permission) {
    if (!isAuthenticated()) return false;
    if (global.__corneaCloudMode) return true;
    const perms = ROLE_PERMISSIONS[currentUser.role] || [];
    return perms.includes(permission);
  }

  function guard(permission, fn) {
    return function (...args) {
      if (!hasPermission(permission)) {
        alert('You do not have permission for this action.');
        return undefined;
      }
      return fn.apply(this, args);
    };
  }

  async function renderOfflineUsersAdmin() {
    const body = document.getElementById('offlineUsersTableBody');
    if (!body || global.__corneaCloudMode) return;
    try {
      const users = await listUsers();
      if (!users.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No users.</div></td></tr>';
        return;
      }
      body.innerHTML = users.map((u) => {
        const status = u.isActive
          ? '<span style="color:var(--success);">Active</span>'
          : '<span style="color:var(--danger);">Disabled</span>';
        const lastLogin = u.lastLoginAt
          ? new Date(u.lastLoginAt).toLocaleString()
          : 'Never';
        return `
          <tr>
            <td>${escapeHtml(u.fullName)}</td>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.roleLabel)}</td>
            <td>${status}</td>
            <td>${escapeHtml(lastLogin)}</td>
            <td class="no-print">
              <button type="button" class="btn-secondary btn-sm" data-offline-edit="${escapeHtml(u.id)}">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
            </td>
          </tr>`;
      }).join('');

      body.querySelectorAll('[data-offline-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openEditUserModal(btn.getAttribute('data-offline-edit')));
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  function ensureAdminModals() {
    if (document.getElementById('offlineUserCreateModal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="offlineUserCreateModal" class="emr-modal-overlay" aria-hidden="true">
        <div class="emr-modal emr-modal-sm" role="dialog" aria-modal="true">
          <div class="emr-modal-header"><h2><i class="fa-solid fa-user-plus"></i> Add offline user</h2></div>
          <div class="emr-modal-body">
            <div class="form-group"><label>Full name</label><input type="text" id="offlineCreateFullName" /></div>
            <div class="form-group"><label>Username</label><input type="text" id="offlineCreateUsername" autocapitalize="off" /></div>
            <div class="form-group"><label>Temporary password</label><input type="password" id="offlineCreatePassword" /></div>
            <div class="form-group"><label>Role</label><select id="offlineCreateRole"></select></div>
            <p id="offlineCreateError" class="form-hint" style="color:var(--danger);display:none;"></p>
          </div>
          <div class="emr-modal-footer">
            <button type="button" class="btn-secondary" onclick="closeEmrModal('offlineUserCreateModal')">Cancel</button>
            <button type="button" class="btn-primary" id="offlineCreateSaveBtn">Create</button>
          </div>
        </div>
      </div>
      <div id="offlineUserEditModal" class="emr-modal-overlay" aria-hidden="true">
        <div class="emr-modal emr-modal-sm" role="dialog" aria-modal="true">
          <div class="emr-modal-header"><h2><i class="fa-solid fa-user-gear"></i> Edit offline user</h2></div>
          <div class="emr-modal-body">
            <div class="form-group"><label>Full name</label><input type="text" id="offlineEditFullName" /></div>
            <div class="form-group"><label>Username</label><div id="offlineEditUsername" style="padding:8px 0;color:var(--text-secondary);"></div></div>
            <div class="form-group"><label>Role</label><select id="offlineEditRole"></select></div>
            <div class="form-group"><label><input type="checkbox" id="offlineEditActive" /> Active</label></div>
            <div class="form-group"><label>New password (optional)</label><input type="password" id="offlineEditPassword" placeholder="Leave blank to keep current" /></div>
            <p id="offlineEditError" class="form-hint" style="color:var(--danger);display:none;"></p>
          </div>
          <div class="emr-modal-footer">
            <button type="button" class="btn-secondary" onclick="closeEmrModal('offlineUserEditModal')">Cancel</button>
            <button type="button" class="btn-primary" id="offlineEditSaveBtn">Save</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const roleOptions = ROLES.map((r) =>
      `<option value="${r}">${escapeHtml(ROLE_LABELS[r])}</option>`
    ).join('');
    document.getElementById('offlineCreateRole').innerHTML = roleOptions;
    document.getElementById('offlineEditRole').innerHTML = roleOptions;

    document.getElementById('offlineUsersAddBtn')?.addEventListener('click', () => {
      document.getElementById('offlineCreateError').style.display = 'none';
      global.openEmrModal('offlineUserCreateModal');
    });

    document.getElementById('offlineCreateSaveBtn')?.addEventListener('click', async () => {
      const errEl = document.getElementById('offlineCreateError');
      errEl.style.display = 'none';
      try {
        await createUser({
          fullName: document.getElementById('offlineCreateFullName').value,
          username: document.getElementById('offlineCreateUsername').value,
          password: document.getElementById('offlineCreatePassword').value,
          role: document.getElementById('offlineCreateRole').value
        });
        global.closeEmrModal('offlineUserCreateModal');
        await renderOfflineUsersAdmin();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });

    document.getElementById('offlineEditSaveBtn')?.addEventListener('click', async () => {
      const errEl = document.getElementById('offlineEditError');
      errEl.style.display = 'none';
      try {
        const id = document.getElementById('offlineUserEditModal').dataset.userId;
        const patch = {
          fullName: document.getElementById('offlineEditFullName').value,
          role: document.getElementById('offlineEditRole').value,
          isActive: document.getElementById('offlineEditActive').checked
        };
        const pw = document.getElementById('offlineEditPassword').value;
        if (pw) patch.password = pw;
        await updateUser(id, patch);
        global.closeEmrModal('offlineUserEditModal');
        await renderOfflineUsersAdmin();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });
  }

  async function openEditUserModal(userId) {
    const user = await getUserById(userId);
    if (!user) return;
    document.getElementById('offlineUserEditModal').dataset.userId = userId;
    document.getElementById('offlineEditFullName').value = user.fullName || '';
    document.getElementById('offlineEditUsername').textContent = user.username;
    document.getElementById('offlineEditRole').value = user.role;
    document.getElementById('offlineEditActive').checked = user.isActive !== false;
    document.getElementById('offlineEditPassword').value = '';
    document.getElementById('offlineEditError').style.display = 'none';
    global.openEmrModal('offlineUserEditModal');
  }

  function bindActivityListeners() {
    ['click', 'keydown', 'mousemove', 'touchstart'].forEach((ev) => {
      document.addEventListener(ev, () => {
        if (currentUser && !global.__corneaCloudMode) touchSession();
      }, { passive: true });
    });
  }

  async function resetAdministratorPassword(plainPassword, username = 'admin') {
    validatePassword(plainPassword);
    const row = await getUserByUsername(username);
    if (!row) throw new Error(`User not found: ${username}`);
    if (row.role !== 'administrator') {
      throw new Error('Only administrator accounts can be reset with this tool');
    }
    row.password = await hashPassword(plainPassword);
    row.mustChangePassword = true;
    row.isActive = true;
    await saveUser(row);
    if (currentUser?.id === row.id) {
      currentUser = null;
      clearSession();
    }
    return { username: row.username, password: plainPassword };
  }

  global.CorneaOfflineAuth = {
    STORE_USERS,
    ROLES,
    ROLE_LABELS,
    PERMISSIONS,
    ROLE_SECTIONS,
    ensureUsersStore,

    async onDbReady() {
      if (global.CorneaAuthEnv?.isPublicDeployment?.() && !global.CorneaAuthEnv?.allowsOfflineAuth?.()) return;

      ensureLoginUi();
      ensureAdminModals();
      updateOfflineLoginCopy();
      if (!dbReady) {
        dbReady = true;
        bindActivityListeners();
        document.getElementById('offlineUsersRefreshBtn')?.addEventListener('click', () => {
          renderOfflineUsersAdmin();
        });
      }
      toggleAdminPanels();

      if (global.__corneaCloudMode) {
        showApp(true);
        return;
      }

      const bootstrap = await ensureDefaultAdmin();
      const hint = document.getElementById('corneaOfflineBootstrapHint');
      if (bootstrap && hint) {
        hint.style.display = 'block';
        hint.innerHTML = '<strong>First run:</strong> default account is <code>admin</code> / <code>Admin@ChangeMe1</code>. You will be asked to change the password on first sign-in.';
      }

      const restored = await restoreSession();
      if (!restored) {
        showApp(false);
        document.getElementById('corneaOfflineUsername')?.focus();
      }
    },

    async initAfterCloudCheck(cloudConnected) {
      if (cloudConnected || global.__corneaCloudMode) {
        currentUser = null;
        clearSession();
        showApp(true);
        updateTopbar(null);
        toggleAdminPanels();
        return;
      }

      if (global.CorneaAuthEnv?.isPublicDeployment?.()) {
        if (global.CorneaAuthEnv?.isOfflineFallbackActive?.()) {
          ensureLoginUi();
          updateOfflineLoginCopy();
          if (global.CorneaApi?.resolveBaseUrl) {
            try {
              const base = await global.CorneaApi.resolveBaseUrl();
              const health = await global.CorneaApi.probeHealth?.(base);
              if (health?.healthy) {
                global.CorneaAuthEnv?.clearOfflineFallback?.();
                const offline = document.getElementById('corneaOfflineLogin');
                if (offline) offline.style.display = 'none';
                if (global.CorneaApi.signIn) await global.CorneaApi.signIn();
              }
            } catch (_) { /* keep offline UI */ }
          }
          if (global.db) await this.onDbReady();
          return;
        }
        if (global.__corneaCloudMode) {
          showApp(true);
          return;
        }
        const cloudModal = document.getElementById('corneaCloudLoginModal');
        if (!cloudModal?.classList.contains('is-open')) {
          const openCloud = global.CorneaApiForceCloudSignIn || global.CorneaApi?.signIn;
          if (openCloud) await openCloud();
        }
        if (global.CorneaAuthEnv?.isOfflineFallbackActive?.() && global.db) {
          ensureLoginUi();
          updateOfflineLoginCopy();
          await this.onDbReady();
        }
        return;
      }

      if (global.db) await this.onDbReady();
    },

    login,
    logout(silent) {
      currentUser = null;
      clearSession();
      if (idleTimer) clearTimeout(idleTimer);
      if (global.__corneaCloudMode) return;
      if (global.CorneaSections) global.CorneaSections.apply(null);
      updateTopbar(null);
      if (!silent) {
        showApp(false);
        clearLoginError();
        const pass = document.getElementById('corneaOfflinePassword');
        if (pass) pass.value = '';
      }
    },

    getCurrentUser() { return currentUser; },
    isAuthenticated,
    shouldEnforce,
    hasPermission,
    requirePermission,
    guard,
    listUsers,
    createUser,
    updateUser,
    resetAdministratorPassword,
    renderOfflineUsersAdmin,
    touchSession
  };
})(typeof window !== 'undefined' ? window : globalThis);
