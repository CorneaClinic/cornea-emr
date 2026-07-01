/**
 * Cornea Clinic — KC & CXL Longitudinal Registry (Project 2)
 */
(function (global) {
  'use strict';

  const STORE_KC_PATIENTS = 'kcPatients';
  const STORE_KC_TOPOGRAPHY = 'kcTopography';
  const STORE_KC_CXL = 'kcCxlProcedures';

  let _kcPatientsCache = [];
  let _kcTopoCache = [];
  let _kcCxlCache = [];

  function kcDbGetAll(store) {
    return new Promise((resolve, reject) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function kcDbPut(store, data) {
    if (data.id != null) {
      const existing = await new Promise((resolve) => {
        const req = global.db.transaction([store], 'readonly').objectStore(store).get(data.id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (existing?.uuid) data.uuid = existing.uuid;
      if (existing?.revision) data.revision = existing.revision;
    }
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([store], 'readwrite').objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function kcDbDelete(store, id) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([store], 'readwrite').objectStore(store).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function nextLocalKcId() {
    const nums = _kcPatientsCache.map((p) => {
      const m = String(p.kcRegistryId || '').match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `KC-P-${String(n).padStart(4, '0')}`;
  }

  function apiEnabled() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  async function apiRequest(path, options = {}) {
    return global.CorneaApi.request(path, options);
  }

  function patientToApi(p) {
    return {
      kcRegistryId: p.kcRegistryId,
      emrPatientMrn: p.kcEmrPatientMrn || null,
      fullName: p.kcFullName,
      age: p.kcAge != null && p.kcAge !== '' ? Number(p.kcAge) : null,
      gender: p.kcGender || null,
      phone: p.kcPhone || null,
      eyeInvolvement: p.kcEyeInvolvement || null,
      diagnosis: p.kcDiagnosis || 'Keratoconus',
      staging: p.kcStaging || null,
      indexDate: p.kcIndexDate || null,
      familyHistoryKc: p.kcFamilyHistoryKc === 'Yes' ? true : (p.kcFamilyHistoryKc === 'No' ? false : null),
      atopy: p.kcAtopy || null,
      eyeRubbing: p.kcEyeRubbing || null,
      status: p.kcStatus || 'Active',
      progressionStatus: p.kcProgressionStatus || 'None',
      notes: p.kcNotes || null,
      legacyLocalId: p.id,
      baseRevision: p.revision
    };
  }

  function topoToApi(t) {
    return {
      eye: t.kcTopoEye,
      capturedAt: t.kcTopoCapturedAt,
      device: t.kcTopoDevice || null,
      kmax: numOrNull(t.kcTopoKmax),
      kmean: numOrNull(t.kcTopoKmean),
      k1: numOrNull(t.kcTopoK1),
      k2: numOrNull(t.kcTopoK2),
      thinnestPachy: intOrNull(t.kcTopoThinnestPachy),
      centralPachy: intOrNull(t.kcTopoCentralPachy),
      badD: numOrNull(t.kcTopoBadD),
      abcd: t.kcTopoAbcd || null,
      coneSeverity: t.kcTopoConeSeverity || null,
      coneLocation: t.kcTopoConeLocation || null,
      progressionFlag: t.kcTopoProgressionFlag || 'None',
      source: t.source || 'manual',
      notes: t.kcTopoNotes || null,
      legacyLocalId: t.id
    };
  }

  function cxlToApi(c) {
    return {
      eye: c.kcCxlEye,
      procedureDate: c.kcCxlProcedureDate,
      protocol: c.kcCxlProtocol || null,
      epiType: c.kcCxlEpiType || null,
      riboflavinType: c.kcCxlRiboflavinType || null,
      riboflavinDurationMin: intOrNull(c.kcCxlRiboflavinDurationMin),
      uvEnergyJCm2: numOrNull(c.kcCxlUvEnergy),
      uvDurationSec: intOrNull(c.kcCxlUvDurationSec),
      uvPowerMwCm2: numOrNull(c.kcCxlUvPower),
      iontophoresis: c.kcCxlIontophoresis === 'Yes' ? true : (c.kcCxlIontophoresis === 'No' ? false : null),
      surgeon: c.kcCxlSurgeon || null,
      preKmax: numOrNull(c.kcCxlPreKmax),
      preKmean: numOrNull(c.kcCxlPreKmean),
      preThinnestPachy: intOrNull(c.kcCxlPreThinnestPachy),
      postKmax3m: numOrNull(c.kcCxlPostKmax3m),
      postKmax6m: numOrNull(c.kcCxlPostKmax6m),
      postKmax12m: numOrNull(c.kcCxlPostKmax12m),
      postKmean3m: numOrNull(c.kcCxlPostKmean3m),
      postKmean6m: numOrNull(c.kcCxlPostKmean6m),
      postKmean12m: numOrNull(c.kcCxlPostKmean12m),
      outcome: c.kcCxlOutcome || 'Pending',
      complications: c.kcCxlComplications || null,
      notes: c.kcCxlNotes || null,
      legacyLocalId: c.id
    };
  }

  function numOrNull(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  function intOrNull(v) {
    if (v === '' || v == null) return null;
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
  }

  async function refreshCaches() {
    _kcPatientsCache = await kcDbGetAll(STORE_KC_PATIENTS);
    _kcTopoCache = await kcDbGetAll(STORE_KC_TOPOGRAPHY);
    _kcCxlCache = await kcDbGetAll(STORE_KC_CXL);
  }

  function topoForPatient(kcPatientLocalId) {
    return _kcTopoCache.filter((t) => t.kcPatientId === kcPatientLocalId)
      .sort((a, b) => String(b.kcTopoCapturedAt).localeCompare(String(a.kcTopoCapturedAt)));
  }

  function cxlForPatient(kcPatientLocalId) {
    return _kcCxlCache.filter((c) => c.kcPatientId === kcPatientLocalId)
      .sort((a, b) => String(b.kcCxlProcedureDate).localeCompare(String(a.kcCxlProcedureDate)));
  }

  function updateKcOverviewStats() {
    const p = _kcPatientsCache;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
    set('kcStatTotal', p.length);
    set('kcStatActive', p.filter((x) => x.kcStatus === 'Active').length);
    set('kcStatWatch', p.filter((x) => x.kcStatus === 'Watch').length);
    set('kcStatPostCxl', p.filter((x) => x.kcStatus === 'Post-CXL').length);
    set('kcStatProgression', p.filter((x) => /Confirmed|Suspect/i.test(x.kcProgressionStatus || '')).length);
    set('kcStatCxl', _kcCxlCache.length);
  }

  function renderKcPatientsTable() {
    const body = document.getElementById('kcPatientsBody');
    if (!body) return;
    const q = (document.getElementById('kcPatientSearch')?.value || '').toLowerCase();
    const statusF = document.getElementById('kcFilterStatus')?.value || '';
    let rows = _kcPatientsCache.slice();
    if (statusF) rows = rows.filter((r) => r.kcStatus === statusF);
    if (q) {
      rows = rows.filter((r) =>
        [r.kcRegistryId, r.kcFullName, r.kcEmrPatientMrn, r.kcDiagnosis, r.kcPhone]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="text-muted">No KC registry patients yet.</td></tr>';
      return;
    }
    body.innerHTML = rows.map((r) => {
      const prog = r.kcProgressionStatus && r.kcProgressionStatus !== 'None'
        ? `<span class="badge badge-warning">${global.escapeHtml?.(r.kcProgressionStatus) || r.kcProgressionStatus}</span>`
        : '—';
      return `<tr data-kc-id="${r.id}" class="${global._kcSelectedPatientId === r.id ? 'row-selected' : ''}">
        <td>${global.escapeHtml?.(r.kcRegistryId) || r.kcRegistryId}</td>
        <td>${global.escapeHtml?.(r.kcFullName) || r.kcFullName}</td>
        <td>${global.escapeHtml?.(r.kcDiagnosis) || ''}</td>
        <td>${global.escapeHtml?.(r.kcEyeInvolvement) || ''}</td>
        <td>${global.escapeHtml?.(r.kcStaging) || '—'}</td>
        <td>${global.escapeHtml?.(r.kcStatus) || ''}</td>
        <td>${prog}</td>
        <td>${global.escapeHtml?.(r.kcIndexDate) || '—'}</td>
        <td class="no-print">
          <button type="button" class="btn-secondary btn-sm" onclick="viewKcPatientDetail(${r.id})">Open</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderKcPatientDetail(p) {
    const panel = document.getElementById('kcPatientDetailPanel');
    if (!p || !panel) return;
    global._kcSelectedPatientId = p.id;
    panel.hidden = false;
    const title = document.getElementById('kcPatientDetailTitle');
    if (title) title.textContent = `${p.kcFullName} · ${p.kcRegistryId}`;

    const topo = topoForPatient(p.id);
    const cxl = cxlForPatient(p.id);
    const summary = global.CorneaKcCxlTaxonomy?.computeProgressionSummary?.(topo) || {};

    const summaryEl = document.getElementById('kcProgressionSummary');
    if (summaryEl) {
      summaryEl.innerHTML = ['OD', 'OS'].map((eye) => {
        const s = summary[eye] || {};
        const cls = /Progression/i.test(s.flag) ? 'color:var(--danger,#c62828)' : '';
        return `<div class="kc-prog-eye"><strong>${eye}</strong>: ${s.flag || '—'}
          ${s.deltaKmax != null ? ` (ΔKmax ${s.deltaKmax} D, ${s.points} readings)` : ''}</div>`;
      }).join('');
    }

    const topoBody = document.getElementById('kcTopoTimelineBody');
    if (topoBody) {
      if (!topo.length) {
        topoBody.innerHTML = '<tr><td colspan="8" class="text-muted">No topography readings yet.</td></tr>';
      } else {
        topoBody.innerHTML = topo.map((t) => `<tr>
          <td>${t.kcTopoCapturedAt || ''}</td><td>${t.kcTopoEye || ''}</td><td>${t.kcTopoDevice || ''}</td>
          <td>${t.kcTopoKmax ?? '—'}</td><td>${t.kcTopoKmean ?? '—'}</td><td>${t.kcTopoThinnestPachy ?? '—'}</td>
          <td>${t.kcTopoBadD ?? '—'}</td>
          <td>${t.kcTopoProgressionFlag || 'None'}</td>
          <td class="no-print"><button type="button" class="btn-secondary btn-sm" onclick="openKcTopoModal('edit',${t.id})">Edit</button></td>
        </tr>`).join('');
      }
    }

    const cxlBody = document.getElementById('kcCxlTimelineBody');
    if (cxlBody) {
      if (!cxl.length) {
        cxlBody.innerHTML = '<tr><td colspan="7" class="text-muted">No CXL procedures recorded.</td></tr>';
      } else {
        cxlBody.innerHTML = cxl.map((c) => `<tr>
          <td>${c.kcCxlProcedureDate || ''}</td><td>${c.kcCxlEye || ''}</td><td>${c.kcCxlProtocol || ''}</td>
          <td>${c.kcCxlEpiType || ''}</td><td>${c.kcCxlUvEnergy ?? '—'}</td>
          <td>${c.kcCxlOutcome || ''}</td>
          <td class="no-print"><button type="button" class="btn-secondary btn-sm" onclick="openKcCxlModal('edit',${c.id})">Edit</button></td>
        </tr>`).join('');
      }
    }

    const linksEl = document.getElementById('kcModuleLinks');
    if (linksEl) {
      linksEl.innerHTML = `
        <button type="button" class="btn-secondary btn-sm" onclick="CorneaKcCxl.openLinkedModule('scleral')"><i class="fa-solid fa-circle"></i> Scleral lens wizard</button>
        <button type="button" class="btn-secondary btn-sm" onclick="CorneaKcCxl.openLinkedModule('laser')"><i class="fa-solid fa-bolt"></i> Laser refractive work-up</button>
        <button type="button" class="btn-secondary btn-sm" onclick="CorneaKcCxl.openClinicalMedia('${global.escapeHtml?.(p.kcEmrPatientMrn) || ''}')"><i class="fa-solid fa-images"></i> Topography media</button>
        <button type="button" class="btn-secondary btn-sm" onclick="CorneaKcCxl.importFromCurrentVisit()"><i class="fa-solid fa-file-import"></i> Import from visit laser module</button>`;
    }

    if (global.CorneaClinicalMedia?.loadPatientTimeline && p.kcEmrPatientMrn) {
      global.CorneaClinicalMedia.loadPatientTimeline(p.kcEmrPatientMrn, { category: 'topography' }).catch(() => {});
    }

    refreshKcEctasiaAi(p, topo);
  }

  async function refreshKcEctasiaAi(p, topoRows) {
    const el = document.getElementById('kcEctasiaAiPanel');
    if (!el || !global.CorneaEctasiaAI) return;
    if (!topo.length) {
      el.innerHTML = '<p class="form-hint">Add topography readings to run ectasia AI analysis.</p>';
      return;
    }
    el.innerHTML = '<p class="form-hint"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing topography…</p>';
    const metrics = global.CorneaEctasiaAI.metricsFromKcPatient(p, topoRows || topo);
    try {
      const analysis = await global.CorneaEctasiaAI.analyze(metrics);
      el.innerHTML = global.CorneaEctasiaAI.renderPanel(analysis);
      el.querySelector('.ectasia-refresh-btn')?.addEventListener('click', () => refreshKcEctasiaAi(p, topoRows || topo));
    } catch (err) {
      el.innerHTML = `<p class="form-hint">Ectasia analysis failed: ${global.escapeHtml?.(err.message) || err.message}</p>`;
    }
  }

  global.viewKcPatientDetail = function (id) {
    const p = _kcPatientsCache.find((x) => x.id === id);
    if (p) {
      global.switchKcPanel?.('kcPatientsPanel');
      renderKcPatientDetail(p);
      renderKcPatientsTable();
    }
  };

  global.openKcPatientModal = function (mode) {
    const title = document.getElementById('kcPatientModalTitle');
    if (mode === 'new') {
      document.getElementById('kcRecordId').value = '';
      document.getElementById('kcRegistryId').value = nextLocalKcId();
      ['kcFullName', 'kcPhone', 'kcEmrPatientMrn', 'kcNotes'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['kcAge', 'kcIndexDate'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      ['kcGender', 'kcEyeInvolvement', 'kcDiagnosis', 'kcStaging', 'kcFamilyHistoryKc', 'kcAtopy', 'kcEyeRubbing'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const status = document.getElementById('kcStatus');
      if (status) status.value = 'Active';
      const diag = document.getElementById('kcDiagnosis');
      if (diag) diag.value = 'Keratoconus';
      if (title) title.textContent = 'Enrol KC Patient';
    } else {
      const p = _kcPatientsCache.find((x) => x.id === global._kcSelectedPatientId);
      if (!p) { alert('Select a patient first.'); return; }
      document.getElementById('kcRecordId').value = p.id;
      const map = {
        kcRegistryId: 'kcRegistryId', kcFullName: 'kcFullName', kcAge: 'kcAge', kcGender: 'kcGender',
        kcPhone: 'kcPhone', kcEmrPatientMrn: 'kcEmrPatientMrn', kcEyeInvolvement: 'kcEyeInvolvement',
        kcDiagnosis: 'kcDiagnosis', kcStaging: 'kcStaging', kcIndexDate: 'kcIndexDate',
        kcFamilyHistoryKc: 'kcFamilyHistoryKc', kcAtopy: 'kcAtopy', kcEyeRubbing: 'kcEyeRubbing',
        kcStatus: 'kcStatus', kcNotes: 'kcNotes'
      };
      Object.entries(map).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el && p[k] != null) el.value = p[k];
      });
      if (title) title.textContent = 'Edit KC Patient';
    }
    global.openEmrModal('kcPatientModal');
  };

  global.saveKcPatient = async function () {
    const name = document.getElementById('kcFullName')?.value?.trim();
    if (!name) { alert('Full name is required.'); return; }
    const recordId = document.getElementById('kcRecordId')?.value;
    const row = {
      kcRegistryId: document.getElementById('kcRegistryId')?.value || nextLocalKcId(),
      kcFullName: name,
      kcAge: document.getElementById('kcAge')?.value,
      kcGender: document.getElementById('kcGender')?.value,
      kcPhone: document.getElementById('kcPhone')?.value,
      kcEmrPatientMrn: document.getElementById('kcEmrPatientMrn')?.value?.trim(),
      kcEyeInvolvement: document.getElementById('kcEyeInvolvement')?.value,
      kcDiagnosis: document.getElementById('kcDiagnosis')?.value || 'Keratoconus',
      kcStaging: document.getElementById('kcStaging')?.value,
      kcIndexDate: document.getElementById('kcIndexDate')?.value,
      kcFamilyHistoryKc: document.getElementById('kcFamilyHistoryKc')?.value,
      kcAtopy: document.getElementById('kcAtopy')?.value,
      kcEyeRubbing: document.getElementById('kcEyeRubbing')?.value,
      kcStatus: document.getElementById('kcStatus')?.value || 'Active',
      kcProgressionStatus: 'None',
      kcNotes: document.getElementById('kcNotes')?.value
    };
    if (recordId) {
      row.id = Number(recordId);
      const existing = _kcPatientsCache.find((p) => p.id === row.id);
      if (existing) {
        row.uuid = existing.uuid;
        row.revision = existing.revision;
        row.kcProgressionStatus = existing.kcProgressionStatus || 'None';
      }
    }
    const id = await kcDbPut(STORE_KC_PATIENTS, row);
    if (!row.id) row.id = id;

    if (apiEnabled() && row.uuid) {
      try {
        const res = await apiRequest(`/api/v1/kc-registry/${row.uuid}`, {
          method: 'PUT',
          body: JSON.stringify(patientToApi(row))
        });
        if (res?.data) {
          row.revision = res.data.revision;
          await kcDbPut(STORE_KC_PATIENTS, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Cloud sync failed:', err);
        alert('Saved on this device but cloud sync failed. Sign in to cloud and open KC & CXL again to retry.');
      }
    } else if (apiEnabled()) {
      try {
        const res = await apiRequest('/api/v1/kc-registry', {
          method: 'POST',
          body: JSON.stringify(patientToApi(row))
        });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          row.revision = res.data.revision;
          row.kcRegistryId = res.data.kcRegistryId || row.kcRegistryId;
          await kcDbPut(STORE_KC_PATIENTS, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Cloud create failed:', err);
        alert('Saved on this device only — cloud upload failed. Other devices will not see this patient until sync succeeds.');
      }
    }

    global.closeEmrModal('kcPatientModal');
    await refreshCaches();
    updateKcOverviewStats();
    renderKcPatientsTable();
    viewKcPatientDetail(row.id);
  };

  global.openKcTopoModal = function (mode, topoId) {
    document.getElementById('kcTopoRecordId').value = '';
    document.getElementById('kcTopoPatientId').value = global._kcSelectedPatientId || '';
    if (mode === 'new') {
      document.getElementById('kcTopoCapturedAt').value = new Date().toISOString().slice(0, 10);
      ['kcTopoEye', 'kcTopoDevice', 'kcTopoKmax', 'kcTopoKmean', 'kcTopoK1', 'kcTopoK2',
        'kcTopoThinnestPachy', 'kcTopoCentralPachy', 'kcTopoBadD', 'kcTopoAbcd',
        'kcTopoConeSeverity', 'kcTopoConeLocation', 'kcTopoNotes'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const pf = document.getElementById('kcTopoProgressionFlag');
      if (pf) pf.value = 'None';
    } else {
      const t = _kcTopoCache.find((x) => x.id === topoId);
      if (!t) return;
      document.getElementById('kcTopoRecordId').value = t.id;
      document.getElementById('kcTopoPatientId').value = t.kcPatientId;
      Object.keys(t).forEach((k) => {
        const el = document.getElementById(k);
        if (el && t[k] != null) el.value = t[k];
      });
    }
    global.openEmrModal('kcTopoModal');
  };

  global.saveKcTopo = async function () {
    const kcPatientId = Number(document.getElementById('kcTopoPatientId')?.value);
    const eye = document.getElementById('kcTopoEye')?.value;
    const capturedAt = document.getElementById('kcTopoCapturedAt')?.value;
    if (!kcPatientId || !eye || !capturedAt) { alert('Eye and capture date are required.'); return; }
    const row = {
      kcPatientId,
      kcTopoEye: eye,
      kcTopoCapturedAt: capturedAt,
      kcTopoDevice: document.getElementById('kcTopoDevice')?.value,
      kcTopoKmax: document.getElementById('kcTopoKmax')?.value,
      kcTopoKmean: document.getElementById('kcTopoKmean')?.value,
      kcTopoK1: document.getElementById('kcTopoK1')?.value,
      kcTopoK2: document.getElementById('kcTopoK2')?.value,
      kcTopoThinnestPachy: document.getElementById('kcTopoThinnestPachy')?.value,
      kcTopoCentralPachy: document.getElementById('kcTopoCentralPachy')?.value,
      kcTopoBadD: document.getElementById('kcTopoBadD')?.value,
      kcTopoAbcd: document.getElementById('kcTopoAbcd')?.value,
      kcTopoConeSeverity: document.getElementById('kcTopoConeSeverity')?.value,
      kcTopoConeLocation: document.getElementById('kcTopoConeLocation')?.value,
      kcTopoProgressionFlag: document.getElementById('kcTopoProgressionFlag')?.value || 'None',
      kcTopoNotes: document.getElementById('kcTopoNotes')?.value,
      source: 'manual'
    };
    const rid = document.getElementById('kcTopoRecordId')?.value;
    if (rid) row.id = Number(rid);
    try {
      await saveTopoRow(row, kcPatientId);
    } catch (err) {
      console.warn('[KC Registry] Topo save:', err);
    }

    await recomputeLocalProgression(kcPatientId);
    global.closeEmrModal('kcTopoModal');
    await refreshCaches();
    viewKcPatientDetail(kcPatientId);
    updateKcOverviewStats();
    renderKcPatientsTable();
  };

  global.openKcCxlModal = function (mode, cxlId) {
    document.getElementById('kcCxlRecordId').value = '';
    document.getElementById('kcCxlPatientId').value = global._kcSelectedPatientId || '';
    if (mode === 'new') {
      document.getElementById('kcCxlProcedureDate').value = new Date().toISOString().slice(0, 10);
      const outcome = document.getElementById('kcCxlOutcome');
      if (outcome) outcome.value = 'Pending';
    } else {
      const c = _kcCxlCache.find((x) => x.id === cxlId);
      if (!c) return;
      document.getElementById('kcCxlRecordId').value = c.id;
      document.getElementById('kcCxlPatientId').value = c.kcPatientId;
      Object.keys(c).forEach((k) => {
        const el = document.getElementById(k);
        if (el && c[k] != null) {
          el.value = c[k] === true ? 'Yes' : (c[k] === false ? 'No' : c[k]);
        }
      });
    }
    global.openEmrModal('kcCxlModal');
  };

  global.saveKcCxl = async function () {
    const kcPatientId = Number(document.getElementById('kcCxlPatientId')?.value);
    const eye = document.getElementById('kcCxlEye')?.value;
    const procedureDate = document.getElementById('kcCxlProcedureDate')?.value;
    if (!kcPatientId || !eye || !procedureDate) { alert('Eye and procedure date are required.'); return; }
    const row = {
      kcPatientId,
      kcCxlEye: eye,
      kcCxlProcedureDate: procedureDate,
      kcCxlProtocol: document.getElementById('kcCxlProtocol')?.value,
      kcCxlEpiType: document.getElementById('kcCxlEpiType')?.value,
      kcCxlRiboflavinType: document.getElementById('kcCxlRiboflavinType')?.value,
      kcCxlRiboflavinDurationMin: document.getElementById('kcCxlRiboflavinDurationMin')?.value,
      kcCxlUvEnergy: document.getElementById('kcCxlUvEnergy')?.value,
      kcCxlUvDurationSec: document.getElementById('kcCxlUvDurationSec')?.value,
      kcCxlUvPower: document.getElementById('kcCxlUvPower')?.value,
      kcCxlIontophoresis: document.getElementById('kcCxlIontophoresis')?.value,
      kcCxlSurgeon: document.getElementById('kcCxlSurgeon')?.value,
      kcCxlPreKmax: document.getElementById('kcCxlPreKmax')?.value,
      kcCxlPreKmean: document.getElementById('kcCxlPreKmean')?.value,
      kcCxlPreThinnestPachy: document.getElementById('kcCxlPreThinnestPachy')?.value,
      kcCxlPostKmax3m: document.getElementById('kcCxlPostKmax3m')?.value,
      kcCxlPostKmax6m: document.getElementById('kcCxlPostKmax6m')?.value,
      kcCxlPostKmax12m: document.getElementById('kcCxlPostKmax12m')?.value,
      kcCxlPostKmean3m: document.getElementById('kcCxlPostKmean3m')?.value,
      kcCxlPostKmean6m: document.getElementById('kcCxlPostKmean6m')?.value,
      kcCxlPostKmean12m: document.getElementById('kcCxlPostKmean12m')?.value,
      kcCxlOutcome: document.getElementById('kcCxlOutcome')?.value || 'Pending',
      kcCxlComplications: document.getElementById('kcCxlComplications')?.value,
      kcCxlNotes: document.getElementById('kcCxlNotes')?.value
    };
    const rid = document.getElementById('kcCxlRecordId')?.value;
    if (rid) row.id = Number(rid);
    const id = await kcDbPut(STORE_KC_CXL, row);
    if (!row.id) row.id = id;

    const patient = _kcPatientsCache.find((p) => p.id === kcPatientId);
    if (apiEnabled() && patient?.uuid) {
      try {
        const method = rid && row.uuid ? 'PUT' : 'POST';
        const path = rid && row.uuid
          ? `/api/v1/kc-registry/${patient.uuid}/cxl/${row.uuid}`
          : `/api/v1/kc-registry/${patient.uuid}/cxl`;
        const res = await apiRequest(path, { method, body: JSON.stringify(cxlToApi(row)) });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          await kcDbPut(STORE_KC_CXL, row);
        }
      } catch (err) {
        console.warn('[KC Registry] CXL cloud sync failed:', err);
      }
    }

    if (patient && patient.kcStatus === 'Active') {
      patient.kcStatus = 'Post-CXL';
      await kcDbPut(STORE_KC_PATIENTS, patient);
    }

    global.closeEmrModal('kcCxlModal');
    await refreshCaches();
    viewKcPatientDetail(kcPatientId);
    updateKcOverviewStats();
    renderKcPatientsTable();
  };

  async function recomputeLocalProgression(kcPatientId) {
    const patient = _kcPatientsCache.find((p) => p.id === kcPatientId);
    if (!patient) return;
    const topo = topoForPatient(kcPatientId);
    const summary = global.CorneaKcCxlTaxonomy?.computeProgressionSummary?.(topo) || {};
    const parts = [];
    for (const eye of ['OD', 'OS']) {
      const s = summary[eye];
      if (s && /Progression/i.test(s.flag)) parts.push(`${s.flag} ${eye}`);
    }
    patient.kcProgressionStatus = parts.length ? parts.join('; ') : 'None';
    await kcDbPut(STORE_KC_PATIENTS, patient);
  }

  global.switchKcPanel = function (panelId) {
    document.querySelectorAll('#kcRegistryTab .kc-panel').forEach((p) => {
      p.classList.toggle('active', p.id === panelId);
    });
    document.querySelectorAll('#kcRegistryTab .kc-subnav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.kcPanel === panelId);
    });
  };

  global.filterKcPatientsTable = function () {
    renderKcPatientsTable();
  };

  global.exportKcPatientsCsv = function () {
    const headers = ['Registry ID', 'Name', 'Diagnosis', 'Eyes', 'Status', 'Progression', 'Index date', 'Phone', 'MRN'];
    const lines = _kcPatientsCache.map((r) =>
      [r.kcRegistryId, r.kcFullName, r.kcDiagnosis, r.kcEyeInvolvement, r.kcStatus,
        r.kcProgressionStatus, r.kcIndexDate, r.kcPhone, r.kcEmrPatientMrn]
        .map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kc-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  async function pushUnsyncedToCloud() {
    if (!apiEnabled()) return;
    for (const row of _kcPatientsCache.filter((p) => !p.uuid)) {
      try {
        const res = await apiRequest('/api/v1/kc-registry', {
          method: 'POST',
          body: JSON.stringify(patientToApi(row))
        });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          row.revision = res.data.revision;
          row.kcRegistryId = res.data.kcRegistryId || row.kcRegistryId;
          await kcDbPut(STORE_KC_PATIENTS, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Push local patient to cloud failed:', err);
      }
    }
    await refreshCaches();
    for (const row of _kcTopoCache.filter((t) => !t.uuid)) {
      const patient = _kcPatientsCache.find((p) => p.id === row.kcPatientId);
      if (!patient?.uuid) continue;
      try {
        const res = await apiRequest(`/api/v1/kc-registry/${patient.uuid}/topography`, {
          method: 'POST',
          body: JSON.stringify(topoToApi(row))
        });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          await kcDbPut(STORE_KC_TOPOGRAPHY, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Push topography to cloud failed:', err);
      }
    }
    await refreshCaches();
    for (const row of _kcCxlCache.filter((c) => !c.uuid)) {
      const patient = _kcPatientsCache.find((p) => p.id === row.kcPatientId);
      if (!patient?.uuid) continue;
      try {
        const res = await apiRequest(`/api/v1/kc-registry/${patient.uuid}/cxl`, {
          method: 'POST',
          body: JSON.stringify(cxlToApi(row))
        });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          await kcDbPut(STORE_KC_CXL, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Push CXL to cloud failed:', err);
      }
    }
  }

  async function pullFromCloud() {
    if (!apiEnabled()) return;
    try {
      const list = await apiRequest('/api/v1/kc-registry?limit=500');
      for (const remote of list?.data || []) {
        const local = _kcPatientsCache.find((p) => p.uuid === remote.id || p.kcRegistryId === remote.kcRegistryId);
        const row = {
          id: local?.id,
          uuid: remote.id,
          revision: remote.revision,
          kcRegistryId: remote.kcRegistryId,
          kcFullName: remote.fullName,
          kcAge: remote.age,
          kcGender: remote.gender,
          kcPhone: remote.phone,
          kcEmrPatientMrn: remote.emrPatientMrn,
          kcEyeInvolvement: remote.eyeInvolvement,
          kcDiagnosis: remote.diagnosis,
          kcStaging: remote.staging,
          kcIndexDate: remote.indexDate,
          kcFamilyHistoryKc: remote.familyHistoryKc === true ? 'Yes' : (remote.familyHistoryKc === false ? 'No' : ''),
          kcAtopy: remote.atopy,
          kcEyeRubbing: remote.eyeRubbing,
          kcStatus: remote.status,
          kcProgressionStatus: remote.progressionStatus,
          kcNotes: remote.notes
        };
        const id = await kcDbPut(STORE_KC_PATIENTS, row);
        if (!row.id) row.id = id;

        const detail = await apiRequest(`/api/v1/kc-registry/${remote.id}`);
        const d = detail?.data || {};
        for (const rt of d.topographyReadings || []) {
          const lt = _kcTopoCache.find((t) => t.uuid === rt.id);
          await kcDbPut(STORE_KC_TOPOGRAPHY, {
            id: lt?.id,
            uuid: rt.id,
            kcPatientId: row.id,
            kcTopoEye: rt.eye,
            kcTopoCapturedAt: rt.capturedAt,
            kcTopoDevice: rt.device,
            kcTopoKmax: rt.kmax,
            kcTopoKmean: rt.kmean,
            kcTopoK1: rt.k1,
            kcTopoK2: rt.k2,
            kcTopoThinnestPachy: rt.thinnestPachy,
            kcTopoCentralPachy: rt.centralPachy,
            kcTopoBadD: rt.badD,
            kcTopoAbcd: rt.abcd,
            kcTopoConeSeverity: rt.coneSeverity,
            kcTopoConeLocation: rt.coneLocation,
            kcTopoProgressionFlag: rt.progressionFlag,
            kcTopoNotes: rt.notes,
            source: rt.source
          });
        }
        for (const rc of d.cxlProcedures || []) {
          const lc = _kcCxlCache.find((c) => c.uuid === rc.id);
          await kcDbPut(STORE_KC_CXL, {
            id: lc?.id,
            uuid: rc.id,
            kcPatientId: row.id,
            kcCxlEye: rc.eye,
            kcCxlProcedureDate: rc.procedureDate,
            kcCxlProtocol: rc.protocol,
            kcCxlEpiType: rc.epiType,
            kcCxlRiboflavinType: rc.riboflavinType,
            kcCxlRiboflavinDurationMin: rc.riboflavinDurationMin,
            kcCxlUvEnergy: rc.uvEnergyJCm2,
            kcCxlUvDurationSec: rc.uvDurationSec,
            kcCxlUvPower: rc.uvPowerMwCm2,
            kcCxlIontophoresis: rc.iontophoresis === true ? 'Yes' : (rc.iontophoresis === false ? 'No' : ''),
            kcCxlSurgeon: rc.surgeon,
            kcCxlPreKmax: rc.preKmax,
            kcCxlPreKmean: rc.preKmean,
            kcCxlPreThinnestPachy: rc.preThinnestPachy,
            kcCxlPostKmax3m: rc.postKmax3m,
            kcCxlPostKmax6m: rc.postKmax6m,
            kcCxlPostKmax12m: rc.postKmax12m,
            kcCxlPostKmean3m: rc.postKmean3m,
            kcCxlPostKmean6m: rc.postKmean6m,
            kcCxlPostKmean12m: rc.postKmean12m,
            kcCxlOutcome: rc.outcome,
            kcCxlComplications: rc.complications,
            kcCxlNotes: rc.notes
          });
        }
      }
      await refreshCaches();
    } catch (err) {
      console.warn('[KC Registry] Cloud pull failed:', err);
    }
  }

  async function syncWithCloud() {
    if (!apiEnabled() || !global.db) return;
    await refreshCaches();
    await pushUnsyncedToCloud();
    await refreshCaches();
    await pullFromCloud();
    await refreshCaches();
  }

  function refreshUi() {
    updateKcOverviewStats();
    renderKcPatientsTable();
    if (global._kcSelectedPatientId) {
      const p = _kcPatientsCache.find((x) => x.id === global._kcSelectedPatientId);
      if (p) renderKcPatientDetail(p);
    }
  }

  async function saveTopoRow(row, kcPatientId) {
    row.kcPatientId = kcPatientId;
    const id = await kcDbPut(STORE_KC_TOPOGRAPHY, row);
    if (!row.id) row.id = id;

    const patient = _kcPatientsCache.find((p) => p.id === kcPatientId);
    if (apiEnabled() && patient?.uuid) {
      try {
        const path = row.uuid
          ? `/api/v1/kc-registry/${patient.uuid}/topography/${row.uuid}`
          : `/api/v1/kc-registry/${patient.uuid}/topography`;
        const method = row.uuid ? 'PUT' : 'POST';
        const res = await apiRequest(path, { method, body: JSON.stringify(topoToApi(row)) });
        if (res?.data?.id) {
          row.uuid = res.data.id;
          await kcDbPut(STORE_KC_TOPOGRAPHY, row);
        }
      } catch (err) {
        console.warn('[KC Registry] Topo cloud sync failed:', err);
        throw err;
      }
    }
    return row;
  }

  let _topoImportReadings = [];
  let _topoImportMode = 'kc';
  let _topoImportDevice = 'pentacam';

  function topoImportApi() {
    return global.CorneaTopographyImport || global.CorneaPentacamImport;
  }

  function parseTopoImportFile(text, device) {
    const api = topoImportApi();
    if (!api) return null;
    if (device === 'sirius') return api.parseSiriusCsv?.(text) || api.parseTopographyCsv?.(text, { device: 'Sirius' });
    if (device === 'pentacam') return api.parsePentacamCsv?.(text) || api.parseTopographyCsv?.(text, { device: 'Pentacam' });
    return api.parseTopographyCsv?.(text, { device: 'auto' }) || api.parsePentacamCsv?.(text);
  }

  function resetTopoImportModal(mode, device) {
    _topoImportMode = mode;
    _topoImportDevice = device || 'pentacam';
    _topoImportReadings = [];
    const isSirius = _topoImportDevice === 'sirius';
    const preview = document.getElementById('topoImportPreview');
    if (preview) {
      preview.innerHTML = isSirius
        ? '<p class="text-muted">Choose a Sirius / CSO Phoenix indices CSV export.</p>'
        : '<p class="text-muted">Choose a Pentacam CSV file (chamber.csv, BAD.CSV, or export).</p>';
    }
    const fileInput = document.getElementById('topoImportFile');
    if (fileInput) fileInput.value = '';
    const laserChk = document.getElementById('topoImportToLaser');
    const laserRow = document.getElementById('topoImportLaserRow');
    if (laserChk) laserChk.checked = mode === 'laser';
    if (laserRow) laserRow.hidden = mode === 'laser';
    const title = document.getElementById('topoImportModalTitle');
    const hint = document.getElementById('topoImportHint');
    const deviceLabel = isSirius ? 'Sirius / CSO Phoenix CSV' : 'Pentacam CSV';
    if (title) {
      title.textContent = mode === 'laser'
        ? `Import ${deviceLabel} — Laser work-up`
        : `Import ${deviceLabel} — KC registry`;
    }
    if (hint) {
      hint.innerHTML = isSirius
        ? 'Supports <strong>CSO Phoenix indices export</strong> (comma, semicolon, or tab). Maps Kmax, Kmean, pachymetry, elevations, and Sirius screening indices (ISV, IVA, CKI).'
        : 'Supports Pentacam <strong>chamber.csv</strong>, <strong>BAD.CSV</strong>, and common exports (comma or semicolon). Maps Kmax, Kmean, pachymetry, BAD-D, and ABCD to topography fields.';
    }
  }

  function openTopoImportModal(mode, device) {
    resetTopoImportModal(mode, device);
    global.openEmrModal('topoImportModal');
  }

  global.openKcPentacamImport = function () {
    const kcPatientId = global._kcSelectedPatientId;
    if (!kcPatientId) {
      alert('Select a KC registry patient first (Open a patient from the list).');
      return;
    }
    openTopoImportModal('kc', 'pentacam');
  };

  global.openKcSiriusImport = function () {
    const kcPatientId = global._kcSelectedPatientId;
    if (!kcPatientId) {
      alert('Select a KC registry patient first (Open a patient from the list).');
      return;
    }
    openTopoImportModal('kc', 'sirius');
  };

  global.openLaserPentacamImport = function () {
    if (document.getElementById('section-laser-refractive')?.hidden) {
      global.CorneaLaserRefractive?.toggleSection?.(true);
    }
    openTopoImportModal('laser', 'pentacam');
  };

  global.openLaserSiriusImport = function () {
    if (document.getElementById('section-laser-refractive')?.hidden) {
      global.CorneaLaserRefractive?.toggleSection?.(true);
    }
    openTopoImportModal('laser', 'sirius');
  };

  global.onTopoImportFileSelected = async function (input) {
    const file = input?.files?.[0];
    const preview = document.getElementById('topoImportPreview');
    if (!file || !preview) return;
    try {
      const text = await file.text();
      const result = parseTopoImportFile(text, _topoImportDevice);
      if (!result) {
        preview.innerHTML = '<p class="text-muted">Topography import module not loaded.</p>';
        return;
      }
      _topoImportReadings = result.readings || [];
      if (!_topoImportReadings.length) {
        preview.innerHTML = `<p class="text-muted">No topography readings found. ${(result.warnings || []).join(' ')}</p>`;
        return;
      }
      const importer = topoImportApi();
      const warn = (result.warnings || []).length
        ? `<p class="form-hint">${global.escapeHtml?.(result.warnings.join('; ')) || result.warnings.join('; ')}</p>`
        : '';
      const rows = _topoImportReadings.map((r, i) => {
        const p = importer.formatPreviewRow(r);
        return `<tr>
          <td><input type="checkbox" class="topo-import-row" data-idx="${i}" checked /></td>
          <td>${p.eye}</td><td>${p.date}</td><td>${p.device}</td><td>${p.kmax}</td><td>${p.kmean}</td>
          <td>${p.pachyMin}</td><td>${p.badD}</td><td>${global.escapeHtml?.(p.patient) || p.patient}</td>
        </tr>`;
      }).join('');
      preview.innerHTML = `${warn}<p class="form-hint">Detected ${result.device || _topoImportDevice} · ${result.format} format · ${result.readings.length} reading(s)</p>
        <div class="table-scroll"><table class="records-table">
          <thead><tr><th></th><th>Eye</th><th>Date</th><th>Device</th><th>Kmax</th><th>Kmean</th><th>Pachy min</th><th>BAD-D/CKI</th><th>Patient</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    } catch (err) {
      preview.innerHTML = `<p class="text-muted">Failed to read file: ${global.escapeHtml?.(err.message) || err.message}</p>`;
    }
  };

  global.onPentacamFileSelected = global.onTopoImportFileSelected;

  global.commitKcTopoImport = async function () {
    const checks = document.querySelectorAll('.topo-import-row:checked');
    const indices = [...checks].map((el) => Number(el.dataset.idx));
    if (!indices.length) { alert('Select at least one reading to import.'); return; }
    const selected = indices.map((i) => _topoImportReadings[i]).filter(Boolean);
    const importer = topoImportApi();

    if (_topoImportMode === 'laser') {
      const n = global.CorneaLaserRefractive?.applyTopoReadings?.(selected)
        || global.CorneaLaserRefractive?.applyPentacamReadings?.(selected)
        || 0;
      global.closeEmrModal('topoImportModal');
      alert(n ? `Applied ${n} topography reading(s) to laser refractive work-up.` : 'Import failed.');
      return;
    }

    const kcPatientId = global._kcSelectedPatientId;
    if (!kcPatientId) { alert('No KC patient selected.'); return; }

    let imported = 0;
    let cloudErrors = 0;

    for (const reading of selected) {
      const row = importer.toKcTopoRow(reading, kcPatientId);
      try {
        await saveTopoRow(row, kcPatientId);
        imported++;
      } catch (_) {
        cloudErrors++;
      }
    }

    if (document.getElementById('topoImportToLaser')?.checked) {
      global.CorneaLaserRefractive?.applyTopoReadings?.(selected)
        || global.CorneaLaserRefractive?.applyPentacamReadings?.(selected);
    }

    await recomputeLocalProgression(kcPatientId);
    global.closeEmrModal('topoImportModal');
    await refreshCaches();
    viewKcPatientDetail(kcPatientId);
    updateKcOverviewStats();
    renderKcPatientsTable();

    const deviceName = selected[0]?.device || 'Topography';
    let msg = `Imported ${imported} ${deviceName} reading(s) into KC registry.`;
    if (cloudErrors) msg += ` ${cloudErrors} failed to sync to cloud (saved locally).`;
    alert(msg);
  };

  global.commitKcPentacamImport = global.commitKcTopoImport;

  global.CorneaKcCxl = {
    STORE_KC_PATIENTS,
    STORE_KC_TOPOGRAPHY,
    STORE_KC_CXL,

    ensureStores(db, event) {
      if (!db.objectStoreNames.contains(STORE_KC_PATIENTS)) {
        const s = db.createObjectStore(STORE_KC_PATIENTS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('kcRegistryId', 'kcRegistryId', { unique: true });
        s.createIndex('kcStatus', 'kcStatus', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KC_TOPOGRAPHY)) {
        const s = db.createObjectStore(STORE_KC_TOPOGRAPHY, { keyPath: 'id', autoIncrement: true });
        s.createIndex('kcPatientId', 'kcPatientId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KC_CXL)) {
        const s = db.createObjectStore(STORE_KC_CXL, { keyPath: 'id', autoIncrement: true });
        s.createIndex('kcPatientId', 'kcPatientId', { unique: false });
      }
    },

    syncWithCloud,
    refreshUi,

    async init() {
      if (!global.db) return;
      if (apiEnabled()) await syncWithCloud();
      else await refreshCaches();
      refreshUi();
    },

    openLinkedModule(which) {
      const p = _kcPatientsCache.find((x) => x.id === global._kcSelectedPatientId);
      if (p?.kcEmrPatientMrn && typeof global.loadRecord === 'function') {
        global.loadRecord(p.kcEmrPatientMrn).catch(() => {});
      }
      global.switchTab?.('formTab');
      if (which === 'scleral' && global.CorneaScleralLens) {
        global.CorneaScleralLens.show?.();
      }
      if (which === 'laser' && global.CorneaLaserRefractive) {
        global.CorneaLaserRefractive.show?.();
      }
    },

    openClinicalMedia(mrn) {
      global.switchTab?.('clinicalMediaTab');
      const input = document.getElementById('clinicalMediaPatientSearch');
      if (input && mrn) {
        input.value = mrn;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (global.CorneaClinicalMedia?.setCategoryFilter) {
        global.CorneaClinicalMedia.setCategoryFilter('topography');
      }
    },

    async importFromCurrentVisit() {
      const kcPatientId = global._kcSelectedPatientId;
      if (!kcPatientId) return;
      let laserJson = null;
      try {
        const raw = document.getElementById('laserRefractiveJSON')?.value;
        if (raw) laserJson = JSON.parse(raw);
      } catch (_) { /* ignore */ }
      if (!laserJson && global.CorneaLaserRefractive?.collectWorkup) {
        laserJson = { workup: global.CorneaLaserRefractive.collectWorkup() };
      }
      const extracted = global.CorneaKcCxlTaxonomy?.extractTopoFromLaserWorkup?.(laserJson) || [];
      if (!extracted.length) {
        alert('No topography data found in the current visit laser module. Open a patient visit with laser work-up data first.');
        return;
      }
      for (const t of extracted) {
        t.kcPatientId = kcPatientId;
        await kcDbPut(STORE_KC_TOPOGRAPHY, t);
      }
      await recomputeLocalProgression(kcPatientId);
      await refreshCaches();
      viewKcPatientDetail(kcPatientId);
      alert(`Imported ${extracted.length} topography reading(s) from visit.`);
    }
  };

  global.initKcRegistry = () => global.CorneaKcCxl.init();
})(typeof window !== 'undefined' ? window : globalThis);
