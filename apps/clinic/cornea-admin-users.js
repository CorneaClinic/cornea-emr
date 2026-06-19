/**
 * Admin UI — assign EMR sections per user (requires cloud sign-in + user_admin section).
 */
(function (global) {
  'use strict';

  let catalog = null;
  let users = [];
  let editingUserId = null;
  let initialized = false;

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

  function sectionSummary(emrSections) {
    if (!catalog?.sections || !emrSections) return '—';
    const enabled = catalog.sections
      .filter((s) => emrSections[s.id] !== false)
      .map((s) => s.label.split(' ')[0]);
    return enabled.length ? enabled.join(', ') : 'None';
  }

  function renderUserTable() {
    const body = document.getElementById('adminUsersTableBody');
    if (!body) return;

    if (!users.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No users found.</div></td></tr>';
      return;
    }

    body.innerHTML = users.map((u) => {
      const overrideNote = u.emrSectionOverride ? 'Custom' : 'Role default';
      const status = u.isActive
        ? '<span style="color:var(--success);">Active</span>'
        : '<span style="color:var(--danger);">Inactive</span>';
      const isSelf = global.__corneaUser?.id === u.id;
      const deleteBtn = isSelf
        ? ''
        : `<button type="button" class="btn-danger btn-sm" data-admin-delete="${escapeHtml(u.id)}" title="Permanently delete this user">
              <i class="fa-solid fa-trash"></i> Delete
            </button>`;
      return `
        <tr>
          <td>${escapeHtml(u.fullName)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.roleLabel || u.role)}</td>
          <td>${status}</td>
          <td title="${escapeHtml(sectionSummary(u.emrSections))}">${escapeHtml(overrideNote)}</td>
          <td class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary btn-sm" data-admin-edit="${escapeHtml(u.id)}">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
            ${deleteBtn}
          </td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-admin-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-admin-edit')));
    });
    body.querySelectorAll('[data-admin-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-admin-delete')));
    });
  }

  function buildSectionCheckboxes(container, selectedSections, roleDefaults) {
    if (!catalog?.sections) return;
    container.innerHTML = catalog.sections.map((s) => {
      const checked = selectedSections[s.id] !== false;
      const def = roleDefaults?.[s.id] !== false;
      return `
        <label class="admin-section-check" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <input type="checkbox" data-section-id="${escapeHtml(s.id)}" ${checked ? 'checked' : ''} />
          <span>
            <strong>${escapeHtml(s.label)}</strong>
            <span style="display:block;font-size:0.8rem;color:var(--text-secondary);">
              Role default: ${def ? 'Visible' : 'Hidden'}
            </span>
          </span>
        </label>`;
    }).join('');
  }

  function readSectionCheckboxes(container) {
    const out = {};
    container.querySelectorAll('[data-section-id]').forEach((cb) => {
      out[cb.getAttribute('data-section-id')] = cb.checked;
    });
    return out;
  }

  function openEditModal(userId) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    editingUserId = userId;

    const modal = document.getElementById('adminUserEditModal');
    document.getElementById('adminEditFullName').value = user.fullName || '';
    document.getElementById('adminEditEmail').textContent = user.email || '';
    document.getElementById('adminEditRole').value = user.role || '';
    document.getElementById('adminEditActive').checked = !!user.isActive;
    document.getElementById('adminEditUseDefaults').checked = !user.emrSectionOverride;

    const roleDefaults = catalog?.roleDefaults?.[user.role] || {};
    buildSectionCheckboxes(
      document.getElementById('adminEditSections'),
      user.emrSections,
      roleDefaults
    );
    toggleSectionInputs(!user.emrSectionOverride);

    document.getElementById('adminEditError').style.display = 'none';
    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('adminUserEditModal');
    } else {
      modal.classList.add('is-open');
    }
  }

  function openCreateModal() {
    editingUserId = null;
    document.getElementById('adminCreateFullName').value = '';
    document.getElementById('adminCreateEmail').value = '';
    document.getElementById('adminCreatePassword').value = '';
    document.getElementById('adminCreateRole').value = 'receptionist';
    document.getElementById('adminCreateUseDefaults').checked = true;

    const role = document.getElementById('adminCreateRole').value;
    const roleDefaults = catalog?.roleDefaults?.[role] || {};
    buildSectionCheckboxes(
      document.getElementById('adminCreateSections'),
      roleDefaults,
      roleDefaults
    );
    toggleCreateSectionInputs(true);
    document.getElementById('adminCreateError').style.display = 'none';

    if (typeof global.openEmrModal === 'function') {
      global.openEmrModal('adminUserCreateModal');
    }
  }

  function toggleSectionInputs(disabled) {
    document.getElementById('adminEditSections').querySelectorAll('input').forEach((el) => {
      el.disabled = disabled;
    });
  }

  function toggleCreateSectionInputs(disabled) {
    document.getElementById('adminCreateSections').querySelectorAll('input').forEach((el) => {
      el.disabled = disabled;
    });
  }

  async function loadData() {
    const panel = document.getElementById('adminUsersPanel');
    if (!panel || panel.classList.contains('emr-section-hidden')) return;

    const status = document.getElementById('adminUsersStatus');
    if (status) status.textContent = 'Loading…';

    try {
      catalog = await api('/api/v1/admin/users/sections');
      const data = await api('/api/v1/admin/users');
      users = data.users || [];
      renderUserTable();
      if (status) status.textContent = `${users.length} user(s)`;
    } catch (err) {
      if (status) status.textContent = '';
      console.warn('[CorneaAdminUsers]', err.message);
    }
  }

  async function saveEdit() {
    const errEl = document.getElementById('adminEditError');
    errEl.style.display = 'none';

    const useDefaults = document.getElementById('adminEditUseDefaults').checked;
    const body = {
      fullName: document.getElementById('adminEditFullName').value.trim(),
      role: document.getElementById('adminEditRole').value,
      isActive: document.getElementById('adminEditActive').checked
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
      const idx = users.findIndex((u) => u.id === editingUserId);
      if (idx >= 0) users[idx] = result.user;
      renderUserTable();

      if (global.__corneaUser?.id === editingUserId && global.CorneaSections) {
        global.__corneaUser = result.user;
        global.CorneaSections.apply(result.user.emrSections);
      }

      if (typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserEditModal');
      }
    } catch (err) {
      errEl.textContent = err.message || 'Save failed';
      errEl.style.display = 'block';
    }
  }

  async function deleteUser(userId) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (global.__corneaUser?.id === userId) {
      alert('You cannot delete your own account.');
      return;
    }

    const label = user.fullName || user.email || 'this user';
    if (!confirm(`Permanently delete ${label}?\n\nTheir cloud sign-in will stop working. Patient records they created remain in the clinic.`)) {
      return;
    }

    try {
      await api(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
      users = users.filter((u) => u.id !== userId);
      renderUserTable();
      const status = document.getElementById('adminUsersStatus');
      if (status) status.textContent = `${users.length} user(s)`;
      if (editingUserId === userId && typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserEditModal');
        editingUserId = null;
      }
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  }

  async function saveCreate() {
    const errEl = document.getElementById('adminCreateError');
    errEl.style.display = 'none';

    const useDefaults = document.getElementById('adminCreateUseDefaults').checked;
    const body = {
      fullName: document.getElementById('adminCreateFullName').value.trim(),
      email: document.getElementById('adminCreateEmail').value.trim(),
      password: document.getElementById('adminCreatePassword').value,
      role: document.getElementById('adminCreateRole').value
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
      document.getElementById('adminUsersStatus').textContent = `${users.length} user(s)`;
      if (typeof global.closeEmrModal === 'function') {
        global.closeEmrModal('adminUserCreateModal');
      }
    } catch (err) {
      errEl.textContent = err.message || 'Create failed';
      errEl.style.display = 'block';
    }
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;

    document.getElementById('adminUsersRefreshBtn')?.addEventListener('click', () => loadData());
    document.getElementById('adminUsersAddBtn')?.addEventListener('click', () => openCreateModal());
    document.getElementById('adminEditSaveBtn')?.addEventListener('click', () => saveEdit());
    document.getElementById('adminCreateSaveBtn')?.addEventListener('click', () => saveCreate());

    document.getElementById('adminEditUseDefaults')?.addEventListener('change', (e) => {
      toggleSectionInputs(e.target.checked);
    });

    document.getElementById('adminCreateUseDefaults')?.addEventListener('change', (e) => {
      toggleCreateSectionInputs(e.target.checked);
    });

    document.getElementById('adminCreateRole')?.addEventListener('change', (e) => {
      const roleDefaults = catalog?.roleDefaults?.[e.target.value] || {};
      buildSectionCheckboxes(
        document.getElementById('adminCreateSections'),
        roleDefaults,
        roleDefaults
      );
      toggleCreateSectionInputs(document.getElementById('adminCreateUseDefaults').checked);
    });

    document.getElementById('adminEditRole')?.addEventListener('change', (e) => {
      const user = users.find((u) => u.id === editingUserId);
      if (!user || user.emrSectionOverride) return;
      const roleDefaults = catalog?.roleDefaults?.[e.target.value] || {};
      buildSectionCheckboxes(
        document.getElementById('adminEditSections'),
        roleDefaults,
        roleDefaults
      );
    });
  }

  function ensureModals() {
    if (document.getElementById('adminUserEditModal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="adminUserEditModal" class="emr-modal-overlay" aria-hidden="true">
        <div class="emr-modal" role="dialog" aria-modal="true" aria-labelledby="adminUserEditTitle">
          <div class="emr-modal-header">
            <h2 id="adminUserEditTitle"><i class="fa-solid fa-user-gear"></i> Edit User</h2>
          </div>
          <div class="emr-modal-body">
            <div class="form-group"><label for="adminEditFullName">Full name</label>
              <input type="text" id="adminEditFullName" /></div>
            <div class="form-group"><label>Email</label>
              <div id="adminEditEmail" style="padding:8px 0;color:var(--text-secondary);"></div></div>
            <div class="form-group"><label for="adminEditRole">Role</label>
              <select id="adminEditRole"></select></div>
            <div class="form-group">
              <label><input type="checkbox" id="adminEditActive" /> Active account</label>
            </div>
            <div class="form-group">
              <label><input type="checkbox" id="adminEditUseDefaults" checked /> Use role default sections</label>
            </div>
            <fieldset id="adminEditSections" style="border:1px solid var(--emr-border);border-radius:var(--radius);padding:12px;margin:0;">
              <legend style="padding:0 6px;">EMR sections visible to this user</legend>
            </fieldset>
            <p id="adminEditError" class="form-hint" style="color:var(--danger);display:none;margin-top:10px;"></p>
          </div>
          <div class="emr-modal-footer">
            <button type="button" class="btn-secondary" onclick="closeEmrModal('adminUserEditModal')">Cancel</button>
            <button type="button" class="btn-primary" id="adminEditSaveBtn">Save changes</button>
          </div>
        </div>
      </div>
      <div id="adminUserCreateModal" class="emr-modal-overlay" aria-hidden="true">
        <div class="emr-modal" role="dialog" aria-modal="true" aria-labelledby="adminUserCreateTitle">
          <div class="emr-modal-header">
            <h2 id="adminUserCreateTitle"><i class="fa-solid fa-user-plus"></i> Add User</h2>
          </div>
          <div class="emr-modal-body">
            <div class="form-group"><label for="adminCreateFullName">Full name</label>
              <input type="text" id="adminCreateFullName" /></div>
            <div class="form-group"><label for="adminCreateEmail">Email</label>
              <input type="email" id="adminCreateEmail" autocomplete="off" /></div>
            <div class="form-group"><label for="adminCreatePassword">Temporary password</label>
              <input type="password" id="adminCreatePassword" autocomplete="new-password" /></div>
            <div class="form-group"><label for="adminCreateRole">Role</label>
              <select id="adminCreateRole"></select></div>
            <div class="form-group">
              <label><input type="checkbox" id="adminCreateUseDefaults" checked /> Use role default sections</label>
            </div>
            <fieldset id="adminCreateSections" style="border:1px solid var(--emr-border);border-radius:var(--radius);padding:12px;margin:0;">
              <legend style="padding:0 6px;">EMR sections</legend>
            </fieldset>
            <p id="adminCreateError" class="form-hint" style="color:var(--danger);display:none;margin-top:10px;"></p>
          </div>
          <div class="emr-modal-footer">
            <button type="button" class="btn-secondary" onclick="closeEmrModal('adminUserCreateModal')">Cancel</button>
            <button type="button" class="btn-primary" id="adminCreateSaveBtn">Create user</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  function populateRoleSelects() {
    if (!catalog?.roles) return;
    const options = catalog.roles.map((r) =>
      `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`
    ).join('');
    ['adminEditRole', 'adminCreateRole'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = options;
    });
  }

  global.CorneaAdminUsers = {
    async init() {
      if (!global.__corneaCloudMode) return;
      ensureModals();
      bindEvents();
      try {
        if (!catalog) catalog = await api('/api/v1/admin/users/sections');
        populateRoleSelects();
        await loadData();
      } catch (err) {
        console.warn('[CorneaAdminUsers] init skipped:', err.message);
      }
    },
    refresh: loadData
  };
})(typeof window !== 'undefined' ? window : globalThis);
