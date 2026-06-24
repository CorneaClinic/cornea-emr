/**
 * KP graft outcomes — post-graft exams & rejection episodes (Project 5)
 */
(function (global) {
  'use strict';

  const STORE_EXAMS = 'kpGraftExams';
  const STORE_REJECTIONS = 'kpRejections';
  let _exams = [];
  let _rejections = [];

  function dbGetAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function dbPut(store, data) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([store], 'readwrite').objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  async function api(path, options) {
    return global.CorneaApi.request(path, options);
  }

  async function refresh() {
    _exams = await dbGetAll(STORE_EXAMS);
    _rejections = await dbGetAll(STORE_REJECTIONS);
  }

  function examsForKp(kpLocalId) {
    return _exams.filter((e) => e.kpPatientId === kpLocalId).sort((a, b) => String(b.kpExamDate).localeCompare(String(a.kpExamDate)));
  }

  function rejectionsForKp(kpLocalId) {
    return _rejections.filter((r) => r.kpPatientId === kpLocalId).sort((a, b) => String(b.kpRejOnset).localeCompare(String(a.kpRejOnset)));
  }

  function renderEcdTrend(kpLocalId) {
    const el = document.getElementById('kpGraftEcdTrend');
    if (!el) return;
    const series = examsForKp(kpLocalId).filter((e) => e.kpExamEcd != null);
    if (series.length < 2) {
      el.innerHTML = '<p class="text-muted">Add at least two exams with endothelial count to see ECD trend.</p>';
      return;
    }
    const min = Math.min(...series.map((s) => Number(s.kpExamEcd)));
    const max = Math.max(...series.map((s) => Number(s.kpExamEcd)));
    const range = max - min || 1;
    el.innerHTML = `<div class="kp-ecd-chart">${series.map((s) => {
      const h = Math.round(((Number(s.kpExamEcd) - min) / range) * 80) + 20;
      return `<div class="kp-ecd-bar" title="${s.kpExamDate}: ${s.kpExamEcd} cells/mm²"><span style="height:${h}px"></span><small>${s.kpExamDate?.slice(5) || ''}</small></div>`;
    }).join('')}</div>`;
  }

  global.renderKpGraftOutcomes = async function (kpLocalId, kpUuid) {
    await refresh();
    const examBody = document.getElementById('kpGraftExamsBody');
    const rejBody = document.getElementById('kpGraftRejectionsBody');
    if (!examBody || !rejBody) return;

    const exams = examsForKp(kpLocalId);
    examBody.innerHTML = exams.length ? exams.map((e) => `<tr>
      <td>${e.kpExamDate || ''}</td><td>${e.kpExamEye || ''}</td><td>${e.kpExamEcd ?? '—'}</td>
      <td>${e.kpExamClarity || '—'}</td><td>${e.kpExamIop ?? '—'}</td><td>${e.kpExamBcva || '—'}</td>
      <td>${e.kpExamInterval || '—'}</td></tr>`).join('')
      : '<tr><td colspan="7" class="text-muted">No post-graft exams yet.</td></tr>';

    const rejs = rejectionsForKp(kpLocalId);
    rejBody.innerHTML = rejs.length ? rejs.map((r) => `<tr>
      <td>${r.kpRejOnset || ''}</td><td>${r.kpRejEye || ''}</td><td>${r.kpRejType || r.kpRejGrade || '—'}</td>
      <td>${r.kpRejOutcome || ''}</td><td>${r.kpRejResolved || '—'}</td><td>${r.kpRejTreatment || '—'}</td></tr>`).join('')
      : '<tr><td colspan="6" class="text-muted">No rejection episodes recorded.</td></tr>';

    renderEcdTrend(kpLocalId);

    if (apiOn() && kpUuid) {
      try {
        await api(`/api/v1/keratoplasty-patients/${kpUuid}/graft-exams`);
        await api(`/api/v1/keratoplasty-patients/${kpUuid}/rejections`);
      } catch (_) { /* local cache is primary */ }
    }
  };

  global.openKpGraftExamModal = function () {
    if (!global._kpSelectedPatientId) { alert('Select a KP patient first.'); return; }
    document.getElementById('kpGraftExamPatientId').value = global._kpSelectedPatientId;
    document.getElementById('kpGraftExamDate').value = new Date().toISOString().slice(0, 10);
    global.openEmrModal('kpGraftExamModal');
  };

  global.saveKpGraftExam = async function () {
    const kpPatientId = Number(document.getElementById('kpGraftExamPatientId')?.value);
    const row = {
      kpPatientId,
      kpExamEye: document.getElementById('kpGraftExamEye')?.value,
      kpExamDate: document.getElementById('kpGraftExamDate')?.value,
      kpExamInterval: document.getElementById('kpGraftExamInterval')?.value,
      kpExamBcva: document.getElementById('kpGraftExamBcva')?.value,
      kpExamIop: document.getElementById('kpGraftExamIop')?.value,
      kpExamEcd: document.getElementById('kpGraftExamEcd')?.value,
      kpExamClarity: document.getElementById('kpGraftExamClarity')?.value,
      kpExamMeds: document.getElementById('kpGraftExamMeds')?.value,
      kpExamNotes: document.getElementById('kpGraftExamNotes')?.value
    };
    if (!row.kpPatientId || !row.kpExamEye || !row.kpExamDate) { alert('Eye and exam date are required.'); return; }
    await dbPut(STORE_EXAMS, row);

    const kp = (global._kpPatientsCache || []).find((p) => p.id === kpPatientId);
    if (apiOn() && kp?.uuid) {
      try {
        const res = await api(`/api/v1/keratoplasty-patients/${kp.uuid}/graft-exams`, {
          method: 'POST',
          body: JSON.stringify({
            eye: row.kpExamEye,
            examDate: row.kpExamDate,
            postOpInterval: row.kpExamInterval,
            bcva: row.kpExamBcva,
            iop: row.kpExamIop ? Number(row.kpExamIop) : null,
            endothelialCount: row.kpExamEcd ? parseInt(row.kpExamEcd, 10) : null,
            graftClarity: row.kpExamClarity,
            medications: row.kpExamMeds,
            notes: row.kpExamNotes
          })
        });
        if (res?.data?.id) { row.uuid = res.data.id; await dbPut(STORE_EXAMS, row); }
      } catch (err) {
        console.warn('[KP Graft] Cloud sync failed:', err);
      }
    }

    global.closeEmrModal('kpGraftExamModal');
    await global.renderKpGraftOutcomes(kpPatientId, kp?.uuid);
  };

  global.openKpRejectionModal = function () {
    if (!global._kpSelectedPatientId) { alert('Select a KP patient first.'); return; }
    document.getElementById('kpRejPatientId').value = global._kpSelectedPatientId;
    document.getElementById('kpRejOnset').value = new Date().toISOString().slice(0, 10);
    global.openEmrModal('kpRejectionModal');
  };

  global.saveKpRejection = async function () {
    const kpPatientId = Number(document.getElementById('kpRejPatientId')?.value);
    const row = {
      kpPatientId,
      kpRejEye: document.getElementById('kpRejEye')?.value,
      kpRejOnset: document.getElementById('kpRejOnset')?.value,
      kpRejType: document.getElementById('kpRejType')?.value,
      kpRejGrade: document.getElementById('kpRejGrade')?.value,
      kpRejOutcome: document.getElementById('kpRejOutcome')?.value || 'Active',
      kpRejResolved: document.getElementById('kpRejResolved')?.value,
      kpRejTreatment: document.getElementById('kpRejTreatment')?.value,
      kpRejNotes: document.getElementById('kpRejNotes')?.value
    };
    if (!row.kpPatientId || !row.kpRejEye || !row.kpRejOnset) { alert('Eye and onset date are required.'); return; }
    await dbPut(STORE_REJECTIONS, row);

    const kp = (global._kpPatientsCache || []).find((p) => p.id === kpPatientId);
    if (apiOn() && kp?.uuid) {
      try {
        const res = await api(`/api/v1/keratoplasty-patients/${kp.uuid}/rejections`, {
          method: 'POST',
          body: JSON.stringify({
            eye: row.kpRejEye,
            onsetDate: row.kpRejOnset,
            rejectionType: row.kpRejType,
            rejectionGrade: row.kpRejGrade,
            outcome: row.kpRejOutcome,
            resolvedDate: row.kpRejResolved || null,
            treatment: row.kpRejTreatment,
            notes: row.kpRejNotes
          })
        });
        if (res?.data?.id) { row.uuid = res.data.id; await dbPut(STORE_REJECTIONS, row); }
      } catch (err) {
        console.warn('[KP Graft] Rejection cloud sync failed:', err);
      }
    }

    global.closeEmrModal('kpRejectionModal');
    await global.renderKpGraftOutcomes(kpPatientId, kp?.uuid);
  };

  global.CorneaKpGraftOutcomes = {
    STORE_EXAMS,
    STORE_REJECTIONS,
    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_EXAMS)) {
        const s = db.createObjectStore(STORE_EXAMS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('kpPatientId', 'kpPatientId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_REJECTIONS)) {
        const s = db.createObjectStore(STORE_REJECTIONS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('kpPatientId', 'kpPatientId', { unique: false });
      }
    },
    async syncFromCloud() {
      if (!apiOn()) return;
      try {
        const list = await api('/api/v1/keratoplasty-patients?limit=200&status=Completed');
        for (const kp of list?.data || []) {
          const local = (global._kpPatientsCache || []).find((p) => p.uuid === kp.id || p.kpPatientId === kp.kpPatientId);
          if (!local?.uuid) continue;
          const detail = await api(`/api/v1/keratoplasty-patients/${kp.id}`);
          const exams = await api(`/api/v1/keratoplasty-patients/${kp.id}/graft-exams`);
          const rejs = await api(`/api/v1/keratoplasty-patients/${kp.id}/rejections`);
          for (const e of exams?.data || []) {
            await dbPut(STORE_EXAMS, {
              kpPatientId: local.id,
              uuid: e.id,
              kpExamEye: e.eye,
              kpExamDate: e.examDate,
              kpExamInterval: e.postOpInterval,
              kpExamBcva: e.bcva,
              kpExamIop: e.iop,
              kpExamEcd: e.endothelialCount,
              kpExamClarity: e.graftClarity,
              kpExamMeds: e.medications,
              kpExamNotes: e.notes
            });
          }
          for (const r of rejs?.data || []) {
            await dbPut(STORE_REJECTIONS, {
              kpPatientId: local.id,
              uuid: r.id,
              kpRejEye: r.eye,
              kpRejOnset: r.onsetDate,
              kpRejType: r.rejectionType,
              kpRejGrade: r.rejectionGrade,
              kpRejOutcome: r.outcome,
              kpRejResolved: r.resolvedDate,
              kpRejTreatment: r.treatment,
              kpRejNotes: r.notes
            });
          }
        }
      } catch (err) {
        console.warn('[KP Graft] Cloud pull failed:', err);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
