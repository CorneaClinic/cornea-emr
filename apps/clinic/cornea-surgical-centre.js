/**
 * Surgical Centre — Phases 1–4: workflow, pre-op, intra-op WHO, recovery, post-op.
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
    scheduling: 'surgicalSchedulingPanel',
    intraop: 'surgicalIntraopPanel',
    recovery: 'surgicalRecoveryPanel',
    postop: 'surgicalPostopPanel'
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
    const args = JSON.stringify([id]);
    return `<button type="button" class="btn-secondary btn-sm" data-csp-action="CorneaSurgicalCentre.${fn}" data-csp-args='${args}'><i class="fa-solid ${icon}"></i> ${esc(label)}</button>`;
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

    syncRoleDashboardStats(d);

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

  function syncRoleDashboardStats(d) {
    const map = {
      roleW_otSched: d.todaysCases || 0,
      roleW_inBlock: d.inBlockRoom || 0,
      roleW_inOt: d.inOt || 0,
      roleW_inRecovery: d.inRecovery || 0,
      roleW_sxPending: d.pendingDecisions || 0,
      roleW_postopDue: d.postopDue || 0
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    });
    global.CorneaRoleDashboard?.syncWidgetValues?.();
  }

  function whoSummary(ep) {
    return [
      ep.whoSignInStatus === 'COMPLETED' ? 'SI✓' : 'SI—',
      ep.whoTimeOutStatus === 'COMPLETED' ? 'TO✓' : 'TO—',
      ep.whoSignOutStatus === 'COMPLETED' ? 'SO✓' : 'SO—'
    ].join(' ');
  }

  function renderIntraopPanel() {
    const host = document.getElementById('surgicalIntraopBody');
    if (!host) return;
    const rows = _episodes.filter((e) =>
      ['BLOCK_ROOM', 'OPERATING_THEATRE', 'PRE_OP_VERIFICATION', 'OT_SCHEDULING'].includes(e.stage) ||
      e.workflowStatus === 'OPEN'
    ).filter((e) => ['BLOCK_ROOM', 'OPERATING_THEATRE', 'PRE_OP_VERIFICATION', 'OT_SCHEDULING'].includes(e.stage) || e.scheduledAt);
    const list = rows.length ? rows : _episodes.filter((e) => ['BLOCK_ROOM', 'OPERATING_THEATRE'].includes(e.stage));
    if (!list.length) {
      host.innerHTML = '<tr><td colspan="6" class="text-muted">No cases in block room or theatre.</td></tr>';
      return;
    }
    host.innerHTML = list.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(stageLabel(e.stage))}</td>
        <td>${esc(whoSummary(e))}</td>
        <td>${esc(e.surgeonName || '—')}</td>
        <td class="no-print">
          ${actionBtn('WHO', 'fa-clipboard-list', 'openWhoForEpisode', e.id)}
          ${actionBtn('Start', 'fa-play', 'recordEventForEpisode', e.id + ':SURGERY_STARTED')}
          ${actionBtn('Complete', 'fa-check', 'recordEventForEpisode', e.id + ':SURGERY_COMPLETED')}
        </td>
      </tr>
    `).join('');
  }

  function renderRecoveryPanel() {
    const host = document.getElementById('surgicalRecoveryBody');
    if (!host) return;
    const rows = _episodes.filter((e) => ['RECOVERY', 'WARD_DAY_CARE', 'DISCHARGE'].includes(e.stage));
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="6" class="text-muted">No patients in recovery or discharge workflow.</td></tr>';
      return;
    }
    host.innerHTML = rows.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(e.plannedProcedure)}</td>
        <td>${esc(stageLabel(e.stage))}</td>
        <td>${esc(fmtDate(e.surgeryCompletedAt))}</td>
        <td class="no-print">${actionBtn('Discharge', 'fa-door-open', 'recordEventForEpisode', e.id + ':DISCHARGED')}</td>
      </tr>
    `).join('');
  }

  function renderPostopPanel() {
    const host = document.getElementById('surgicalPostopBody');
    if (!host) return;
    const rows = _episodes.filter((e) =>
      e.stage.startsWith('POST_OP_') || e.stage === 'LONG_TERM_FOLLOW_UP' || e.stage === 'FINAL_SURGICAL_OUTCOME' || e.surgeryCompletedAt
    );
    if (!rows.length) {
      host.innerHTML = '<tr><td colspan="5" class="text-muted">No post-operative episodes yet.</td></tr>';
      return;
    }
    host.innerHTML = rows.map((e) => `
      <tr>
        <td>${esc(e.surgicalEpisodeId)}</td>
        <td>${esc(e.patientName)}</td>
        <td>${esc(stageLabel(e.stage))}</td>
        <td>${esc((e.postopFollowups || []).length)} recorded</td>
        <td class="no-print">${actionBtn('Follow-up', 'fa-user-doctor', 'openPostopForEpisode', e.id)}</td>
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
    renderIntraopPanel();
    renderRecoveryPanel();
    renderPostopPanel();
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
      renderIntraopPanel();
      renderRecoveryPanel();
      renderPostopPanel();
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

  function openFromNav(panel) {
    if (typeof global.switchTab === 'function') global.switchTab('surgicalCentreTab');
    switchPanel(panel || 'dashboard');
    refreshAll().catch(() => {});
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
    ['surgicalNewPatientName', 'surgicalNewPatientMrn', 'surgicalNewDiagnosis', 'surgicalNewProcedure', 'surgicalNewSurgeon', 'surgicalNewNotes', 'surgicalNewKpId'].forEach((id) => {
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
      const kpId = document.getElementById('surgicalNewKpId')?.value?.trim() || null;
      const res = await global.CorneaApi.request('/api/v1/surgical-centre/episodes', {
        method: 'POST',
        body: {
          patientName,
          patientMrn: document.getElementById('surgicalNewPatientMrn')?.value?.trim() || null,
          diagnosis,
          plannedProcedure,
          eye: document.getElementById('surgicalNewEye')?.value || 'OD',
          priority: document.getElementById('surgicalNewPriority')?.value || 'ELECTIVE',
          surgeonName: document.getElementById('surgicalNewSurgeon')?.value?.trim() || null,
          notes: document.getElementById('surgicalNewNotes')?.value?.trim() || null,
          keratoplastyPatientId: kpId || undefined
        }
      });
      const created = res?.data;
      if (created?.id && kpId) {
        await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(created.id)}/link-keratoplasty`, {
          method: 'POST',
          body: { keratoplastyPatientId: kpId }
        }).catch(() => {});
      }
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

  async function recordEpisodeEvent(id, event, extra = {}) {
    if (!id || !event || !apiOn()) return;
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/events`, {
        method: 'POST',
        body: { event, ...extra }
      });
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to record episode event.');
    }
  }

  async function recordEventForEpisode(combined) {
    const sep = String(combined).indexOf(':');
    if (sep < 0) return;
    const id = combined.slice(0, sep);
    const event = combined.slice(sep + 1);
    await recordEpisodeEvent(id, event);
  }

  async function recordConsentComplete() {
    const id = document.getElementById('surgicalEpisodeId')?.value || _currentEpisode?.id;
    if (!id) return;
    await recordEpisodeEvent(id, 'CONSENT_COMPLETE');
    const ep = await fetchEpisode(id);
    if (ep) renderEpisodeDetail(ep);
  }

  function renderWhoPhaseForm() {
    const host = document.getElementById('surgicalWhoChecklistForm');
    const phaseId = document.getElementById('surgicalWhoPhase')?.value || 'sign_in';
    if (!host) return;
    const phase = (_workflow?.whoChecklistPhases || []).find((p) => p.id === phaseId);
    const checklist = _currentEpisode?.whoChecklist || {};
    const entries = checklist[phaseId] || {};
    if (!phase) {
      host.innerHTML = '<p class="form-hint">WHO checklist template unavailable.</p>';
      return;
    }
    host.innerHTML = phase.items.map((item) => {
      const entry = entries[item.key] || {};
      const checked = entry.done ? 'checked' : '';
      return `<label class="d-block mb-2"><input type="checkbox" data-who-key="${esc(item.key)}" ${checked} /> ${esc(item.label)}</label>`;
    }).join('');
  }

  async function openWhoForEpisode(id) {
    await fetchWorkflow();
    const ep = _episodes.find((x) => x.id === id) || await fetchEpisode(id);
    if (!ep) return;
    _currentEpisode = ep;
    document.getElementById('surgicalWhoEpisodeId').value = ep.id;
    renderWhoPhaseForm();
    global.openEmrModal?.('surgicalWhoModal');
  }

  function openWhoModal() {
    if (!_currentEpisode) {
      showActionError(null, 'Open an episode first.');
      return;
    }
    document.getElementById('surgicalWhoEpisodeId').value = _currentEpisode.id;
    renderWhoPhaseForm();
    global.openEmrModal?.('surgicalWhoModal');
  }

  async function saveWhoChecklist() {
    const id = document.getElementById('surgicalWhoEpisodeId')?.value || _currentEpisode?.id;
    const phase = document.getElementById('surgicalWhoPhase')?.value;
    if (!id || !phase) return;
    const checklist = {};
    checklist[phase] = {};
    document.querySelectorAll('#surgicalWhoChecklistForm input[data-who-key]').forEach((el) => {
      const key = el.getAttribute('data-who-key');
      checklist[phase][key] = { done: el.checked };
    });
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/who-checklist`, {
        method: 'POST',
        body: { phase, checklist: checklist[phase] }
      });
      global.closeEmrModal?.('surgicalWhoModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to save WHO checklist.');
    }
  }

  function fillPostopModal(ep) {
    document.getElementById('surgicalPostopEpisodeId').value = ep.id;
    const sel = document.getElementById('surgicalPostopMilestone');
    if (sel) {
      const milestones = _workflow?.postopMilestoneStages || [];
      sel.innerHTML = milestones.map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
    }
    document.getElementById('surgicalPostopDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('surgicalPostopVa').value = '';
    document.getElementById('surgicalPostopGraft').value = '';
    document.getElementById('surgicalPostopComplications').value = '';
    document.getElementById('surgicalPostopNotes').value = '';
  }

  async function openPostopForEpisode(id) {
    await fetchWorkflow();
    const ep = _episodes.find((x) => x.id === id) || await fetchEpisode(id);
    if (!ep) return;
    _currentEpisode = ep;
    fillPostopModal(ep);
    global.openEmrModal?.('surgicalPostopModal');
  }

  async function savePostopFollowup() {
    const id = document.getElementById('surgicalPostopEpisodeId')?.value || _currentEpisode?.id;
    if (!id) return;
    try {
      await global.CorneaApi.request(`/api/v1/surgical-centre/episodes/${encodeURIComponent(id)}/postop-followup`, {
        method: 'POST',
        body: {
          milestoneId: document.getElementById('surgicalPostopMilestone')?.value,
          visitDate: document.getElementById('surgicalPostopDate')?.value,
          visualAcuity: document.getElementById('surgicalPostopVa')?.value,
          graftStatus: document.getElementById('surgicalPostopGraft')?.value,
          complications: document.getElementById('surgicalPostopComplications')?.value,
          notes: document.getElementById('surgicalPostopNotes')?.value,
          completed: true
        }
      });
      global.closeEmrModal?.('surgicalPostopModal');
      await refreshAll();
    } catch (err) {
      showActionError(err, 'Unable to save post-operative follow-up.');
    }
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
    openFromNav,
    refreshAll,
    refreshDashboard,
    renderWaitingList,
    renderPreopPanel,
    renderSchedulingPanel,
    renderIntraopPanel,
    renderRecoveryPanel,
    renderPostopPanel,
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
    openWhoModal,
    openWhoForEpisode,
    renderWhoPhaseForm,
    saveWhoChecklist,
    openPostopForEpisode,
    savePostopFollowup,
    recordEventForEpisode,
    recordConsentComplete,
    advanceStage,
    advanceCurrentEpisode
  };
  global.initSurgicalCentreTab = () => global.CorneaSurgicalCentre.init();
})(window);

