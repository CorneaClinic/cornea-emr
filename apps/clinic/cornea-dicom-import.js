/**
 * DICOM / PACS ingest prototype (P6) — parse metadata and store in clinical media library.
 */
(function (global) {
  'use strict';

  let _preview = null;
  let _file = null;

  function esc(s) {
    return global.escapeHtml ? global.escapeHtml(s) : String(s ?? '');
  }

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function getBaseUrl() {
    return global.CorneaApi?.getBaseUrl?.() || global.CorneaAuthEnv?.getApiBaseUrl?.() || '';
  }

  function getToken() {
    return global.CorneaApi?.getToken?.() || localStorage.getItem('corneaEmr_apiToken') || '';
  }

  async function apiForm(path, formData) {
    const base = getBaseUrl();
    const token = getToken();
    if (!base || !token) throw new Error('Cloud sign-in required');
    const res = await fetch(`${base}/api/v1${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.message || `Request failed (${res.status})`);
    }
    return json;
  }

  function renderPreview(data) {
    const el = document.getElementById('dicomImportPreview');
    if (!el) return;
    if (!data) {
      el.innerHTML = '<p class="text-muted">No file selected.</p>';
      return;
    }
    const t = data.tags || {};
    const rows = [
      ['Patient', t.patientName || '—'],
      ['Patient ID', t.patientId || '—'],
      ['Study date', t.studyDate || '—'],
      ['Modality', t.modality || '—'],
      ['Study', t.studyDescription || '—'],
      ['Series', t.seriesDescription || '—'],
      ['Device', [t.manufacturer, t.manufacturerModel].filter(Boolean).join(' ') || '—'],
      ['Laterality', t.laterality || '—'],
      ['Suggested category', data.suggestedCategory || '—']
    ];
    el.innerHTML = `<table class="records-table"><tbody>${rows.map(([k, v]) =>
      `<tr><th style="width:38%;">${esc(k)}</th><td>${esc(v)}</td></tr>`
    ).join('')}</tbody></table>
    <p class="form-hint" style="margin-top:8px;">${esc(data.summary || '')}</p>`;

    const cat = document.getElementById('dicomImportCategory');
    if (cat && data.suggestedCategory) cat.value = data.suggestedCategory;
    const mrn = document.getElementById('dicomImportPatientMrn');
    if (mrn && t.patientId && !mrn.value) mrn.value = t.patientId;
  }

  async function resolveEntityId() {
    const entityType = document.getElementById('dicomImportEntityType')?.value || 'patient';
    const raw = document.getElementById('dicomImportEntityId')?.value?.trim();
    if (!raw) throw new Error('Patient / visit ID is required');
    if (/^[0-9a-f-]{36}$/i.test(raw)) return { entityType, entityId: raw };

    const base = getBaseUrl();
    const token = getToken();
    if (entityType === 'visit') {
      throw new Error('Enter the visit UUID for visit-level ingest, or use patient MRN with patient entity.');
    }
    const res = await fetch(`${base}/api/v1/patients?search=${encodeURIComponent(raw)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    const match = (json.data || []).find((p) => p.mrn === raw || p.fullName === raw || String(p.legacyLocalId) === raw);
    if (!match?.id) throw new Error('Patient not found in cloud — sync patient first.');
    return { entityType: 'patient', entityId: match.id };
  }

  global.CorneaDicomImport = {
    open() {
      _preview = null;
      _file = null;
      const fileInput = document.getElementById('dicomImportFile');
      if (fileInput) fileInput.value = '';
      const patientField = document.getElementById('dicomImportEntityId');
      if (patientField && !patientField.value) {
        patientField.value = document.getElementById('patientId')?.value?.trim() || '';
      }
      renderPreview(null);
      global.openEmrModal?.('dicomImportModal');
    },
    async onFileSelected(input) {
      const file = input?.files?.[0];
      _file = file || null;
      _preview = null;
      if (!file) {
        renderPreview(null);
        return;
      }
      if (!apiOn() || global.navigator.onLine === false) {
        alert('DICOM parse requires cloud sign-in and internet connection.');
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await apiForm('/dicom/parse', fd);
        _preview = res.data;
        renderPreview(_preview);
      } catch (err) {
        renderPreview(null);
        alert(err.message || 'DICOM parse failed');
      }
    },
    async ingest() {
      if (!_file) {
        alert('Select a DICOM file first.');
        return;
      }
      const category = document.getElementById('dicomImportCategory')?.value || _preview?.suggestedCategory || 'other';
      const eye = document.getElementById('dicomImportEye')?.value || '';
      const label = document.getElementById('dicomImportLabel')?.value?.trim() || '';
      let entity;
      try {
        entity = await resolveEntityId();
      } catch (err) {
        alert(err.message);
        return;
      }
      const fd = new FormData();
      fd.append('file', _file);
      fd.append('entityType', entity.entityType);
      fd.append('entityId', entity.entityId);
      fd.append('category', category);
      if (eye) fd.append('eye', eye);
      if (label) fd.append('label', label);
      try {
        await apiForm('/dicom/ingest', fd);
        global.closeEmrModal?.('dicomImportModal');
        alert('DICOM study ingested to clinical media library.');
        global.CorneaClinicalMedia?.loadLibrary?.().catch(() => {});
        global.CorneaClinicalMedia?.loadTimeline?.().catch(() => {});
      } catch (err) {
        alert(err.message || 'DICOM ingest failed');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
