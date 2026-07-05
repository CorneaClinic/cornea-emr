/**
 * Infectious keratitis & corneal ulcer service module (Project 3)
 */
(function (global) {
  'use strict';

  const STORE_CASES = 'keratitisCases';
  const STORE_ASSESS = 'keratitisAssessments';
  const STORE_CULTURES = 'keratitisCultures';
  const T = () => global.CorneaKeratitisTaxonomy || {};

  let _cases = [];
  let _assess = [];
  let _cultures = [];
  let _selectedId = null;

  function dbAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
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
    return global.CorneaRegistryOnline?.guardCloudWrite(apiOn(), label || 'Keratitis registry') !== false;
  }

  function bindKeratitisOfflineUi() {
    global.CorneaRegistryOnline?.bindRegistryOfflineUi('keratitis', {
      bannerId: 'keratitisOfflineBanner',
      registryLabel: 'Keratitis & ulcer registry',
      writeSelectors: [
        '#keratitisTab .btn-primary',
        '#ukCaseModal .btn-primary',
        '#ukAssessModal .btn-primary',
        '#ukCultureModal .btn-primary'
      ]
    });
  }

  async function refresh() {
    _cases = await dbAll(STORE_CASES);
    _assess = await dbAll(STORE_ASSESS);
    _cultures = await dbAll(STORE_CULTURES);
  }

  function nextCaseId() {
    const nums = _cases.map((c) => parseInt(String(c.ukCaseId || '').match(/(\d+)$/)?.[1] || '0', 10));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `UK-P-${String(n).padStart(4, '0')}`;
  }

  async function pullFromCloud() {
    if (!apiOn()) return;
    try {
      const list = await api('/api/v1/keratitis-registry?limit=500');
      for (const remote of list?.data || []) {
        const local = _cases.find((c) => c.uuid === remote.id || c.ukCaseId === remote.caseId);
        const row = {
          id: local?.id,
          uuid: remote.id,
          ukCaseId: remote.caseId,
          ukFullName: remote.fullName,
          ukEye: remote.eye,
          ukPresentationDate: remote.presentationDate,
          ukEtiology: remote.etiology,
          ukContactLens: remote.contactLens ? 'Yes' : 'No',
          ukStatus: remote.status,
          ukAntimicrobialPlan: remote.antimicrobialPlan,
          ukEmrMrn: remote.emrPatientMrn,
          ukNotes: remote.notes,
          revision: remote.revision
        };
        const id = await dbPut(STORE_CASES, row);
        if (!row.id) row.id = id;
        const detail = await api(`/api/v1/keratitis-registry/${remote.id}`);
        const d = detail?.data || {};
        for (const a of d.assessments || []) {
          await dbPut(STORE_ASSESS, {
            ukCaseId: row.id,
            uuid: a.id,
            ukAssessDate: a.assessedAt,
            ukUlcerSize: a.ulcerSizeMm,
            ukBcva: a.bcva,
            ukHealing: a.healingStatus,
            ukPain: a.painScore,
            ukNotes: a.notes
          });
        }
        for (const c of d.cultures || []) {
          await dbPut(STORE_CULTURES, {
            ukCaseId: row.id,
            uuid: c.id,
            ukCultureDate: c.specimenDate,
            ukSpecimen: c.specimenType,
            ukGram: c.gramStain,
            ukOrganism: c.organism,
            ukSensitivity: c.sensitivity
          });
        }
      }
      await refresh();
    } catch (err) {
      console.warn('[Keratitis] Cloud pull failed:', err);
    }
  }

  function renderOverview() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    set('ukStatTotal', _cases.length);
    set('ukStatActive', _cases.filter((c) => c.ukStatus === 'Active').length);
    set('ukStatHealing', _cases.filter((c) => c.ukStatus === 'Healing').length);
    set('ukStatResolved', _cases.filter((c) => c.ukStatus === 'Resolved').length);
  }

  function renderCasesTable() {
    const body = document.getElementById('ukCasesBody');
    if (!body) return;
    const q = (document.getElementById('ukCaseSearch')?.value || '').toLowerCase();
    let rows = _cases.slice();
    const st = document.getElementById('ukFilterStatus')?.value;
    if (st) rows = rows.filter((r) => r.ukStatus === st);
    if (q) rows = rows.filter((r) => [r.ukCaseId, r.ukFullName, r.ukEtiology].some((v) => String(v || '').toLowerCase().includes(q)));
    body.innerHTML = rows.length ? rows.map((r) => `<tr class="${_selectedId === r.id ? 'row-selected' : ''}">
      <td>${esc(r.ukCaseId)}</td><td>${esc(r.ukFullName)}</td><td>${esc(r.ukEye)}</td>
      <td>${esc(r.ukEtiology)}</td><td>${esc(r.ukStatus)}</td><td>${esc(r.ukPresentationDate)}</td>
      <td class="no-print"><button type="button" class="btn-secondary btn-sm" onclick="CorneaKeratitis.openCase(${r.id})">Open</button></td>
    </tr>`).join('') : '<tr><td colspan="7" class="text-muted">No ulcer cases yet.</td></tr>';
  }

  function renderCaseDetail(c) {
    const panel = document.getElementById('ukCaseDetail');
    if (!panel || !c) return;
    panel.hidden = false;
    document.getElementById('ukCaseDetailTitle').textContent = `${c.ukFullName} · ${c.ukCaseId}`;
    const assess = _assess.filter((a) => a.ukCaseId === c.id).sort((a, b) => String(b.ukAssessDate).localeCompare(String(a.ukAssessDate)));
    const cultures = _cultures.filter((x) => x.ukCaseId === c.id);
    document.getElementById('ukAssessBody').innerHTML = assess.length ? assess.map((a) => `<tr>
      <td>${a.ukAssessDate}</td><td>${a.ukUlcerSize ?? '—'}</td><td>${a.ukBcva || '—'}</td>
      <td>${a.ukHealing || '—'}</td><td>${a.ukPain ?? '—'}</td></tr>`).join('')
      : '<tr><td colspan="5" class="text-muted">No daily assessments.</td></tr>';
    document.getElementById('ukCultureBody').innerHTML = cultures.length ? cultures.map((x) => `<tr>
      <td>${x.ukCultureDate}</td><td>${x.ukSpecimen || '—'}</td><td>${x.ukGram || '—'}</td>
      <td>${esc(x.ukOrganism) || '—'}</td><td>${esc(x.ukSensitivity) || '—'}</td></tr>`).join('')
      : '<tr><td colspan="5" class="text-muted">No culture results.</td></tr>';
  }

  global.CorneaKeratitis = {
    STORE_CASES,
    STORE_ASSESS,
    STORE_CULTURES,

    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        const s = db.createObjectStore(STORE_CASES, { keyPath: 'id', autoIncrement: true });
        s.createIndex('ukCaseId', 'ukCaseId', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_ASSESS)) {
        const s = db.createObjectStore(STORE_ASSESS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('ukCaseId', 'ukCaseId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CULTURES)) {
        const s = db.createObjectStore(STORE_CULTURES, { keyPath: 'id', autoIncrement: true });
        s.createIndex('ukCaseId', 'ukCaseId', { unique: false });
      }
    },

    async init() {
      bindKeratitisOfflineUi();
      if (!global.db) return;
      if (apiOn()) await pullFromCloud();
      else await refresh();
      renderOverview();
      renderCasesTable();
      global.CorneaRegistryOnline?.refresh('keratitis');
    },

    openCase(id) {
      _selectedId = id;
      const c = _cases.find((x) => x.id === id);
      if (c) {
        global.switchUkPanel?.('ukCasesPanel');
        renderCaseDetail(c);
        renderCasesTable();
      }
    },

    openCaseModal(mode) {
      const open = async () => {
        if (mode === 'new') {
          document.getElementById('ukRecordId').value = '';
          document.getElementById('ukCaseId').value = nextCaseId();
          document.getElementById('ukFullName').value = '';
          document.getElementById('ukPresentationDate').value = new Date().toISOString().slice(0, 10);
        } else {
          const c = _cases.find((x) => x.id === _selectedId);
          if (!c) { alert('Select a case first.'); return; }
          const lock = global.CorneaRecordLock;
          if (apiOn() && c.uuid && lock) {
            const editResult = await lock.beforeEditEntity(lock.ENTITY.keratitis_case, c.uuid, { entityLabel: 'keratitis case' });
            if (!editResult.ok) return;
          }
          document.getElementById('ukRecordId').value = c.id;
          document.getElementById('ukCaseId').value = c.ukCaseId || '';
          document.getElementById('ukFullName').value = c.ukFullName || '';
          document.getElementById('ukEye').value = c.ukEye || '';
          document.getElementById('ukPresentationDate').value = c.ukPresentationDate || '';
          document.getElementById('ukEtiology').value = c.ukEtiology || '';
          document.getElementById('ukStatus').value = c.ukStatus || 'Active';
          document.getElementById('ukAntimicrobialPlan').value = c.ukAntimicrobialPlan || '';
          document.getElementById('ukEmrMrn').value = c.ukEmrMrn || '';
          document.getElementById('ukNotes').value = c.ukNotes || '';
          const cl = document.getElementById('ukContactLens');
          if (cl) cl.value = c.ukContactLens || '';
        }
        global.openEmrModal('ukCaseModal');
      };
      if (mode === 'new') global.CorneaRecordLock?.releaseActive?.();
      open();
    },

    async saveCase() {
      if (!guardCloudRegistryWrite()) return;
      const name = document.getElementById('ukFullName')?.value?.trim();
      if (!name) { alert('Name required.'); return; }
      const row = {
        ukCaseId: document.getElementById('ukCaseId')?.value || nextCaseId(),
        ukFullName: name,
        ukEye: document.getElementById('ukEye')?.value,
        ukPresentationDate: document.getElementById('ukPresentationDate')?.value,
        ukEtiology: document.getElementById('ukEtiology')?.value,
        ukContactLens: document.getElementById('ukContactLens')?.value,
        ukStatus: document.getElementById('ukStatus')?.value || 'Active',
        ukAntimicrobialPlan: document.getElementById('ukAntimicrobialPlan')?.value,
        ukEmrMrn: document.getElementById('ukEmrMrn')?.value,
        ukNotes: document.getElementById('ukNotes')?.value
      };
      const rid = document.getElementById('ukRecordId')?.value;
      if (rid) {
        row.id = Number(rid);
        const existing = _cases.find((c) => c.id === row.id);
        if (existing) {
          row.uuid = existing.uuid;
          row.revision = existing.revision;
        }
      }
      const id = await dbPut(STORE_CASES, row);
      if (!row.id) row.id = id;

      if (apiOn()) {
        try {
          const payload = {
            caseId: row.ukCaseId,
            fullName: row.ukFullName,
            eye: row.ukEye,
            presentationDate: row.ukPresentationDate,
            etiology: row.ukEtiology,
            contactLens: row.ukContactLens === 'Yes',
            status: row.ukStatus,
            antimicrobialPlan: row.ukAntimicrobialPlan,
            emrPatientMrn: row.ukEmrMrn,
            notes: row.ukNotes,
            baseRevision: row.revision
          };
          const lock = global.CorneaRecordLock;
          if (row.uuid) {
            if (!(await lock?.beforeSaveEntity?.(lock.ENTITY.keratitis_case, row.uuid, row.revision, 'keratitis case'))) return;
            const res = await api(`/api/v1/keratitis-registry/${row.uuid}`, { method: 'PUT', body: JSON.stringify(payload) });
            if (res?.data) {
              row.revision = res.data.revision;
              row.ukCaseId = res.data.caseId || row.ukCaseId;
              await dbPut(STORE_CASES, row);
            }
          } else {
            const res = await api('/api/v1/keratitis-registry', { method: 'POST', body: JSON.stringify(payload) });
            if (res?.data?.id) {
              row.uuid = res.data.id;
              row.revision = res.data.revision;
              row.ukCaseId = res.data.caseId || row.ukCaseId;
              await dbPut(STORE_CASES, row);
            }
          }
        } catch (err) {
          if (global.CorneaRecordLock?.handleSaveConflict?.(err, 'Keratitis case')) return;
          console.warn('[Keratitis] Cloud save failed:', err);
        }
      }

      global.closeEmrModal('ukCaseModal');
      await refresh();
      renderOverview();
      renderCasesTable();
      this.openCase(row.id);
    },

    openAssessModal() {
      if (!_selectedId) { alert('Open a case first.'); return; }
      document.getElementById('ukAssessCaseId').value = _selectedId;
      document.getElementById('ukAssessDate').value = new Date().toISOString().slice(0, 10);
      global.openEmrModal('ukAssessModal');
    },

    async saveAssessment() {
      if (!guardCloudRegistryWrite()) return;
      const ukCaseId = Number(document.getElementById('ukAssessCaseId')?.value);
      const row = {
        ukCaseId,
        ukAssessDate: document.getElementById('ukAssessDate')?.value,
        ukUlcerSize: document.getElementById('ukAssessSize')?.value,
        ukBcva: document.getElementById('ukAssessBcva')?.value,
        ukHealing: document.getElementById('ukAssessHealing')?.value,
        ukPain: document.getElementById('ukAssessPain')?.value,
        ukNotes: document.getElementById('ukAssessNotes')?.value
      };
      await dbPut(STORE_ASSESS, row);
      const c = _cases.find((x) => x.id === ukCaseId);
      if (apiOn() && c?.uuid) {
        try {
          await api(`/api/v1/keratitis-registry/${c.uuid}/assessments`, {
            method: 'POST',
            body: JSON.stringify({
              assessedAt: row.ukAssessDate,
              ulcerSizeMm: row.ukUlcerSize ? Number(row.ukUlcerSize) : null,
              bcva: row.ukBcva,
              healingStatus: row.ukHealing,
              painScore: row.ukPain ? parseInt(row.ukPain, 10) : null,
              notes: row.ukNotes
            })
          });
        } catch (_) { /* local ok */ }
      }
      global.closeEmrModal('ukAssessModal');
      await refresh();
      renderCaseDetail(_cases.find((x) => x.id === ukCaseId));
    },

    openCultureModal() {
      if (!_selectedId) { alert('Open a case first.'); return; }
      document.getElementById('ukCultureCaseId').value = _selectedId;
      document.getElementById('ukCultureDate').value = new Date().toISOString().slice(0, 10);
      global.openEmrModal('ukCultureModal');
    },

    async saveCulture() {
      if (!guardCloudRegistryWrite()) return;
      const ukCaseId = Number(document.getElementById('ukCultureCaseId')?.value);
      const row = {
        ukCaseId,
        ukCultureDate: document.getElementById('ukCultureDate')?.value,
        ukSpecimen: document.getElementById('ukSpecimen')?.value,
        ukGram: document.getElementById('ukGram')?.value,
        ukOrganism: document.getElementById('ukOrganism')?.value,
        ukSensitivity: document.getElementById('ukSensitivity')?.value
      };
      await dbPut(STORE_CULTURES, row);
      const c = _cases.find((x) => x.id === ukCaseId);
      if (apiOn() && c?.uuid) {
        try {
          await api(`/api/v1/keratitis-registry/${c.uuid}/cultures`, {
            method: 'POST',
            body: JSON.stringify({
              specimenDate: row.ukCultureDate,
              specimenType: row.ukSpecimen,
              gramStain: row.ukGram,
              organism: row.ukOrganism,
              sensitivity: row.ukSensitivity
            })
          });
        } catch (_) { /* local ok */ }
      }
      global.closeEmrModal('ukCultureModal');
      await refresh();
      renderCaseDetail(_cases.find((x) => x.id === ukCaseId));
    }
  };

  global.switchUkPanel = function (panelId) {
    document.querySelectorAll('#keratitisTab .uk-panel').forEach((p) => p.classList.toggle('active', p.id === panelId));
    document.querySelectorAll('#keratitisTab .uk-subnav-btn').forEach((b) => b.classList.toggle('active', b.dataset.ukPanel === panelId));
  };

  global.initKeratitisTab = () => global.CorneaKeratitis.init();
})(typeof window !== 'undefined' ? window : globalThis);
