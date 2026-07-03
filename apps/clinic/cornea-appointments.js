/**
 * Appointments & recall — day schedule and follow-up recall queue (P5)
 */
(function (global) {
  'use strict';

  const STORE_APPOINTMENTS = 'appointments';
  const STATUSES = ['scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'];
  const TYPES = ['visit', 'recall', 'procedure', 'review'];

  let _dayAppointments = [];
  let _recallQueue = { dueFollowups: [], scheduledRecalls: [] };
  let _selectedDate = todayIso();
  let _activePanel = 'schedule';

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function esc(s) {
    return global.escapeHtml ? global.escapeHtml(s) : String(s ?? '');
  }

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function api(path, options) {
    return global.CorneaApi.request(path, options);
  }

  function guardCloudRegistryWrite(label) {
    return global.CorneaRegistryOnline?.guardCloudWrite(apiOn(), label || 'Appointments') !== false;
  }

  function bindAppointmentsOfflineUi() {
    global.CorneaRegistryOnline?.bindRegistryOfflineUi('appointments', {
      bannerId: 'appointmentsOfflineBanner',
      registryLabel: 'Appointments & recall',
      writeSelectors: [
        '#apptSchedulePanel .btn-primary',
        '#apptScheduleBody button',
        '#appointmentModal .btn-primary'
      ]
    });
  }

  function dbAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function dbPut(row) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([STORE_APPOINTMENTS], 'readwrite').objectStore(STORE_APPOINTMENTS).put(row);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function statusBadge(status) {
    const cls = {
      scheduled: 'badge-waiting',
      confirmed: 'badge-matched',
      arrived: 'badge-scheduled',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled',
      no_show: 'badge-cancelled'
    }[status] || 'badge-waiting';
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }

  function setPanel(panel) {
    _activePanel = panel;
    const panelIds = { schedule: 'apptSchedulePanel', recall: 'apptRecallPanel', or: 'apptOrPanel' };
    document.querySelectorAll('#appointmentsTab .appt-panel').forEach((p) => {
      p.classList.toggle('active', p.id === panelIds[panel]);
    });
    document.querySelectorAll('#appointmentsTab .appt-subnav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.apptPanel === panel);
    });
    if (panel === 'or' && global.CorneaOrSchedule?.refreshDay) {
      global.CorneaOrSchedule.refreshDay();
    }
  }

  function renderScheduleTable() {
    const body = document.getElementById('apptScheduleBody');
    if (!body) return;
    const rows = _dayAppointments.filter((a) => a.status !== 'cancelled');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-muted">No appointments for this day.</td></tr>';
      return;
    }
    body.innerHTML = rows.map((a) => `<tr>
      <td>${esc(a.startTime || '—')}</td>
      <td><strong>${esc(a.patientName)}</strong><br><span class="form-hint">${esc(a.patientMrn || a.appointmentId || '')}</span></td>
      <td>${esc(a.appointmentType)}</td>
      <td>${esc(a.reason || '—')}</td>
      <td>${esc(a.station || '—')}</td>
      <td>${statusBadge(a.status)}</td>
      <td class="no-print">
        <button type="button" class="btn-secondary btn-sm" onclick="CorneaAppointments.openEdit('${a.id || a.localId}')">Edit</button>
        ${a.status !== 'completed' ? `<button type="button" class="btn-info btn-sm" onclick="CorneaAppointments.markArrived('${a.id || a.localId}')">Arrived</button>` : ''}
      </td>
    </tr>`).join('');
  }

  function renderRecallTable() {
    const body = document.getElementById('apptRecallBody');
    if (!body) return;
    const due = _recallQueue.dueFollowups || [];
    if (!due.length) {
      body.innerHTML = '<tr><td colspan="6" class="text-muted">No overdue follow-ups without a scheduled appointment.</td></tr>';
      return;
    }
    body.innerHTML = due.map((r, i) => `<tr>
      <td>${esc(r.dueDate)}</td>
      <td><strong>${esc(r.patientName)}</strong></td>
      <td>${esc(r.patientMrn || '—')}</td>
      <td>${esc(r.purpose || 'Follow-up')}</td>
      <td>${esc(r.severity || '—')}</td>
      <td class="no-print"><button type="button" class="btn-primary btn-sm" onclick="CorneaAppointments.scheduleRecall(${i})">Schedule</button></td>
    </tr>`).join('');
  }

  async function loadDay(dateStr) {
    _selectedDate = dateStr || _selectedDate;
    const dateInput = document.getElementById('apptDatePicker');
    if (dateInput) dateInput.value = _selectedDate;

    if (apiOn() && global.navigator.onLine !== false) {
      try {
        const res = await api(`/api/v1/appointments/day/${encodeURIComponent(_selectedDate)}`);
        _dayAppointments = res?.data?.data || [];
        renderScheduleTable();
        return;
      } catch (err) {
        console.warn('[Appointments] Cloud day load failed:', err);
      }
    }

    const local = await dbAll(STORE_APPOINTMENTS);
    _dayAppointments = local.filter((a) => a.appointmentDate === _selectedDate);
    renderScheduleTable();
  }

  async function loadRecallQueue() {
    if (apiOn() && global.navigator.onLine !== false) {
      try {
        const res = await api('/api/v1/appointments/recall-queue?days=30');
        _recallQueue = res?.data || { dueFollowups: [], scheduledRecalls: [] };
        renderRecallTable();
        return;
      } catch (err) {
        console.warn('[Appointments] Recall queue failed:', err);
      }
    }
    _recallQueue = { dueFollowups: [], scheduledRecalls: [] };
    renderRecallTable();
  }

  function fillModal(row) {
    document.getElementById('apptRecordId').value = row?.id || row?.localId || '';
    document.getElementById('apptPatientName').value = row?.patientName || '';
    document.getElementById('apptPatientMrn').value = row?.patientMrn || '';
    document.getElementById('apptPatientPhone').value = row?.patientPhone || '';
    document.getElementById('apptPatientId').value = row?.patientId || '';
    document.getElementById('apptDate').value = row?.appointmentDate || _selectedDate;
    document.getElementById('apptStartTime').value = row?.startTime || '09:00';
    document.getElementById('apptDuration').value = row?.durationMinutes || 15;
    document.getElementById('apptType').value = row?.appointmentType || 'visit';
    document.getElementById('apptStatus').value = row?.status || 'scheduled';
    document.getElementById('apptStation').value = row?.station || '';
    document.getElementById('apptReason').value = row?.reason || '';
    document.getElementById('apptNotes').value = row?.notes || '';
    document.getElementById('apptRecallVisitId').value = row?.recallSourceVisitId || '';
    document.getElementById('apptRevision').value = row?.revision || '';
  }

  function collectModal() {
    return {
      patientName: document.getElementById('apptPatientName')?.value?.trim(),
      patientMrn: document.getElementById('apptPatientMrn')?.value?.trim(),
      patientPhone: document.getElementById('apptPatientPhone')?.value?.trim(),
      patientId: document.getElementById('apptPatientId')?.value?.trim() || null,
      appointmentDate: document.getElementById('apptDate')?.value,
      startTime: document.getElementById('apptStartTime')?.value,
      durationMinutes: Number(document.getElementById('apptDuration')?.value) || 15,
      appointmentType: document.getElementById('apptType')?.value || 'visit',
      status: document.getElementById('apptStatus')?.value || 'scheduled',
      station: document.getElementById('apptStation')?.value || null,
      reason: document.getElementById('apptReason')?.value?.trim(),
      notes: document.getElementById('apptNotes')?.value?.trim(),
      recallSourceVisitId: document.getElementById('apptRecallVisitId')?.value?.trim() || null,
      revision: document.getElementById('apptRevision')?.value
        ? Number(document.getElementById('apptRevision').value)
        : undefined
    };
  }

  global.CorneaAppointments = {
    STORE_APPOINTMENTS,
    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_APPOINTMENTS)) {
        const store = db.createObjectStore(STORE_APPOINTMENTS, { keyPath: 'localId', autoIncrement: true });
        store.createIndex('appointmentDate', 'appointmentDate', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    },
    async init() {
      bindAppointmentsOfflineUi();
      const hint = document.getElementById('apptCloudHint');
      if (hint) hint.hidden = apiOn();
      setPanel(_activePanel);
      await loadDay(_selectedDate);
      await loadRecallQueue();
      global.CorneaRegistryOnline?.refresh('appointments');
    },
    async refreshDay() {
      await loadDay(document.getElementById('apptDatePicker')?.value || _selectedDate);
    },
    async refreshRecall() {
      await loadRecallQueue();
    },
    switchPanel(panel) {
      setPanel(panel);
      if (panel === 'recall') loadRecallQueue();
      else loadDay(_selectedDate);
    },
    openNew() {
      fillModal({ appointmentDate: _selectedDate, startTime: '09:00', durationMinutes: 15, appointmentType: 'visit', status: 'scheduled' });
      global.openEmrModal('appointmentModal');
    },
    scheduleRecall(index) {
      const r = (_recallQueue.dueFollowups || [])[index];
      if (!r) return;
      fillModal({
        patientName: r.patientName,
        patientMrn: r.patientMrn,
        patientPhone: r.patientPhone,
        patientId: r.patientId,
        appointmentDate: r.dueDate || _selectedDate,
        startTime: '09:00',
        durationMinutes: 15,
        appointmentType: 'recall',
        status: 'scheduled',
        reason: r.purpose || 'Follow-up recall',
        recallSourceVisitId: r.visitId
      });
      global.openEmrModal('appointmentModal');
    },
    openEdit(id) {
      const row = _dayAppointments.find((a) => String(a.id) === String(id) || String(a.localId) === String(id));
      if (!row) return;
      fillModal(row);
      global.openEmrModal('appointmentModal');
    },
    async save() {
      if (!guardCloudRegistryWrite()) return;
      const payload = collectModal();
      if (!payload.patientName || !payload.appointmentDate) {
        alert('Patient name and date are required.');
        return;
      }
      const recordId = document.getElementById('apptRecordId')?.value;

      if (apiOn() && global.navigator.onLine !== false) {
        try {
          if (recordId && !String(recordId).match(/^\d+$/)) {
            await api(`/api/v1/appointments/${encodeURIComponent(recordId)}`, {
              method: 'PATCH',
              body: JSON.stringify(payload)
            });
          } else {
            await api('/api/v1/appointments', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
          }
          global.closeEmrModal('appointmentModal');
          await loadDay(_selectedDate);
          await loadRecallQueue();
          return;
        } catch (err) {
          console.warn('[Appointments] Cloud save failed, saving locally:', err);
        }
      }

      const localRow = { ...payload, localId: recordId ? Number(recordId) : undefined };
      await dbPut(localRow);
      global.closeEmrModal('appointmentModal');
      await loadDay(_selectedDate);
    },
    async markArrived(id) {
      if (!guardCloudRegistryWrite()) return;
      const row = _dayAppointments.find((a) => String(a.id) === String(id) || String(a.localId) === String(id));
      if (!row) return;
      if (apiOn() && row.id) {
        try {
          await api(`/api/v1/appointments/${encodeURIComponent(row.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'arrived', revision: row.revision })
          });
          await loadDay(_selectedDate);
          return;
        } catch (err) {
          console.warn('[Appointments] Mark arrived failed:', err);
        }
      }
      row.status = 'arrived';
      if (row.localId) await dbPut(row);
      renderScheduleTable();
    }
  };

  global.initAppointmentsTab = () => global.CorneaAppointments.init();
})(typeof window !== 'undefined' ? window : globalThis);
