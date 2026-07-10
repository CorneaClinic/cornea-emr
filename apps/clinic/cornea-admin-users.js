/**
 * Admin UI — assign EMR sections per user (requires cloud sign-in + user_admin section).
 * CSP-safe: no inline styles / onclick (style-src-attr 'none', script-src strict).
 */
(function (global) {
  'use strict';

  let catalog = null;
  let users = [];
  let editingUserId = null;
  let initialized = false;
  let eventsBound = false;
  let showInactive = false;

  function api(path, options = {}) {
    if (!global.CorneaApi?.request) {
      return Promise.reject(new Error('Cloud API not available'));
    }
    return global.CorneaApi.request(path, options);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setError(el, message) {
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
      el.classList.add('is-visible');
    } else {
      el.textContent = '';
      el.hidden = true;
      el.classList.remove('is-visible');
    }
  }

  function sectionSummary(emrSections) {
    if (!catalog?.sections || !emrSections) return '—';
    const enabled = catalog.sections
      .filter((s) => emrSections[s.id] !== false)
      .map((s) => s.label.split(' ')[0]);
    return enabled.length ? enabled.join(', ') : 'None';
  }

  function switchEditTab(tabId) {
    const modal = document.getElementById('adminUserEditModal');
    if (!modal) return;
    modal.querySelectorAll('[data-admin-edit-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-admin-edit-tab') === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-admin-edit-panel]').forEach((panel) => {
      const show = panel.getAttribute('data-admin-edit-panel') === tabId;
      panel.hidden = !show;
    });
  }

  function visibleUsers() {
    if (showInactive) return users;
    return users.filter((u) => u.isActive !== false);
  }

  function renderUserTable() {
    const body = document.getElementById('adminUsersTableBody');
    if (!body) return;

    const list = visibleUsers();
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6"><div class="empty-state">${
        users.length ? 'No active users. Turn on “Show inactive” to see deactivated accounts.' : 'No users found.'
      }</div></td></tr>`;
      return;
    }

    body.innerHTML = list.map((u) => {
      const overrideNote = u.emrSectionOverride ? 'Custom' : 'Role default';
      const status = u.isActive
        ? '<span class="admin-user-status admin-user-status-active">Active</span>'
        : '<span class="admin-user-status admin-user-status-inactive">Inactive</span>';
      const isSelf = String(global.__corneaUser?.id || '') === String(u.id);
      const deleteBtn = isSelf
        ? ''
        : `<button type="button" class="btn-danger btn-sm" data-admin-delete="${escapeHtml(u.id)}" title="Permanently delete this user">
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
            </button>`;
      return `
        <tr>
          <td>${escapeHtml(u.fullName)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.roleLabel || u.role)}</td>
          <td>${status}</td>
          <td title="${escapeHtml(sectionSummary(u.emrSections))}">${escapeHtml(overrideNote)}</td>
          <td class="no-print admin-user-actions">
            <button type="button" class="btn-secondary btn-sm" data-admin-edit="${escapeHtml(u.id)}">
              <i class="fa-solid fa-pen" aria-hidden="true"></i> Edit
            </button>
            ${deleteBtn}
          </td>
        </tr>`;
    }).join('');
  }

  function buildSectionCheckboxes(container, selectedSections, roleDefaults) {
    if (!container || !catalog?.sections) return;
    container.innerHTML = catalog.sections.map((s) => {
      const checked = selectedSections[s.id] !== false;
      const def = roleDefaults?.[s.id] !== false;
      return `
        <label class="admin-section-check">
          <input type="checkbox" data-section-id="${escapeHtml(s.id)}" ${checked ? 'checked' : ''} />
          <span>
            <strong>${escapeHtml(s.label)}</strong>
            <span class="admin-section-default">
              Role default: ${def ? 'Visible' : 'Hidden'}
            </span>
          </span>
        </label>`;
    }).join('');
  }

  function readSectionCheckboxes(container) {
    const out = {};
    if (!container) return out;
    container.querySelectorAll('[data-section-id]').forEach((cb) => {
      out[cb.getAttribute('data-section-id')] = cb.checked;
    });
    return out;
  }

  function openEditModal(userId) {
    ensureModals();
    bindEvents();
    populateRoleSelects();

    const user = users.find((u) => String(u.id) === String(userId));
    if (!user) return;
    editingUserId = user.id;

    const fullNameEl = document.getElementById('adminEditFullName');
    const emailEl = document.getElementById('adminEditEmail');
    const roleEl = document.getElementById('adminEditRole');
    const activeEl = document.getElementById('adminEditActive');
    const defaultsEl = document.getElementById('adminEditUseDefaults');
    const sectionsEl = document.getElementById('adminEditSections');
    const deleteBtn = document.getElementById('adminEditDeleteBtn');

    if (!fullNameEl || !roleEl || !sectionsEl) {
      console.warn('[CorneaAdminUsers] Edit modal markup missing');
      return;
    }

    fullNameEl.value = user.fullName || '';
    if (emailEl) emailEl.textContent = user.email || '';
    roleEl.value = user.role || '';
    if (activeEl) activeEl.checked = !!user.isActive;
    if (defaultsEl) defaultsEl.checked = !user.emrSectionOverride;

    const roleDefaults = catalog?.roleDefaults?.[user.role] || {};
    buildSectionCheckboxes(sectionsEl, user.emrSections || roleDefaults, roleDefaults);
    toggleSectionInputs(!!defaultsEl?.checked);

    const isSelf = String(global.__corneaUser?.id || '') === String(user.id);
    if (deleteBtn) {
      deleteBtn.hidden = isSelf;
      deleteBtn.disabled = isSelf;
    }

    setError(document.getElementById('adminEditError'), '');
    switchEditTab('profile');

    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('adminUserEditModal');
    } else {
      document.getElementById('adminUserEditModal')?.classList.add('is-open');
    }
  }

  function openCreateModal() {
    ensureModals();
    bindEvents();
    populateRoleSelects();
    editingUserId = null;

    const nameEl = document.getElementById('adminCreateFullName');
    const emailEl = document.getElementById('adminCreateEmail');
    const passEl = document.getElementById('adminCreatePassword');
    const roleEl = document.getElementById('adminCreateRole');
    const defaultsEl = document.getElementById('adminCreateUseDefaults');
    if (nameEl) nameEl.value = '';
    if (emailEl) emailEl.value = '';
    if (passEl) passEl.value = '';
    if (roleEl) roleEl.value = 'receptionist';
    if (defaultsEl) defaultsEl.checked = true;

    const role = roleEl?.value || 'receptionist';
    const roleDefaults = catalog?.roleDefaults?.[role] || {};
    buildSectionCheckboxes(
      document.getElementById('adminCreateSections'),
      roleDefaults,
      roleDefaults
    );
    toggleCreateSectionInputs(true);
    setError(document.getElementById('adminCreateError'), '');
    switchCreateTab('profile');

    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('adminUserCreateModal');
    }
  }

  function switchCreateTab(tabId) {
    const modal = document.getElementById('adminUserCreateModal');
    if (!modal) return;
    modal.querySelectorAll('[data-admin-create-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-admin-create-tab') === tabId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-admin-create-panel]').forEach((panel) => {
      panel.hidden = panel.getAttribute('data-admin-create-panel') !== tabId;
    });
  }

  function toggleSectionInputs(disabled) {
    const host = document.getElementById('adminEditSections');
    host?.querySelectorAll('input').forEach((el) => {
      el.disabled = disabled;
    });
    host?.classList.toggle('is-disabled', disabled);
  }

  function toggleCreateSectionInputs(disabled) {
    const host = document.getElementById('adminCreateSections');
    host?.querySelectorAll('input').forEach((el) => {
      el.disabled = disabled;
    });
    host?.classList.toggle('is-disabled', disabled);
  }

  async function loadData() {
    ensureModals();
    bindEvents();

    const panel = document.getElementById('adminUsersPanel');
    if (!panel || panel.classList.contains('emr-section-hidden')) return;

    const status = document.getElementById('adminUsersStatus');
    if (status) status.textContent = 'Loading…';

    try {
      catalog = await api('/api/v1/admin/users/sections');
      populateRoleSelects();
      const data = await api('/api/v1/admin/users');
      users = data.users || [];
      renderUserTable();
      const activeCount = users.filter((u) => u.isActive !== false).length;
      if (status) {
        status.textContent = showInactive
          ? `${users.length} user(s)`
          : `${activeCount} active user(s)` + (users.length > activeCount ? ` · ${users.length - activeCount} inactive hidden` : '');
      }
    } catch (err) {
      if (status) status.textContent = err.message || 'Failed to load users';
      console.warn('[CorneaAdminUsers]', err.message);
    }
  }

  async function saveEdit() {
    const errEl = document.getElementById('adminEditError');
    setError(errEl, '');

    if (!editingUserId) {
      setError(errEl, 'No user selected.');
      return;
    }

    const useDefaults = document.getElementById('adminEditUseDefaults')?.checked;
    const body = {
      fullName: document.getElementById('adminEditFullName')?.value.trim(),
      role: document.getElementById('adminEditRole')?.value,
      isActive: !!document.getElementById('adminEditActive')?.checked
    };

    if (useDefaults) {
      body.resetEmrSections = true;
    } else {
      body.emrSections = readSectionCheckboxes(document.getElementById('adminEditSections'));
    }

    try {
      const result = await api(`/api/v1/admin/users/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      const idx = users.findIndex((u) => String(u.id) === String(editingUserId));
      if (idx >= 0) users[idx] = result.user;
      renderUserTable();

      if (String(global.__corneaUser?.id) === String(editingUserId) && global.CorneaSections) {
        global.__corneaUser = result.user;
        global.CorneaSections.apply(result.user.emrSections);
      }

      if (typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserEditModal');
      }
    } catch (err) {
      setError(errEl, err.message || 'Save failed');
      switchEditTab('profile');
    }
  }

  async function deleteUser(userId) {
    const id = String(userId || '');
    const user = users.find((u) => String(u.id) === id);
    if (!user) return;
    if (String(global.__corneaUser?.id || '') === id) {
      alert('You cannot delete your own account.');
      return;
    }

    const label = user.fullName || user.email || 'this user';
    if (!window.confirm(`Permanently delete ${label}?\n\nTheir cloud sign-in will stop working. Patient records they created remain in the clinic.`)) {
      return;
    }

    const status = document.getElementById('adminUsersStatus');
    const errEl = document.getElementById('adminEditError');
    try {
      if (status) status.textContent = 'Deleting…';
      const result = await api(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });

      // Always re-fetch from server so the table matches the database.
      await loadData();

      const stillThere = users.some((u) => String(u.id) === id && u.isActive !== false);
      if (stillThere) {
        const msg = 'Delete did not remove the active account. Try again or deactivate the user.';
        if (status) status.textContent = msg;
        alert(msg);
        setError(errEl, msg);
        return;
      }

      if (String(editingUserId) === id && typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserEditModal');
        editingUserId = null;
      }

      const note = result?.deactivated
        ? `Deactivated ${label} (could not hard-delete due to linked records).`
        : `Deleted ${label}.`;
      if (status) status.textContent = note;
    } catch (err) {
      let msg = err.message || 'Delete failed';
      if (/internal server error/i.test(msg)) {
        msg = 'Server could not delete this user (linked records). Try again after the API update, or deactivate the user instead.';
      }
      if (status) status.textContent = msg;
      alert(msg);
      setError(errEl, msg);
      await loadData().catch(() => {});
    }
  }

  async function saveCreate() {
    const errEl = document.getElementById('adminCreateError');
    setError(errEl, '');

    const useDefaults = document.getElementById('adminCreateUseDefaults')?.checked;
    const body = {
      fullName: document.getElementById('adminCreateFullName')?.value.trim(),
      email: document.getElementById('adminCreateEmail')?.value.trim(),
      password: document.getElementById('adminCreatePassword')?.value,
      role: document.getElementById('adminCreateRole')?.value
    };

    if (!useDefaults) {
      body.emrSections = readSectionCheckboxes(document.getElementById('adminCreateSections'));
    }

    try {
      const result = await api('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      users.push(result.user);
      renderUserTable();
      const status = document.getElementById('adminUsersStatus');
      if (status) status.textContent = `${users.length} user(s)`;
      if (typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserCreateModal');
      }
    } catch (err) {
      setError(errEl, err.message || 'Create failed');
      switchCreateTab('profile');
    }
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    document.getElementById('adminUsersRefreshBtn')?.addEventListener('click', () => loadData());
    document.getElementById('adminUsersAddBtn')?.addEventListener('click', () => openCreateModal());
    document.getElementById('adminUsersShowInactive')?.addEventListener('change', (e) => {
      showInactive = !!e.target.checked;
      renderUserTable();
      const activeCount = users.filter((u) => u.isActive !== false).length;
      const status = document.getElementById('adminUsersStatus');
      if (status) {
        status.textContent = showInactive
          ? `${users.length} user(s)`
          : `${activeCount} active user(s)` + (users.length > activeCount ? ` · ${users.length - activeCount} inactive hidden` : '');
      }
    });
    document.getElementById('adminEditSaveBtn')?.addEventListener('click', () => saveEdit());
    document.getElementById('adminCreateSaveBtn')?.addEventListener('click', () => saveCreate());
    document.getElementById('adminEditDeleteBtn')?.addEventListener('click', () => {
      if (editingUserId) deleteUser(editingUserId);
    });

    document.getElementById('adminEditUseDefaults')?.addEventListener('change', (e) => {
      toggleSectionInputs(e.target.checked);
      if (!e.target.checked) switchEditTab('sections');
    });

    document.getElementById('adminCreateUseDefaults')?.addEventListener('change', (e) => {
      toggleCreateSectionInputs(e.target.checked);
      if (!e.target.checked) switchCreateTab('sections');
    });

    document.getElementById('adminCreateRole')?.addEventListener('change', (e) => {
      const roleDefaults = catalog?.roleDefaults?.[e.target.value] || {};
      buildSectionCheckboxes(
        document.getElementById('adminCreateSections'),
        roleDefaults,
        roleDefaults
      );
      toggleCreateSectionInputs(!!document.getElementById('adminCreateUseDefaults')?.checked);
    });

    document.getElementById('adminEditRole')?.addEventListener('change', (e) => {
      const user = users.find((u) => String(u.id) === String(editingUserId));
      if (!user || user.emrSectionOverride) return;
      const roleDefaults = catalog?.roleDefaults?.[e.target.value] || {};
      buildSectionCheckboxes(
        document.getElementById('adminEditSections'),
        roleDefaults,
        roleDefaults
      );
      toggleSectionInputs(!!document.getElementById('adminEditUseDefaults')?.checked);
    });

    document.getElementById('adminUserEditModal')?.addEventListener('click', (e) => {
      const tabBtn = e.target.closest?.('[data-admin-edit-tab]');
      if (tabBtn) {
        e.preventDefault();
        switchEditTab(tabBtn.getAttribute('data-admin-edit-tab'));
      }
    });

    document.getElementById('adminUserCreateModal')?.addEventListener('click', (e) => {
      const tabBtn = e.target.closest?.('[data-admin-create-tab]');
      if (tabBtn) {
        e.preventDefault();
        switchCreateTab(tabBtn.getAttribute('data-admin-create-tab'));
      }
    });

    // Event delegation so Edit/Delete keep working after every table re-render
    document.getElementById('adminUsersTableBody')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest?.('[data-admin-edit]');
      if (editBtn) {
        e.preventDefault();
        openEditModal(editBtn.getAttribute('data-admin-edit'));
        return;
      }
      const delBtn = e.target.closest?.('[data-admin-delete]');
      if (delBtn) {
        e.preventDefault();
        deleteUser(delBtn.getAttribute('data-admin-delete'));
      }
    });
  }

  function ensureModals() {
    if (document.getElementById('adminUserEditModal')) return;

    const edit = document.createElement('div');
    edit.id = 'adminUserEditModal';
    edit.className = 'emr-modal-overlay';
    edit.setAttribute('aria-hidden', 'true');
    edit.innerHTML = `
      <div class="emr-modal emr-modal-md" role="dialog" aria-modal="true" aria-labelledby="adminUserEditTitle">
        <div class="emr-modal-header">
          <h2 id="adminUserEditTitle"><i class="fa-solid fa-user-gear" aria-hidden="true"></i> Edit User</h2>
          <button type="button" class="emr-modal-close" data-csp-action="closeEmrModal" data-csp-args='["adminUserEditModal"]' aria-label="Close">&times;</button>
        </div>
        <div class="emr-modal-body">
          <div class="admin-user-tabs" role="tablist" aria-label="Edit user sections">
            <button type="button" class="admin-user-tab is-active" role="tab" aria-selected="true" data-admin-edit-tab="profile">Profile</button>
            <button type="button" class="admin-user-tab" role="tab" aria-selected="false" data-admin-edit-tab="sections">Section access</button>
          </div>
          <div data-admin-edit-panel="profile" role="tabpanel">
            <div class="form-group"><label for="adminEditFullName">Full name</label>
              <input type="text" id="adminEditFullName" autocomplete="name" /></div>
            <div class="form-group"><label>Email</label>
              <div id="adminEditEmail" class="admin-user-readonly"></div></div>
            <div class="form-group"><label for="adminEditRole">Role</label>
              <select id="adminEditRole"></select></div>
            <div class="form-group">
              <label class="admin-inline-check"><input type="checkbox" id="adminEditActive" /> Active account</label>
            </div>
          </div>
          <div data-admin-edit-panel="sections" role="tabpanel" hidden>
            <div class="form-group">
              <label class="admin-inline-check"><input type="checkbox" id="adminEditUseDefaults" checked /> Use role default sections</label>
            </div>
            <fieldset id="adminEditSections" class="admin-sections-fieldset">
              <legend>EMR sections visible to this user</legend>
            </fieldset>
          </div>
          <p id="adminEditError" class="form-hint admin-form-error" hidden></p>
        </div>
        <div class="emr-modal-footer">
          <button type="button" class="btn-danger" id="adminEditDeleteBtn">Delete user</button>
          <button type="button" class="btn-secondary" data-csp-action="closeEmrModal" data-csp-args='["adminUserEditModal"]'>Cancel</button>
          <button type="button" class="btn-primary" id="adminEditSaveBtn">Save changes</button>
        </div>
      </div>`;
    document.body.appendChild(edit);

    const create = document.createElement('div');
    create.id = 'adminUserCreateModal';
    create.className = 'emr-modal-overlay';
    create.setAttribute('aria-hidden', 'true');
    create.innerHTML = `
      <div class="emr-modal emr-modal-md" role="dialog" aria-modal="true" aria-labelledby="adminUserCreateTitle">
        <div class="emr-modal-header">
          <h2 id="adminUserCreateTitle"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Add User</h2>
          <button type="button" class="emr-modal-close" data-csp-action="closeEmrModal" data-csp-args='["adminUserCreateModal"]' aria-label="Close">&times;</button>
        </div>
        <div class="emr-modal-body">
          <div class="admin-user-tabs" role="tablist" aria-label="Create user sections">
            <button type="button" class="admin-user-tab is-active" role="tab" aria-selected="true" data-admin-create-tab="profile">Profile</button>
            <button type="button" class="admin-user-tab" role="tab" aria-selected="false" data-admin-create-tab="sections">Section access</button>
          </div>
          <div data-admin-create-panel="profile" role="tabpanel">
            <div class="form-group"><label for="adminCreateFullName">Full name</label>
              <input type="text" id="adminCreateFullName" autocomplete="name" /></div>
            <div class="form-group"><label for="adminCreateEmail">Email</label>
              <input type="email" id="adminCreateEmail" autocomplete="off" /></div>
            <div class="form-group"><label for="adminCreatePassword">Temporary password</label>
              <input type="password" id="adminCreatePassword" autocomplete="new-password" /></div>
            <div class="form-group"><label for="adminCreateRole">Role</label>
              <select id="adminCreateRole"></select></div>
          </div>
          <div data-admin-create-panel="sections" role="tabpanel" hidden>
            <div class="form-group">
              <label class="admin-inline-check"><input type="checkbox" id="adminCreateUseDefaults" checked /> Use role default sections</label>
            </div>
            <fieldset id="adminCreateSections" class="admin-sections-fieldset">
              <legend>EMR sections</legend>
            </fieldset>
          </div>
          <p id="adminCreateError" class="form-hint admin-form-error" hidden></p>
        </div>
        <div class="emr-modal-footer">
          <button type="button" class="btn-secondary" data-csp-action="closeEmrModal" data-csp-args='["adminUserCreateModal"]'>Cancel</button>
          <button type="button" class="btn-primary" id="adminCreateSaveBtn">Create user</button>
        </div>
      </div>`;
    document.body.appendChild(create);

    // Backdrop dismiss for dynamically created modals
    [edit, create].forEach((ov) => {
      ov.addEventListener('click', (e) => {
        if (e.target === ov && typeof global.closeEmrModal === 'function') {
          global.closeEmrModal(ov.id);
        }
      });
    });
  }

  function populateRoleSelects() {
    if (!catalog?.roles) return;
    const options = catalog.roles.map((r) =>
      `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`
    ).join('');
    ['adminEditRole', 'adminCreateRole'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const prev = el.value;
      el.innerHTML = options;
      if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
    });
  }

  async function init() {
    if (!global.__corneaCloudMode) return;
    initialized = true;
    ensureModals();
    bindEvents();
    try {
      if (!catalog) catalog = await api('/api/v1/admin/users/sections');
      populateRoleSelects();
      await loadData();
    } catch (err) {
      console.warn('[CorneaAdminUsers] init skipped:', err.message);
    }
  }

  global.CorneaAdminUsers = {
    init,
    refresh: loadData,
    openEditModal,
    deleteUser
  };
})(typeof window !== 'undefined' ? window : globalThis);
