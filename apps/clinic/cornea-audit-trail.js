/**
 * Cornea Clinic — append-only local audit trail (IndexedDB).
 * Hooks into existing save/delete/export/import paths without changing workflows.
 */
(function (global) {
  'use strict';

  const STORE_AUDIT = 'audit_logs';
  const MAX_VALUE_CHARS = 12000;
  const ACTIONS = Object.freeze(['create', 'edit', 'delete', 'restore', 'export']);

  let hooksInstalled = false;

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tx(storeNames, mode = 'readonly') {
    return global.db.transaction(storeNames, mode);
  }

  function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function truncateJson(value) {
    if (value == null) return null;
    let text;
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch (_) {
      text = String(value);
    }
    if (text.length <= MAX_VALUE_CHARS) return text;
    return text.slice(0, MAX_VALUE_CHARS) + '… [truncated]';
  }

  function visitSnapshot(record) {
    if (!record) return null;
    return {
      id: record.id ?? null,
      uuid: record.uuid ?? null,
      patientId: record.patientId ?? null,
      fullName: record.fullName ?? null,
      visitDate: record.visitDate ?? null,
      phone: record.phone ?? null,
      sex: record.sex ?? null,
      diagnosis: record.diagnosis ?? null,
      lastModified: record.lastModified ?? null
    };
  }

  function currentActor() {
    if (global.__corneaCloudMode && global.__corneaUser) {
      return {
        userId: global.__corneaUser.id || null,
        userName: global.__corneaUser.fullName || global.__corneaUser.email || 'Cloud user'
      };
    }
    const offline = global.CorneaOfflineAuth?.getCurrentUser?.();
    if (offline) {
      return {
        userId: offline.id,
        userName: offline.fullName || offline.username || 'Offline user'
      };
    }
    return { userId: null, userName: 'System' };
  }

  function canViewAudit() {
    if (global.__corneaCloudMode) {
      return global.__corneaUser?.role === 'admin';
    }
    const user = global.CorneaOfflineAuth?.getCurrentUser?.();
    return !user || user.role === 'administrator';
  }

  function ensureAuditStore(db) {
    if (!db.objectStoreNames.contains(STORE_AUDIT)) {
      const store = db.createObjectStore(STORE_AUDIT, { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('action', 'action', { unique: false });
      store.createIndex('patientId', 'patientId', { unique: false });
      store.createIndex('userName', 'userName', { unique: false });
      store.createIndex('date', 'date', { unique: false });
    }
  }

  /**
   * Append immutable audit entry. Rejects update/delete attempts on audit store externally.
   * @param {object} entry
   */
  async function appendLog(entry) {
    if (!global.db?.objectStoreNames.contains(STORE_AUDIT)) return null;

    const now = new Date();
    const actor = currentActor();
    const row = {
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      userId: actor.userId,
      userName: actor.userName,
      patientId: entry.patientId ?? null,
      patientName: entry.patientName ?? null,
      patientRecordId: entry.patientRecordId ?? null,
      action: entry.action,
      oldValue: truncateJson(entry.oldValue),
      newValue: truncateJson(entry.newValue),
      entityType: entry.entityType || 'patient_visit',
      meta: entry.meta || null
    };

    if (!ACTIONS.includes(row.action)) {
      console.warn('[CorneaAudit] Unknown action:', row.action);
    }

    const store = tx([STORE_AUDIT], 'readwrite').objectStore(STORE_AUDIT);
    return promisifyRequest(store.add(row));
  }

  async function logVisit({ action, oldRecord, newRecord, recordId }) {
    const patientId = newRecord?.patientId ?? oldRecord?.patientId ?? null;
    const patientName = newRecord?.fullName ?? oldRecord?.fullName ?? null;
    await appendLog({
      action,
      patientId,
      patientName,
      patientRecordId: recordId ?? newRecord?.id ?? oldRecord?.id ?? null,
      oldValue: visitSnapshot(oldRecord),
      newValue: visitSnapshot(newRecord),
      entityType: 'patient_visit'
    });
  }

  async function listLocalLogs(filters = {}) {
    if (!global.db?.objectStoreNames.contains(STORE_AUDIT)) return [];
    const store = tx([STORE_AUDIT], 'readonly').objectStore(STORE_AUDIT);
    const rows = await promisifyRequest(store.getAll());
    let list = rows.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    if (filters.action) list = list.filter((r) => r.action === filters.action);
    if (filters.userName) {
      const q = filters.userName.toLowerCase();
      list = list.filter((r) => (r.userName || '').toLowerCase().includes(q));
    }
    if (filters.patient) {
      const q = filters.patient.toLowerCase();
      list = list.filter((r) =>
        (r.patientId || '').toLowerCase().includes(q)
        || (r.patientName || '').toLowerCase().includes(q)
      );
    }
    if (filters.dateFrom) list = list.filter((r) => r.date >= filters.dateFrom);
    if (filters.dateTo) list = list.filter((r) => r.date <= filters.dateTo);

    const limit = filters.limit || 500;
    return list.slice(0, limit);
  }

  async function fetchCloudLogs(filters = {}) {
    if (!global.__corneaCloudMode || !global.CorneaApi?.request) return [];
    try {
      const params = new URLSearchParams();
      if (filters.action) {
        const apiAction = filters.action === 'edit' ? 'update' : filters.action;
        params.set('action', apiAction);
      }
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const data = await global.CorneaApi.request(
        `/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`
      );
      return (data.logs || []).map((row) => ({
        id: row.id,
        timestamp: row.createdAt,
        date: row.createdAt?.slice(0, 10),
        time: row.createdAt ? new Date(row.createdAt).toTimeString().slice(0, 8) : '',
        userId: row.userId,
        userName: row.userName || row.userEmail || 'Cloud user',
        patientId: row.patientId || row.entityId,
        patientName: row.patientName || null,
        patientRecordId: row.entityId,
        action: normalizeCloudAction(row.action),
        oldValue: row.oldValue,
        newValue: row.newValue,
        entityType: row.entityType,
        source: 'cloud'
      }));
    } catch (err) {
      console.warn('[CorneaAudit] Cloud logs unavailable:', err.message);
      return [];
    }
  }

  function normalizeCloudAction(action) {
    const map = {
      create: 'create',
      update: 'edit',
      delete: 'delete',
      restore: 'restore',
      export: 'export',
      upsert: 'edit',
      bulk_replace: 'edit'
    };
    return map[action] || action;
  }

  function parseDiffValues(diff) {
    if (!diff) return { oldValue: null, newValue: null };
    if (typeof diff === 'string') return { oldValue: null, newValue: diff };
    return {
      oldValue: diff.old ?? diff.before ?? diff.previous ?? null,
      newValue: diff.new ?? diff.after ?? diff
    };
  }

  async function listLogs(filters = {}) {
    const local = await listLocalLogs(filters);
    const cloud = canViewAudit() ? await fetchCloudLogs(filters) : [];
    const merged = [...local.map((r) => ({ ...r, source: 'local' })), ...cloud];
    merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return merged.slice(0, filters.limit || 500);
  }

  function formatValuePreview(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return escapeHtml(JSON.stringify(parsed, null, 2));
      } catch (_) {
        return escapeHtml(value);
      }
    }
    return escapeHtml(JSON.stringify(value, null, 2));
  }

  async function renderViewer() {
    const body = document.getElementById('auditLogTableBody');
    if (!body) return;

    if (!canViewAudit()) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty-state">Audit logs are available to administrators only.</div></td></tr>';
      return;
    }

    body.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading audit trail…</div></td></tr>';

    const filters = {
      action: document.getElementById('auditFilterAction')?.value || '',
      userName: document.getElementById('auditFilterUser')?.value.trim() || '',
      patient: document.getElementById('auditFilterPatient')?.value.trim() || '',
      dateFrom: document.getElementById('auditFilterDateFrom')?.value || '',
      dateTo: document.getElementById('auditFilterDateTo')?.value || '',
      limit: 500
    };

    const logs = await listLogs(filters);
    if (!logs.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty-state">No audit entries match your filters.</div></td></tr>';
      return;
    }

    body.innerHTML = logs.map((row, idx) => {
      const actionLabel = escapeHtml(row.action || '');
      const patientLabel = row.patientName
        ? `${escapeHtml(row.patientName)}${row.patientId ? ` (${escapeHtml(row.patientId)})` : ''}`
        : escapeHtml(row.patientId || '—');
      const detailId = `audit-detail-${idx}`;
      return `
        <tr>
          <td>${escapeHtml(row.date || '')}</td>
          <td>${escapeHtml(row.time || '')}</td>
          <td>${escapeHtml(row.userName || '—')}</td>
          <td>${patientLabel}</td>
          <td><span class="patient-id-badge">${actionLabel}</span></td>
          <td class="no-print">
            <button type="button" class="btn-secondary btn-sm" onclick="document.getElementById('${detailId}').classList.toggle('is-open')">
              <i class="fa-solid fa-eye"></i> Values
            </button>
          </td>
          <td style="font-size:0.75rem;color:var(--text-secondary);">${escapeHtml(row.source || 'local')}</td>
        </tr>
        <tr id="${detailId}" class="audit-detail-row">
          <td colspan="7">
            <div class="audit-detail-grid">
              <div><strong>Old value</strong><pre class="audit-value-pre">${formatValuePreview(row.oldValue)}</pre></div>
              <div><strong>New value</strong><pre class="audit-value-pre">${formatValuePreview(row.newValue)}</pre></div>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function ensureViewerStyles() {
    if (document.getElementById('corneaAuditStyles')) return;
    const style = document.createElement('style');
    style.id = 'corneaAuditStyles';
    style.textContent = `
      .audit-detail-row { display: none; }
      .audit-detail-row.is-open { display: table-row; }
      .audit-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 8px 0; }
      .audit-value-pre {
        margin: 6px 0 0; padding: 10px; max-height: 200px; overflow: auto;
        background: var(--primary-faint, #f5f8fc); border-radius: 6px;
        font-size: 0.75rem; white-space: pre-wrap; word-break: break-word;
      }
      @media (max-width: 768px) { .audit-detail-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function bindViewerControls() {
    if (bindViewerControls._bound) return;
    bindViewerControls._bound = true;
    ensureViewerStyles();
    document.getElementById('auditLogRefreshBtn')?.addEventListener('click', () => renderViewer());
    ['auditFilterAction', 'auditFilterUser', 'auditFilterPatient', 'auditFilterDateFrom', 'auditFilterDateTo']
      .forEach((id) => {
        document.getElementById(id)?.addEventListener('change', () => renderViewer());
        document.getElementById(id)?.addEventListener('input', () => {
          clearTimeout(bindViewerControls._debounce);
          bindViewerControls._debounce = setTimeout(() => renderViewer(), 350);
        });
      });
  }

  function installSyncHooks() {
    if (!global.CorneaSync || installSyncHooks._done) return;
    installSyncHooks._done = true;

    const sync = global.CorneaSync;
    const origSave = sync.saveVisitLocal.bind(sync);
    sync.saveVisitLocal = async function (data) {
      let existing = null;
      if (data?.id != null) {
        try {
          const store = global.db.transaction(['patients'], 'readonly').objectStore('patients');
          existing = await promisifyRequest(store.get(data.id));
        } catch (_) { /* ignore */ }
      }
      const result = await origSave(data);
      try {
        await logVisit({
          action: existing ? 'edit' : 'create',
          oldRecord: existing,
          newRecord: result,
          recordId: result?.id
        });
      } catch (err) {
        console.warn('[CorneaAudit] save log failed:', err.message);
      }
      return result;
    };

    const origDelete = sync.deleteVisitLocal.bind(sync);
    sync.deleteVisitLocal = async function (id) {
      let existing = null;
      try {
        const store = global.db.transaction(['patients'], 'readonly').objectStore('patients');
        existing = await promisifyRequest(store.get(id));
      } catch (_) { /* ignore */ }
      await origDelete(id);
      if (existing) {
        try {
          await logVisit({
            action: 'delete',
            oldRecord: existing,
            newRecord: null,
            recordId: id
          });
        } catch (err) {
          console.warn('[CorneaAudit] delete log failed:', err.message);
        }
      }
    };
  }

  function installExportHook() {
    if (installExportHook._done) return;
    installExportHook._done = true;

    if (typeof global.exportDatabase === 'function') {
      const origExport = global.exportDatabase;
      global.exportDatabase = async function (...args) {
        let recordCount = 0;
        try {
          if (global.db) {
            const store = global.db.transaction(['patients'], 'readonly').objectStore('patients');
            recordCount = await promisifyRequest(store.count());
          }
        } catch (_) { /* ignore */ }
        const result = await origExport.apply(this, args);
        try {
          await appendLog({
            action: 'export',
            patientId: null,
            patientName: null,
            oldValue: null,
            newValue: { recordCount, exportedAt: new Date().toISOString() },
            entityType: 'database'
          });
        } catch (err) {
          console.warn('[CorneaAudit] export log failed:', err.message);
        }
        return result;
      };
    }
  }

  global.CorneaAudit = {
    STORE_AUDIT,
    ACTIONS,
    ensureAuditStore,
    appendLog,
    logVisit,
    listLogs,
    renderViewer,
    canViewAudit,

    installHooks() {
      if (hooksInstalled) return;
      hooksInstalled = true;
      installSyncHooks();
      installExportHook();
      bindViewerControls();
    },

    /** Called from non-sync save path in Cornea.html only */
    async logDirectSave(oldRecord, newRecord, recordId) {
      await logVisit({
        action: oldRecord ? 'edit' : 'create',
        oldRecord,
        newRecord,
        recordId
      });
    },

    async logRestore(summary) {
      await appendLog({
        action: 'restore',
        patientId: null,
        patientName: null,
        oldValue: null,
        newValue: summary,
        entityType: 'database'
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
