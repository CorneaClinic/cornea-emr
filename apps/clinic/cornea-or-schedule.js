/**
 * OR scheduling prototype (P7) — corneal surgery theatre day list
 */
(function (global) {
  'use strict';

  const STORE_OR = 'orScheduleCases';
  let _cases = [];
  let _selectedDate = new Date().toISOString().slice(0, 10);

  function esc(s) { return global.escapeHtml ? global.escapeHtml(s) : String(s ?? ''); }
  function apiOn() { return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.(); }
  function api(p, o) { return global.CorneaApi.request(p, o); }

  function guardCloudRegistryWrite(label) {
    return global.CorneaRegistryOnline?.guardCloudWrite(apiOn(), label || 'OR theatre schedule') !== false;
  }

  let _orOfflineUiBound = false;
  function bindOrOfflineUi() {
    if (_orOfflineUiBound) {
      global.CorneaRegistryOnline?.refresh('or');
      return;
    }
    _orOfflineUiBound = true;
    global.CorneaRegistryOnline?.bindRegistryOfflineUi('or', {
      bannerId: 'orScheduleOfflineBanner',
      registryLabel: 'OR theatre schedule',
      writeSelectors: [
        '#apptOrPanel .btn-primary',
        '#apptOrPanel button[data-or-id]',
        '#orCaseModal .btn-primary'
      ]
    });
  }

  function dbAll() {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([STORE_OR], 'readonly').objectStore(STORE_OR).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function dbPut(row) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([STORE_OR], 'readwrite').objectStore(STORE_OR).put(row);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function statusBadge(status) {
    const cls = { scheduled: 'badge-waiting', confirmed: 'badge-matched', in_progress: 'badge-scheduled', completed: 'badge-completed', cancelled: 'badge-cancelled' }[status] || 'badge-waiting';
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }

  function renderTable() {
    const body = document.getElementById('orScheduleBody');
    if (!body) return;
    const rows = _cases.filter((c) => c.procedureDate === _selectedDate && c.status !== 'cancelled');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-muted">No OR cases for this day.</td></tr>';
      return;
    }
    body.innerHTML = rows.map((c) => `<tr>
      <td>${esc(c.startTime || '—')}</td>
      <td><strong>${esc(c.patientName)}</strong><br><span class="form-hint">${esc(c.caseNumber)}</span></td>
      <td>${esc(c.procedureType)}</td>
      <td>${esc(c.surgeonName || '—')}</td>
      <td>${esc(c.theatre || '—')}</td>
      <td>${statusBadge(c.status)}</td>
      <td class="no-print">
        ${c.id ? `<button type="button" class="btn-secondary btn-sm" data-or-id="${esc(c.id)}" onclick="CorneaOrSchedule.markInProgress(this.dataset.orId)">Start</button>` : ''}
      </td>
    </tr>`).join('');
  }

  async function loadDay(dateStr) {
    bindOrOfflineUi();
    _selectedDate = dateStr || _selectedDate;
    const picker = document.getElementById('orDatePicker');
    if (picker) picker.value = _selectedDate;

    if (apiOn() && global.navigator.onLine !== false) {
      try {
        const res = await api(`/api/v1/or-schedule/day/${encodeURIComponent(_selectedDate)}`);
        _cases = res?.data || [];
        renderTable();
        return;
      } catch (err) {
        console.warn('[OR] Cloud load failed:', err);
      }
    }
    _cases = (await dbAll()).filter((c) => c.procedureDate === _selectedDate);
    renderTable();
  }

  global.CorneaOrSchedule = {
    STORE_OR,
    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_OR)) {
        const s = db.createObjectStore(STORE_OR, { keyPath: 'localId', autoIncrement: true });
        s.createIndex('procedureDate', 'procedureDate', { unique: false });
      }
    },
    refreshDay() {
      return loadDay(document.getElementById('orDatePicker')?.value || _selectedDate);
    },
    openNew() {
      document.getElementById('orRecordId').value = '';
      document.getElementById('orRevision').value = '';
      document.getElementById('orPatientName').value = '';
      document.getElementById('orPatientMrn').value = document.getElementById('patientId')?.value || '';
      document.getElementById('orDate').value = _selectedDate;
      document.getElementById('orStartTime').value = '08:00';
      document.getElementById('orDuration').value = '60';
      document.getElementById('orProcedureType').value = 'DALK';
      document.getElementById('orSurgeon').value = '';
      document.getElementById('orTheatre').value = 'OR-1';
      document.getElementById('orNotes').value = '';
      global.openEmrModal('orCaseModal');
    },
    async save() {
      if (!guardCloudRegistryWrite()) return;
      const payload = {
        patientName: document.getElementById('orPatientName')?.value?.trim(),
        patientMrn: document.getElementById('orPatientMrn')?.value?.trim(),
        procedureDate: document.getElementById('orDate')?.value,
        startTime: document.getElementById('orStartTime')?.value,
        durationMinutes: Number(document.getElementById('orDuration')?.value) || 60,
        procedureType: document.getElementById('orProcedureType')?.value,
        surgeonName: document.getElementById('orSurgeon')?.value?.trim(),
        theatre: document.getElementById('orTheatre')?.value,
        notes: document.getElementById('orNotes')?.value?.trim(),
        preopChecklist: {
          consent: false,
          labs: false,
          anaesthesiaReview: false
        }
      };
      if (!payload.patientName || !payload.procedureDate) {
        alert('Patient name and date are required.');
        return;
      }
      if (apiOn() && global.navigator.onLine !== false) {
        try {
          await api('/api/v1/or-schedule', { method: 'POST', body: JSON.stringify(payload) });
          global.closeEmrModal('orCaseModal');
          await loadDay(_selectedDate);
          return;
        } catch (err) {
          console.warn('[OR] Cloud save failed:', err);
        }
      }
      await dbPut({ ...payload, procedureDate: payload.procedureDate, status: 'scheduled' });
      global.closeEmrModal('orCaseModal');
      await loadDay(_selectedDate);
    },
    async markInProgress(id) {
      if (!guardCloudRegistryWrite()) return;
      if (!apiOn() || !id) return;
      const row = _cases.find((c) => c.id === id);
      try {
        await api(`/api/v1/or-schedule/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'in_progress', revision: row?.revision })
        });
        await loadDay(_selectedDate);
      } catch (err) {
        alert(err.message || 'Update failed');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
