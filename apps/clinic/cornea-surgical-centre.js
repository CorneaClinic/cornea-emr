/**
 * Surgical Centre — Phase 2: pre-op, safety checklist, OT scheduling, episode detail.
 */
(function (global) {
  'use strict';

  let _episodes = [];
  let _dashboard = null;
  let _workflow = null;
  let _panel = 'dashboard';
  let _currentEpisode = null;

  const PANEL_MAP = Object.freeze({
    dashboard: 'surgicalDashboardPanel',
    waiting: 'surgicalWaitingPanel',
    episodes: 'surgicalEpisodesPanel',
    preop: 'surgicalPreopPanel',
    scheduling: 'surgicalSchedulingPanel'
  });

  function apiOn() {
    return !!(global.__corneaCloudMode && global.CorneaApi?.isEnabled?.());
  }

  function esc(v) {
    return global.escapeHtml ? global.escapeHtml(v ?? '') : String(v ?? '');
  }

  function fmtDate(v) {
    if (!v) return '—';
    const d = String(v).slice(0, 10);
    return d || '—';
  }

  async function fetchWorkflow() {
    if (!apiOn() || _workflow) return;
    const res = await global.CorneaApi.request('/api/v1/surgical-centre/workflow');
    _workflow = res?.data || null;
  }

  async function fetchDashboard() {
    if (!apiOn()) return;
    const date = document.getElementById('surgicalDatePicker')?.value || '';
    const q = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await global.CorneaApi.request(`/api/v1/surgical-centre/dashboard${q}`);
    _dashboard = res?.data || null;
  }

  async function fetchEpisodes() {
    if (!apiOn()) return;
    const res = await global.CorneaApi.request('/api/v1/surgical-centre/episodes?workflowStatus=OPEN&limit=200');
    _episodes = Array.isArray(res?.data) ? res.data : [];
  }

  async function fetchEpisode(id) {
    const res = await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}`);
    return res?.data || null;
  }

  function stageLabel(stageId) {
    const s = (_workflow?.stages || []).find((x) => x.id === stageId);
    return s?.label || stageId;
  }

  function actionBtn(label, icon, fn, id) {
    const safeId = esc(id);
    return `<button type="button" class="btn-secondary btn-sm" onclick="CorneaSurgicalCentre.${fn}('${safeId}')"><i class="fa-solid ${icon}"></i> ${esc(label)}</button>`;
  }

  function renderDashboard() {
    const statsHost = document.getElementById('surgicalDashboardStats');
    if (!statsHost) return;
    const d = _dashboard?.today || {};
    const cards = [
      ['Today cases', d.todaysCases || 0],
      ['Awaiting pre-op', d.awaitingPreop || 0],
      ['In block room', d.inBlockRoom || 0],
      ['In OT', d.inOt || 0],
      ['In recovery', d.inRecovery || 0],
      ['Completed', d.completedCases || 0],
      ['Cancelled', d.cancelledCases || 0],
      ['Emergency open', d.emergencyCases || 0],
      ['Safety alerts', d.safetyAlerts || 0]
    ];
    statsHost.innerHTML = cards
      .map(([label, value]) => `<div class="kp-stat"><div class="val">${esc(value)}</div><div class="lbl">${esc(label)}</div></div>`)
      .join('');

    const flags = document.getElementById('surgicalSafetyFlags');
    if (!flags) return;
    const openWithFlags = _episodes.filter((e) => (e.safetyFlags || []).length);
    if (!openWithFlags.length) {
      flags.innerHTML = '<span class="form-hint">No active safety flags on open episodes.</span>';
      return;
    }
    flags.innerHTML = openWithFlags
      .slice(0, 8)
      .map((e) => `<div class="mb-1"><strong>${esc(e.surgicalEpisodeId)}</strong> ${esc(e.patientName)} — ${(e.safetyFlags || []).map((f) => `<span class="badge badge-waiting">${esc(f)}</span>`).join(' ')}</div>`)
      .join('');
  }

  function filteredWaitingEpisodes() {
    const q = (document.getElementById('surgicalWaitingSearch')?.value || '').trim().toLowerCase();
    const list = _episodes.filter((e) => e.workflowStatus === 'OPEN');
    if (!q) return list;
    return list.filter((e) =>
      [e.patientName, e.patientMrn, e.plannedProcedure, e.diagnosis, e.surgicalEpisodeId]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }

  function renderWaitingList() {
    const host = document.getElementById('surgicalWaitingBody');
    if (!host) return;
    const rows = filteredWaitingEpisodes();
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="9" class="text-muted">No surgical episodes in waiting workflow.</td></tr>';
      return;
    }
    host.innerHTML = rows.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td><strong>${esc(e.patientName)}</strong><br><span class="form-hint">${esc(e.patientMrn || '—')}</span></td>
        <td>${esc(e.diagnosis)}</td>
        <td>${esc(e.eye)}</td>
        <td>${esc(e.plannedProcedure)}</td>
        <td><span class="badge badge-waiting">${esc(e.priority)}</span></td>
        <td>${esc(stageLabel(e.stage))}</td>
        <td>${esc(e.stageStatus)}</td>
        <td class="no-print">${actionBtn('Open', 'fa-eye', 'openEpisodeDetail', e.id)}</td>
      </tr>
    `).join('');
  }

  function renderEpisodes() {
    const host = document.getElementById('surgicalEpisodesBody');
    if (!host) return;
    if (!_episodes.length) {
      host.innerHTML = '<tr><td colspan="7" class="text-muted">No surgical episodes yet.</td></tr>';
      return;
    }
    host.innerHTML = _episodes.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(stageLabel(e.stage))}<br><span class="form-hint">${esc(e.stageStatus)}</span></td>
        <td>${esc(e.surgeonName || '—')}</td>
        <td>${esc(e.workflowStatus)}</td>
        <td>${esc(e.safetyChecklistPct ?? 0)}%${(e.safetyFlags || []).length ? ' <span class="badge badge-waiting">!</span>' : ''}</td>
        <td class="no-print">
          ${actionBtn('Detail', 'fa-eye', 'openEpisodeDetail', e.id)}
          ${actionBtn('Advance', 'fa-forward-step', 'advanceStage', e.id)}
        </td>
      </tr>
    `).join('');
  }

  function renderPreopPanel() {
    const host = document.getElementById('surgicalPreopBody');
    if (!host) return;
    const rows = _episodes.filter((e) =>
      ['PRE_OP_ASSESSMENT', 'SURGICAL_WAITING_LIST', 'CONSENT', 'PATIENT_COUNSELLING', 'SURGICAL_DECISION'].includes(e.stage)
    );
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="6" class="text-muted">No episodes in pre-operative workflow.</td></tr>';
      return;
    }
    host.innerHTML = rows.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(e.plannedProcedure)}</td>
        <td>${esc(e.preopStatus || '—')}</td>
        <td>${esc(e.safetyChecklistPct ?? 0)}%</td>
        <td class="no-print">
          ${actionBtn('Pre-op', 'fa-clipboard-check', 'openPreopForEpisode', e.id)}
          ${actionBtn('Checklist', 'fa-shield-heart', 'openSafetyForEpisode', e.id)}
        </td>
      </tr>
    `).join('');
  }

  function renderSchedulingPanel() {
    const host = document.getElementById('surgicalSchedulingBody');
    if (!host) return;
    const rows = _episodes.filter((e) =>
      ['OT_SCHEDULING', 'PRE_OP_VERIFICATION', 'SURGICAL_WAITING_LIST', 'PRE_OP_ASSESSMENT'].includes(e.stage) ||
      e.scheduledAt
    );
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="7" class="text-muted">No episodes ready for OT scheduling.</td></tr>';
      return;
    }
    host.innerHTML = rows.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(e.plannedProcedure)}</td>
        <td>${esc(e.surgeonName || '—')}</td>
        <td>${esc(fmtDate(e.scheduledAt))}</td>
        <td>${esc(e.orCaseId ? 'Linked' : '—')}</td>
        <td class="no-print">${actionBtn('Schedule', 'fa-calendar-check', 'openScheduleForEpisode', e.id)}</td>
      </tr>
    `).join('');
  }

  function renderStageTimeline(ep) {
    const host = document.getElementById('surgicalStageTimeline');
    if (!host) return;
    const stages = _workflow?.stages || [];
    const currentIdx = stages.findIndex((s) => s.id === ep.stage);
    host.innerHTML = stages.map((s, idx) => {
      let cls = 'surgical-stage-step';
      if (idx < currentIdx) cls += ' completed';
      else if (idx === currentIdx) cls += ' active';
      const hist = (ep.stageHistory || []).filter((h) => h.stage === s.id).pop();
      const meta = hist ? `<span class="form-hint">${esc(hist.status)} · ${esc(String(hist.at || '').slice(0, 16))}</span>` : '';
      return `<div class="${cls}"><strong>${esc(s.label)}</strong>${meta ? `<br>${meta}` : ''}</div>`;
    }).join('');
  }

  function renderEpisodeDetail(ep) {
    _currentEpisode = ep;
    document.getElementById('surgicalEpisodeId').value = ep.id;

    const summary = document.getElementById('surgicalEpisodeSummary');
    if (summary) {
      summary.innerHTML = `
        <div class="kp-form-grid">
          <div><strong>${esc(ep.surgicalEpisodeId)}</strong> — ${esc(ep.patientName)} (${esc(ep.patientMrn || 'no MRN')})</div>
          <div>${esc(ep.diagnosis)} · ${esc(ep.eye)} · ${esc(ep.plannedProcedure)}</div>
          <div>Stage: <strong>${esc(stageLabel(ep.stage))}</strong> (${esc(ep.stageStatus)})</div>
          <div>Checklist: ${esc(ep.safetyChecklistPct ?? 0)}% · Pre-op: ${esc(ep.preopStatus || '—')}</div>
        </div>`;
    }

    renderStageTimeline(ep);

    const alerts = document.getElementById('surgicalEpisodeAlerts');
    if (alerts) {
      const flags = ep.safetyFlags || [];
      alerts.innerHTML = flags.length
        ? `<h4>Safety alerts</h4>${flags.map((f) => `<span class="badge badge-waiting">${esc(f)}</span>`).join(' ')}`
        : '<p class="form-hint">No active safety flags.</p>';
    }

    const actions = document.getElementById('surgicalRequiredActions');
    if (actions) {
      const req = ep.requiredActions || [];
      actions.innerHTML = req.length
        ? `<h4>Required actions</h4><ul>${req.map((a) => `<li>${esc(typeof a === 'string' ? a : a.label || JSON.stringify(a))}</li>`).join('')}</ul>`
        : '';
    }
  }

  function renderAll() {
    renderDashboard();
    renderWaitingList();
    renderEpisodes();
    renderPreopPanel();
    renderSchedulingPanel();
  }

  function setOfflineBanner(message) {
    const banner = document.getElementById('surgicalCentreOfflineBanner');
    if (!banner) return;
    if (!message) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.hidden = false;
    banner.textContent = message;
  }

  function showActionError(err, fallback) {
    const message = err?.message || fallback || String(err);
    setOfflineBanner(message);
    if (typeof global.showToast === 'function') {
      global.showToast(message, 'error');
    } else {
      global.alert?.(message);
    }
  }

  async function refreshDashboard() {
    try {
      if (!apiOn()) {
        setOfflineBanner('Surgical Centre is cloud-backed. Sign in to load live workflow data.');
        return;
      }
      setOfflineBanner('');
      await fetchWorkflow();
      await fetchDashboard();
      renderDashboard();
    } catch (err) {
      setOfflineBanner(`Unable to load dashboard: ${err?.message || err}`);
    }
  }

  async function refreshEpisodes() {
    try {
      if (!apiOn()) return;
      await fetchEpisodes();
      renderWaitingList();
      renderEpisodes();
      renderPreopPanel();
      renderSchedulingPanel();
      renderDashboard();
    } catch (err) {
      setOfflineBanner(`Unable to load episodes: ${err?.message || err}`);
    }
  }

  async function refreshAll() {
    await refreshDashboard();
    await refreshEpisodes();
    renderAll();
  }

  function switchPanel(panel) {
    _panel = PANEL_MAP[panel] ? panel : 'dashboard';
    document.querySelectorAll('.surgical-panel').forEach((el) => {
      const active = el.id === PANEL_MAP[_panel];
      el.classList.toggle('active', active);
      if (active) el.removeAttribute('hidden');
      else el.setAttribute('hidden', 'hidden');
    });
    document.querySelectorAll('.surgical-subnav-btn').forEach((btn) => {
      const active = btn.getAttribute('data-surgical-panel') === PANEL_MAP[_panel];
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  async function openEpisodeDetail(id) {
    if (!apiOn()) return;
    try {
      await fetchWorkflow();
      const ep = await fetchEpisode(id);
      if (!ep) return;
      renderEpisodeDetail(ep);
      global.openEmrModal?.('surgicalEpisodeModal');
    } catch (err) {
      setOfflineBanner(err?.message || String(err));
    }
  }

  function openNewEpisodeModal() {
    if (!apiOn()) {
      setOfflineBanner('Cloud sign-in required to create a surgical episode.');
      return;
    }
    ['surgicalNewPatientName', 'surgicalNewPatientMrn', 'surgicalNewDiagnosis', 'surgicalNewProcedure', 'surgicalNewSurgeon', 'surgicalNewNotes'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('surgicalNewEye').value = 'OD';
    document.getElementById('surgicalNewPriority').value = 'ELECTIVE';
    global.openEmrModal?.('surgicalNewEpisodeModal');
  }

  async function saveNewEpisode() {
    const patientName = document.getElementById('surgicalNewPatientName')?.value?.trim();
    const diagnosis = document.getElementById('surgicalNewDiagnosis')?.value?.trim();
    const plannedProcedure = document.getElementById('surgicalNewProcedure')?.value?.trim();
    if (!patientName || !diagnosis || !plannedProcedure) {
      showActionError(null, 'Patient name, diagnosis, and planned procedure are required.');
      return;
    }
    if (!apiOn()) {
      showActionError(null, 'Cloud sign-in required to create a surgical episode.');
      return;
    }

    try {
      await global.CorneaApi.request('/api/v1/surgical-centre/episodes', {
        method: 'POST',
        body: {
          patientName,
          patientMrn: document.getElementById('surgicalNewPatientMrn')?.value?.trim() || null,
          diagnosis,
          plannedProcedure,
          eye: document.getElementById('surgicalNewEye')?.value || 'OD',
          priority: document.getElementById('surgicalNewPriority')?.value || 'ELECTIVE',
          surgeonName: document.getElementById('surgicalNewSurgeon')?.value?.trim() || null,
          notes: document.getElementById('surgicalNewNotes')?.value?.trim() || null
        }
      });
      global.closeEmrModal?.('surgicalNewEpisodeModal');
      setOfflineBanner('');
      await refreshAll();
      switchPanel('episodes');
    } catch (err) {
      showActionError(err, 'Unable to create surgical episode.');
    }
  }

  function fillPreopModal(ep) {
    document.getElementById('surgicalPreopEpisodeId').value = ep.id;
    const a = ep.preopAssessment || {};
    document.getElementById('surgicalPreopFit').value = a.fitStatus || 'FIT_FOR_SURGERY';
    document.getElementById('surgicalPreopAnaesthesia').value = a.anaesthesiaPlan || '';
    document.getElementById('surgicalPreopMedical').value = a.medicalHistory || '';
    document.getElementById('surgicalPreopMeds').value = a.medications || '';
    document.getElementById('surgicalPreopAllergies').value = a.allergies || '';
    document.getElementById('surgicalPreopAllergyAlert').checked = !!a.allergyAlert;
    document.getElementById('surgicalPreopInvestigations').value = a.investigations || '';
    document.getElementById('surgicalPreopConditions').value = a.conditions || '';
    document.getElementById('surgicalPreopNotes').value = a.notes || '';
  }

  async function openPreopForEpisode(id) {
    const ep = _episodes.find((x) => x.id === id) || await fetchEpisode(id);
    if (!ep) return;
    _currentEpisode = ep;
    fillPreopModal(ep);
    global.openEmrModal?.('surgicalPreopModal');
  }

  function openPreopModal() {
    if (!_currentEpisode) {
      showActionError(null, 'Open an episode first.');
      return;
    }
    fillPreopModal(_currentEpisode);
    global.openEmrModal?.('surgicalPreopModal');
  }

  async function savePreop() {
    const id = document.getElementById('surgicalPreopEpisodeId')?.value || _currentEpisode?.id;
    if (!id) return;
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/preop`, {
        method: 'POST',
        body: {
          fitStatus: document.getElementById('surgicalPreopFit')?.value,
          anaesthesiaPlan: document.getElementById('surgicalPreopAnaesthesia')?.value,
          medicalHistory: document.getElementById('surgicalPreopMedical')?.value,
          medications: document.getElementById('surgicalPreopMeds')?.value,
          allergies: document.getElementById('surgicalPreopAllergies')?.value,
          allergyAlert: document.getElementById('surgicalPreopAllergyAlert')?.checked,
          investigations: document.getElementById('surgicalPreopInvestigations')?.value,
          conditions: document.getElementById('surgicalPreopConditions')?.value,
          notes: document.getElementById('surgicalPreopNotes')?.value
        }
      });
      global.closeEmrModal?.('surgicalPreopModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to save pre-operative assessment.');
    }
  }

  function renderSafetyForm(ep) {
    const host = document.getElementById('surgicalSafetyChecklistForm');
    if (!host) return;
    const items = _workflow?.safetyChecklistItems || [];
    const checklist = ep?.safetyChecklist || {};
    host.innerHTML = items.map((item) => {
      const entry = checklist[item.key] || {};
      const checked = entry.done ? 'checked' : '';
      const req = item.mandatory ? ' <span class="badge badge-waiting">required</span>' : '';
      return `<label class="d-block mb-2"><input type="checkbox" data-safety-key="${esc(item.key)}" ${checked} /> ${esc(item.label)}${req}</label>`;
    }).join('');
    document.getElementById('surgicalSafetyEpisodeId').value = ep.id;
    document.getElementById('surgicalOverrideReason').value = ep.safetyOverride?.reason || '';
    document.getElementById('surgicalOverrideEmergency').checked = !!ep.safetyOverride?.emergency;
  }

  async function openSafetyForEpisode(id) {
    await fetchWorkflow();
    const ep = _episodes.find((x) => x.id === id) || await fetchEpisode(id);
    if (!ep) return;
    _currentEpisode = ep;
    renderSafetyForm(ep);
    global.openEmrModal?.('surgicalSafetyModal');
  }

  async function openSafetyModal() {
    if (!_currentEpisode) {
      showActionError(null, 'Open an episode first.');
      return;
    }
    await fetchWorkflow();
    renderSafetyForm(_currentEpisode);
    global.openEmrModal?.('surgicalSafetyModal');
  }

  async function saveSafetyChecklist() {
    const id = document.getElementById('surgicalSafetyEpisodeId')?.value || _currentEpisode?.id;
    if (!id) return;
    const checklist = {};
    document.querySelectorAll('#surgicalSafetyChecklistForm input[data-safety-key]').forEach((el) => {
      const key = el.getAttribute('data-safety-key');
      checklist[key] = { done: el.checked };
    });
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/safety-checklist`, {
        method: 'POST',
        body: { checklist }
      });
      global.closeEmrModal?.('surgicalSafetyModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to save safety checklist.');
    }
  }

  async function applyOverride() {
    const id = document.getElementById('surgicalSafetyEpisodeId')?.value || _currentEpisode?.id;
    const reason = document.getElementById('surgicalOverrideReason')?.value?.trim();
    if (!id || !reason) {
      showActionError(null, 'Override reason is required.');
      return;
    }
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/safety-override`, {
        method: 'POST',
        body: {
          reason,
          emergency: document.getElementById('surgicalOverrideEmergency')?.checked
        }
      });
      global.closeEmrModal?.('surgicalSafetyModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to apply safety override.');
    }
  }

  function fillScheduleModal(ep) {
    document.getElementById('surgicalScheduleEpisodeId').value = ep.id;
    document.getElementById('surgicalScheduleDateInput').value = fmtDate(ep.scheduledAt) !== '—' ? fmtDate(ep.scheduledAt) : new Date().toISOString().slice(0, 10);
    document.getElementById('surgicalScheduleSurgeon').value = ep.surgeonName || '';
    document.getElementById('surgicalScheduleNotes').value = ep.notes || '';
  }

  async function openScheduleForEpisode(id) {
    const ep = _episodes.find((x) => x.id === id) || await fetchEpisode(id);
    if (!ep) return;
    _currentEpisode = ep;
    fillScheduleModal(ep);
    global.openEmrModal?.('surgicalScheduleModal');
  }

  function openScheduleModal() {
    if (!_currentEpisode) {
      showActionError(null, 'Open an episode first.');
      return;
    }
    fillScheduleModal(_currentEpisode);
    global.openEmrModal?.('surgicalScheduleModal');
  }

  async function saveSchedule() {
    const id = document.getElementById('surgicalScheduleEpisodeId')?.value || _currentEpisode?.id;
    const procedureDate = document.getElementById('surgicalScheduleDateInput')?.value;
    if (!id || !procedureDate) return;
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/schedule-ot`, {
        method: 'POST',
        body: {
          procedureDate,
          startTime: document.getElementById('surgicalScheduleTime')?.value || null,
          durationMinutes: Number(document.getElementById('surgicalScheduleDuration')?.value || 60),
          theatre: document.getElementById('surgicalScheduleTheatre')?.value,
          surgeonName: document.getElementById('surgicalScheduleSurgeon')?.value,
          notes: document.getElementById('surgicalScheduleNotes')?.value
        }
      });
      global.closeEmrModal?.('surgicalScheduleModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to schedule OT.');
    }
  }

  async function advanceStage(id) {
    if (!apiOn()) return;
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/advance`, {
        method: 'POST',
        body: {}
      });
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to advance stage.');
    }
  }

  async function advanceCurrentEpisode() {
    const id = document.getElementById('surgicalEpisodeId')?.value || _currentEpisode?.id;
    if (!id) return;
    await advanceStage(id);
    const ep = await fetchEpisode(id);
    if (ep) renderEpisodeDetail(ep);
  }

  function init() {
    const picker = document.getElementById('surgicalDatePicker');
    if (picker && !picker.value) picker.value = new Date().toISOString().slice(0, 10);
    const schedPicker = document.getElementById('surgicalScheduleDate');
    if (schedPicker && !schedPicker.value) schedPicker.value = new Date().toISOString().slice(0, 10);
    switchPanel('dashboard');
    refreshAll().catch(() => {});
  }

  global.CorneaSurgicalCentre = {
    init,
    switchPanel,
    refreshAll,
    refreshDashboard,
    renderWaitingList,
    renderPreopPanel,
    renderSchedulingPanel,
    openNewEpisodeModal,
    saveNewEpisode,
    openEpisodeDetail,
    openPreopModal,
    openPreopForEpisode,
    savePreop,
    openSafetyModal,
    openSafetyForEpisode,
    saveSafetyChecklist,
    applyOverride,
    openScheduleModal,
    openScheduleForEpisode,
    saveSchedule,
    advanceStage,
    advanceCurrentEpisode
  };
  global.initSurgicalCentreTab = () => global.CorneaSurgicalCentre.init();
})(window);

