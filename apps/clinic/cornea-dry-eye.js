/**
 * Dry eye / OSD clinic module (P7)
 */
(function (global) {
  'use strict';

  const STORE_CASES = 'dryEyeCases';
  const STORE_ASSESS = 'dryEyeAssessments';

  let _cases = [];
  let _assess = [];
  let _selectedId = null;

  function dbAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function dbPut(store, row) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([store], 'readwrite').objectStore(store).put(row);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function apiOn() { return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.(); }
  function api(p, o) { return global.CorneaApi.request(p, o); }
  function esc(s) { return global.escapeHtml ? global.escapeHtml(s) : String(s ?? ''); }

  function guardCloudRegistryWrite(label) {
    return global.CorneaRegistryOnline?.guardCloudWrite(apiOn(), label || 'Dry eye registry') !== false;
  }

  function bindDryEyeOfflineUi() {
    global.CorneaRegistryOnline?.bindRegistryOfflineUi('dryeye', {
      bannerId: 'dryEyeOfflineBanner',
      registryLabel: 'Dry eye / OSD registry',
      writeSelectors: [
        '#dryEyeTab .btn-primary',
        '#deCaseModal .btn-primary',
        '#deAssessModal .btn-primary'
      ]
    });
  }

  async function refresh() {
    _cases = await dbAll(STORE_CASES);
    _assess = await dbAll(STORE_ASSESS);
  }

  function nextCaseId() {
    const nums = _cases.map((c) => parseInt(String(c.deCaseId || '').match(/(\d+)$/)?.[1] || '0', 10));
    return `DE-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }

  async function pullFromCloud() {
    if (!apiOn()) return;
    try {
      const list = await api('/api/v1/dry-eye-registry?limit=500');
      for (const remote of list?.data || []) {
        const local = _cases.find((c) => c.uuid === remote.id);
        const row = {
          id: local?.id,
          uuid: remote.id,
          deCaseId: remote.caseId,
          deFullName: remote.fullName,
          deSubtype: remote.primarySubtype,
          deStatus: remote.status,
          deMrn: remote.emrPatientMrn,
          deNotes: remote.notes
        };
        const id = await dbPut(STORE_CASES, row);
        if (!row.id) row.id = id;
        const detail = await api(`/api/v1/dry-eye-registry/${remote.id}`);
        for (const a of detail?.data?.assessments || []) {
          await dbPut(STORE_ASSESS, {
            deCaseId: row.id,
            uuid: a.id,
            deAssessDate: a.assessedAt,
            deOsdIndex: a.osdIndexScore,
            deSeverity: a.severity,
            deTreatment: a.treatmentPlan
          });
        }
      }
      await refresh();
    } catch (err) {
      console.warn('[DryEye] Cloud pull failed:', err);
    }
  }

  function renderOverview() {
    const total = _cases.length;
    const active = _cases.filter((c) => c.deStatus === 'Active').length;
    const stable = _cases.filter((c) => c.deStatus === 'Stable').length;
    const discharged = _cases.filter((c) => c.deStatus === 'Discharged').length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('deStatTotal', total);
    set('deStatActive', active);
    set('deStatStable', stable);
    set('deStatDischarged', discharged);
  }

  function renderCases() {
    const body = document.getElementById('deCasesBody');
    if (!body) return;
    const q = document.getElementById('deCaseSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('deFilterStatus')?.value || '';
    let rows = _cases;
    if (status) rows = rows.filter((c) => c.deStatus === status);
    if (q) rows = rows.filter((c) => `${c.deFullName} ${c.deCaseId} ${c.deMrn}`.toLowerCase().includes(q));
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-muted">No dry eye cases.</td></tr>';
      return;
    }
    body.innerHTML = rows.map((c) => `<tr>
      <td>${esc(c.deCaseId)}</td>
      <td><strong>${esc(c.deFullName)}</strong></td>
      <td>${esc(c.deSubtype || '—')}</td>
      <td>${esc(c.deStatus || 'Active')}</td>
      <td>${esc(c.deMrn || '—')}</td>
      <td class="no-print"><button type="button" class="btn-link btn-sm" onclick="CorneaDryEye.selectCase(${c.id})">Open</button></td>
    </tr>`).join('');
  }

  function renderDetail() {
    const panel = document.getElementById('deCaseDetail');
    const c = _cases.find((x) => x.id === _selectedId);
    if (!panel) return;
    if (!c) { panel.hidden = true; return; }
    panel.hidden = false;
    document.getElementById('deCaseDetailTitle').textContent = `${c.deCaseId} — ${c.deFullName}`;
    const assess = _assess.filter((a) => a.deCaseId === c.id);
    const body = document.getElementById('deAssessBody');
    if (!assess.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-muted">No assessments yet.</td></tr>';
    } else {
      body.innerHTML = assess.map((a) => `<tr>
        <td>${esc(a.deAssessDate)}</td>
        <td>${esc(a.deOsdIndex ?? '—')}</td>
        <td>${esc(a.deSeverity || '—')}</td>
        <td>${esc(a.deTbutOd ?? '—')}</td>
        <td>${esc(a.deOsdi ?? '—')}</td>
        <td>${esc(a.deTreatment || '—')}</td>
      </tr>`).join('');
    }
  }

  global.CorneaDryEye = {
    STORE_CASES,
    STORE_ASSESS,
    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        db.createObjectStore(STORE_CASES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_ASSESS)) {
        const s = db.createObjectStore(STORE_ASSESS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('deCaseId', 'deCaseId', { unique: false });
      }
    },
    async init() {
      bindDryEyeOfflineUi();
      await refresh();
      if (apiOn()) await pullFromCloud();
      renderOverview();
      renderCases();
      renderDetail();
      global.CorneaRegistryOnline?.refresh('dryeye');
    },
    selectCase(id) {
      _selectedId = id;
      renderDetail();
    },
    switchPanel(panelId) {
      document.querySelectorAll('#dryEyeTab .de-panel').forEach((p) => p.classList.toggle('active', p.id === panelId));
      document.querySelectorAll('#dryEyeTab .de-subnav-btn').forEach((b) => b.classList.toggle('active', b.dataset.dePanel === panelId));
    },
    openCaseModal(mode) {
      const c = mode === 'edit' ? _cases.find((x) => x.id === _selectedId) : null;
      document.getElementById('deCaseRecordId').value = c?.id || '';
      document.getElementById('deCaseUuid').value = c?.uuid || '';
      document.getElementById('deCaseIdField').value = c?.deCaseId || nextCaseId();
      document.getElementById('deFullName').value = c?.deFullName || '';
      document.getElementById('deMrn').value = c?.deMrn || document.getElementById('patientId')?.value || '';
      document.getElementById('deSubtype').value = c?.deSubtype || 'MGD';
      document.getElementById('deStatus').value = c?.deStatus || 'Active';
      document.getElementById('deNotes').value = c?.deNotes || '';
      global.openEmrModal('deCaseModal');
    },
    openAssessModal() {
      if (!_selectedId) { alert('Select a case first.'); return; }
      document.getElementById('deAssessCaseId').value = _selectedId;
      document.getElementById('deAssessDate').value = new Date().toISOString().slice(0, 10);
      ['deTbutOd', 'deTbutOs', 'deSchirmerOd', 'deSchirmerOs', 'deOsdi', 'deDeq5', 'deTreatment', 'deAssessNotes'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('deMgd').value = 'Mild';
      document.getElementById('deBleph').value = 'None';
      global.openEmrModal('deAssessModal');
    },
    async saveCase() {
      if (!guardCloudRegistryWrite()) return;
      const row = {
        id: document.getElementById('deCaseRecordId').value ? Number(document.getElementById('deCaseRecordId').value) : undefined,
        uuid: document.getElementById('deCaseUuid').value || undefined,
        deCaseId: document.getElementById('deCaseIdField').value,
        deFullName: document.getElementById('deFullName').value.trim(),
        deMrn: document.getElementById('deMrn').value.trim(),
        deSubtype: document.getElementById('deSubtype').value,
        deStatus: document.getElementById('deStatus').value,
        deNotes: document.getElementById('deNotes').value.trim()
      };
      if (!row.deFullName) { alert('Patient name required.'); return; }
      if (apiOn()) {
        try {
          const payload = {
            fullName: row.deFullName,
            emrPatientMrn: row.deMrn,
            primarySubtype: row.deSubtype,
            status: row.deStatus,
            notes: row.deNotes
          };
          if (row.uuid) {
            /* updates not in MVP API */
          } else {
            const res = await api('/api/v1/dry-eye-registry', { method: 'POST', body: JSON.stringify(payload) });
            row.uuid = res?.data?.id;
            row.deCaseId = res?.data?.caseId || row.deCaseId;
          }
        } catch (err) {
          console.warn('[DryEye] Cloud save failed:', err);
        }
      }
      const id = await dbPut(STORE_CASES, row);
      if (!row.id) row.id = id;
      global.closeEmrModal('deCaseModal');
      await refresh();
      _selectedId = row.id;
      renderOverview();
      renderCases();
      renderDetail();
    },
    async saveAssessment() {
      if (!guardCloudRegistryWrite()) return;
      const caseId = Number(document.getElementById('deAssessCaseId').value);
      const c = _cases.find((x) => x.id === caseId);
      const payload = {
        assessedAt: document.getElementById('deAssessDate').value,
        tbutOd: document.getElementById('deTbutOd').value,
        tbutOs: document.getElementById('deTbutOs').value,
        schirmerOd: document.getElementById('deSchirmerOd').value,
        schirmerOs: document.getElementById('deSchirmerOs').value,
        osdiScore: document.getElementById('deOsdi').value,
        deq5Score: document.getElementById('deDeq5').value,
        mgdGrade: document.getElementById('deMgd').value,
        blepharitis: document.getElementById('deBleph').value,
        treatmentPlan: document.getElementById('deTreatment').value,
        notes: document.getElementById('deAssessNotes').value
      };
      if (apiOn() && c?.uuid) {
        try {
          const res = await api(`/api/v1/dry-eye-registry/${encodeURIComponent(c.uuid)}/assessments`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          await dbPut(STORE_ASSESS, {
            deCaseId: caseId,
            uuid: res?.data?.id,
            deAssessDate: res?.data?.assessedAt,
            deOsdIndex: res?.data?.osdIndexScore,
            deSeverity: res?.data?.severity,
            deTbutOd: res?.data?.tbutOd,
            deOsdi: res?.data?.osdiScore,
            deTreatment: res?.data?.treatmentPlan,
            ...payload
          });
          global.closeEmrModal('deAssessModal');
          await refresh();
          renderDetail();
          return;
        } catch (err) {
          console.warn('[DryEye] Cloud assessment failed:', err);
        }
      }
      await dbPut(STORE_ASSESS, { deCaseId: caseId, ...payload, deAssessDate: payload.assessedAt });
      global.closeEmrModal('deAssessModal');
      await refresh();
      renderDetail();
    }
  };

  global.initDryEyeTab = () => global.CorneaDryEye.init();
  global.switchDePanel = (id) => global.CorneaDryEye.switchPanel(id);
})(typeof window !== 'undefined' ? window : globalThis);
