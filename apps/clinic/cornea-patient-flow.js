/**
 * Cornea Clinic — patient flow / station queue for today's visits.
 * Tracks where each patient is in the clinic and supports handoffs between stations.
 */
(function (global) {
  'use strict';

  const STORE_PATIENTS = 'patients';

  const STATIONS = Object.freeze([
    { id: 'new', label: 'New Patients', icon: 'fa-user-plus', desc: 'Registered today' },
    { id: 'refraction', label: 'Refraction', icon: 'fa-glasses' },
    { id: 'doctor_preliminary', label: 'Doctor Preliminary Exam', icon: 'fa-stethoscope' },
    { id: 'investigations', label: 'Investigations', icon: 'fa-flask' },
    { id: 'doctor_exam', label: 'Doctor Exam', icon: 'fa-user-doctor' },
    { id: 'contact_lens', label: 'Contact Lens', icon: 'fa-eye' },
    { id: 'pentacam', label: 'Pentacam', icon: 'fa-chart-area' },
    { id: 'specular_microscopy', label: 'Specular Microscopy', icon: 'fa-microscope' },
    { id: 'microbiology', label: 'Microbiology', icon: 'fa-bacteria' },
    { id: 'lasik_workup', label: 'Lasik Work-up', icon: 'fa-bolt' },
    { id: 'completed', label: 'Completed', icon: 'fa-house-circle-check', desc: 'Sent home · visit complete' }
  ]);

  const STATION_MAP = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  const ROUTING_STATIONS = STATIONS.filter((s) => s.id !== 'new' && s.id !== 'completed');

  let activeStationId = 'new';
  let refreshTimer = null;

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowIso() {
    return new Date().toISOString();
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
    return { userId: null, userName: 'Unknown user' };
  }

  function canEditClinicalRecord() {
    return global.CorneaOfflineAuth?.hasPermission?.('visits:write') === true;
  }

  function canMovePatient() {
    const auth = global.CorneaOfflineAuth;
    return auth?.hasPermission?.('flow:move') || auth?.hasPermission?.('visits:write') || false;
  }

  function canCompletePatient() {
    return global.CorneaOfflineAuth?.hasPermission?.('flow:complete') === true;
  }

  function effectiveStation(record) {
    if (!record) return null;
    if (record.flowStation) return record.flowStation;
    const today = todayIso();
    if ((record.visitDate || '') === today) return 'new';
    return null;
  }

  function isTodayVisit(record) {
    return (record?.visitDate || '') === todayIso();
  }

  function stationLabel(id) {
    return STATION_MAP[id]?.label || id || '—';
  }

  function formatWaitTime(checkedInAt) {
    if (!checkedInAt) return '—';
    const ms = Date.now() - new Date(checkedInAt).getTime();
    if (Number.isNaN(ms) || ms < 0) return '—';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
  }

  function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllVisits() {
    if (!global.db) return [];
    const store = global.db.transaction([STORE_PATIENTS], 'readonly').objectStore(STORE_PATIENTS);
    return promisifyRequest(store.getAll()) || [];
  }

  async function getVisit(id) {
    if (!global.db || id == null) return null;
    const store = global.db.transaction([STORE_PATIENTS], 'readonly').objectStore(STORE_PATIENTS);
    return promisifyRequest(store.get(Number(id)));
  }

  async function persistVisit(record) {
    record.lastModified = nowIso();
    if (global.CorneaSync) {
      return global.CorneaSync.saveVisitLocal(record);
    }
    const store = global.db.transaction([STORE_PATIENTS], 'readwrite').objectStore(STORE_PATIENTS);
    const savedId = await promisifyRequest(store.put(record));
    return { ...record, id: savedId };
  }

  function visitsForStation(visits, stationId) {
    const today = todayIso();
    return visits.filter((v) => {
      if ((v.visitDate || '') !== today) return false;
      const station = effectiveStation(v);
      if (stationId === 'new') {
        return station === 'new';
      }
      if (stationId === 'completed') {
        return station === 'completed';
      }
      return station === stationId;
    }).sort((a, b) => {
      const ta = a.flowCheckedInAt || a.lastModified || '';
      const tb = b.flowCheckedInAt || b.lastModified || '';
      return ta.localeCompare(tb);
    });
  }

  function buildRoutingOptions(currentStation, includeCompleted) {
    const targets = [];
    if (currentStation !== 'new') {
      targets.push({ id: 'new', label: stationLabel('new') });
    }
    ROUTING_STATIONS.forEach((s) => {
      if (s.id !== currentStation) targets.push({ id: s.id, label: s.label });
    });
    if (includeCompleted && currentStation !== 'completed') {
      targets.push({ id: 'completed', label: stationLabel('completed') });
    }
    return targets;
  }

  function renderStationPanel(stationId, visits) {
    const panel = document.getElementById('flowPanel-' + stationId);
    const body = document.getElementById('flowBody-' + stationId);
    const countEl = document.getElementById('flowCount-' + stationId);
    if (!panel || !body) return;

    const list = visitsForStation(visits, stationId);
    if (countEl) countEl.textContent = String(list.length);

    const badge = document.getElementById('flowBadge-' + stationId);
    if (badge) {
      badge.textContent = list.length ? String(list.length) : '';
      badge.hidden = !list.length;
    }

    if (!list.length) {
      body.innerHTML = `
        <tr><td colspan="6">
          <div class="flow-empty"><i class="fa-solid fa-inbox"></i>
            <p>No patients in this station for today.</p>
          </div>
        </td></tr>`;
      return;
    }

    const canMove = canMovePatient();
    const canComplete = canCompletePatient();
    const currentStation = stationId;

    body.innerHTML = list.map((v) => {
      const station = effectiveStation(v);
      const routes = buildRoutingOptions(station, canComplete);
      const routeOptions = routes.map((r) =>
        `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`
      ).join('');
      const historyHint = Array.isArray(v.flowHistory) && v.flowHistory.length > 1
        ? `<span class="flow-history-hint" title="${escapeHtml(
          v.flowHistory.map((h) => `${stationLabel(h.station)} · ${h.byName || ''}`).join('\n')
        )}"><i class="fa-solid fa-route"></i> ${v.flowHistory.length} stops</span>`
        : '';

      const moveCell = canMove && station !== 'completed'
        ? `<div class="flow-route-controls">
            <select class="flow-route-select" id="flowRoute-${v.id}" aria-label="Send to station">
              <option value="">Send to…</option>
              ${routeOptions}
            </select>
            <button type="button" class="btn-teal btn-sm" onclick="CorneaPatientFlow.sendPatient(${v.id})">
              <i class="fa-solid fa-arrow-right"></i> Send
            </button>
          </div>`
        : (station === 'completed'
          ? '<span class="text-muted">Completed</span>'
          : '<span class="text-muted">View only</span>');

      return `<tr data-visit-id="${v.id}">
        <td><span class="patient-id-badge">${escapeHtml(v.patientId || '—')}</span></td>
        <td><strong>${escapeHtml(v.fullName || 'Unnamed')}</strong></td>
        <td>${escapeHtml(v.phone || '—')}</td>
        <td>${escapeHtml(formatWaitTime(v.flowCheckedInAt))} ${historyHint}</td>
        <td class="flow-actions">
          <button type="button" class="btn-info btn-sm" onclick="viewRecordReadOnly(${v.id}, 'flow')">
            <i class="fa-solid fa-eye"></i> View
          </button>
          ${canEditClinicalRecord() ? `<button type="button" class="btn-secondary btn-sm" onclick="loadAndEditRecord(${v.id})">
            <i class="fa-solid fa-pen"></i> Edit
          </button>` : ''}
        </td>
        <td>${moveCell}</td>
      </tr>`;
    }).join('');
  }

  async function refreshFlowBoard() {
    if (!global.db) return;
    const visits = await getAllVisits();
    STATIONS.forEach((s) => renderStationPanel(s.id, visits));
  }

  function switchStation(stationId) {
    if (!STATION_MAP[stationId]) return;
    activeStationId = stationId;
    document.querySelectorAll('.flow-subnav-btn').forEach((btn) => {
      const active = btn.getAttribute('data-flow-station') === stationId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.flow-panel').forEach((panel) => {
      const active = panel.id === 'flowPanel-' + stationId;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    refreshFlowBoard();
  }

  function buildFlowUi() {
    const tab = document.getElementById('flowTab');
    if (!tab || tab.dataset.flowBuilt === '1') return;

    const subnav = document.getElementById('flowSubnav');
    const panelsWrap = document.getElementById('flowPanelsWrap');
    if (!subnav || !panelsWrap) return;

    subnav.innerHTML = STATIONS.map((s, i) => `
      <button type="button" class="flow-subnav-btn${i === 0 ? ' active' : ''}"
        data-flow-station="${s.id}" role="tab"
        aria-selected="${i === 0 ? 'true' : 'false'}"
        aria-controls="flowPanel-${s.id}"
        onclick="CorneaPatientFlow.switchStation('${s.id}')">
        <i class="fa-solid ${s.icon}" aria-hidden="true"></i>
        ${escapeHtml(s.label)}
        <span class="flow-station-badge" id="flowBadge-${s.id}" hidden></span>
      </button>`).join('');

    panelsWrap.innerHTML = STATIONS.map((s, i) => `
      <div id="flowPanel-${s.id}" class="flow-panel${i === 0 ? ' active' : ''}"
        role="tabpanel" aria-labelledby="flowNav-${s.id}" ${i === 0 ? '' : 'hidden'}>
        <div class="card">
          <div class="card-header">
            <div class="card-header-left">
              <div class="card-icon blue"><i class="fa-solid ${s.icon}"></i></div>
              <div>
                <span class="card-title">${escapeHtml(s.label)}</span>
                ${s.desc ? `<div class="form-hint">${escapeHtml(s.desc)}</div>` : ''}
              </div>
            </div>
            <div class="flow-panel-meta">
              <span class="flow-count-pill"><span id="flowCount-${s.id}">0</span> today</span>
              <button type="button" class="btn-secondary btn-sm" onclick="CorneaPatientFlow.refresh()">
                <i class="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="table-scroll">
              <table class="records-table flow-queue-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Waiting</th>
                    <th class="no-print">Actions</th>
                    <th class="no-print">Route patient</th>
                  </tr>
                </thead>
                <tbody id="flowBody-${s.id}"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`).join('');

    tab.dataset.flowBuilt = '1';
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      const tab = document.getElementById('flowTab');
      if (tab?.classList.contains('active')) refreshFlowBoard();
    }, 30000);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function initFlowTab() {
    buildFlowUi();
    switchStation(activeStationId);
    startAutoRefresh();
  }

  /**
   * Called before persisting a visit — assigns new today's visits to the New Patients station.
   */
  function applyOnSave(data, existing) {
    if (!data) return data;
    const today = todayIso();
    const visitDay = data.visitDate || today;

    if (existing?.flowStation) {
      data.flowStation = existing.flowStation;
      data.flowCheckedInAt = existing.flowCheckedInAt;
      data.flowHistory = existing.flowHistory;
      data.flowCompletedAt = existing.flowCompletedAt;
      data.flowCompletedBy = existing.flowCompletedBy;
      return data;
    }

    if (visitDay === today) {
      const actor = currentActor();
      const now = nowIso();
      data.flowStation = 'new';
      data.flowCheckedInAt = now;
      data.flowHistory = [{
        station: 'new',
        at: now,
        by: actor.userId,
        byName: actor.userName
      }];
    }
    return data;
  }

  async function movePatient(visitId, targetStation) {
    if (!STATION_MAP[targetStation]) {
      alert('Invalid station.');
      return false;
    }
    if (!canMovePatient()) {
      alert('You do not have permission to move patients between stations.');
      return false;
    }
    if (targetStation === 'completed' && !canCompletePatient()) {
      alert('You do not have permission to mark patients as completed / sent home.');
      return false;
    }

    const record = await getVisit(visitId);
    if (!record) {
      alert('Patient record not found.');
      return false;
    }
    if (!isTodayVisit(record)) {
      alert('Only today\'s visits can be moved through the patient flow.');
      return false;
    }

    const from = effectiveStation(record);
    if (from === targetStation) return true;

    const actor = currentActor();
    const now = nowIso();
    record.flowStation = targetStation;
    record.flowCheckedInAt = now;
    if (!Array.isArray(record.flowHistory)) record.flowHistory = [];
    record.flowHistory.push({
      station: targetStation,
      from,
      at: now,
      by: actor.userId,
      byName: actor.userName
    });

    if (targetStation === 'completed') {
      record.flowCompletedAt = now;
      record.flowCompletedBy = actor.userName;
    } else {
      record.flowCompletedAt = null;
      record.flowCompletedBy = null;
    }

    await persistVisit(record);
    await refreshFlowBoard();
    if (typeof global.updateDashboardStats === 'function') global.updateDashboardStats();
    return true;
  }

  async function sendPatient(visitId) {
    const select = document.getElementById('flowRoute-' + visitId);
    const target = select?.value;
    if (!target) {
      alert('Choose a station to send the patient to.');
      return;
    }
    const label = stationLabel(target);
    if (!confirm(`Send this patient to ${label}?`)) return;
    const ok = await movePatient(visitId, target);
    if (ok && select) select.value = '';
  }

  async function completePatient(visitId) {
    return movePatient(visitId, 'completed');
  }

  global.CorneaPatientFlow = {
    STATIONS,
    STATION_MAP,
    stationLabel,
    effectiveStation,
    canMovePatient,
    canCompletePatient,
    canEditClinicalRecord,
    applyOnSave,
    initFlowTab,
    switchStation,
    refresh: refreshFlowBoard,
    movePatient,
    sendPatient,
    completePatient,
    buildFlowUi
  };
})(typeof window !== 'undefined' ? window : globalThis);
