/**
 * Laser Refractive Surgery Work-up Module
 */
(function (global) {
  'use strict';

  const T = () => global.CorneaLaserRefractiveTaxonomy || {};

  function emptyWorkup() {
    return {
      assessment: {},
      refraction: { od: {}, os: {}, shared: {} },
      corneal: { od: {}, os: {}, shared: {} },
      ocularSurface: { od: {}, os: {}, shared: {} },
      topography: { od: {}, os: {}, shared: {}, images: [] },
      aberrometry: { od: {}, os: {}, shared: {} },
      risk: { override: '' },
      planning: { flapThickness: '110', capThickness: '120', opticalZone: '6.5', transitionZone: '8.5', selectedProcedure: '', notes: '' },
      aiAdvisor: { decisions: {}, log: [], collapsed: false, lastReport: null },
      consent: { procedure: '', signed: false, signedAt: '', topics: {}, risksDiscussed: [], notes: '' },
      surgery: { records: [] },
      followUp: { visits: [] },
      outcomes: {},
      images: []
    };
  }

  function defaultState() {
    return { version: 1, activeTab: 'assessment', workup: emptyWorkup(), history: [] };
  }

  let state = defaultState();
  let autoSaveTimer = null;

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseState(raw) {
    if (!raw) return defaultState();
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const base = defaultState();
      const w = p.workup || {};
      return {
        version: p.version || 1,
        activeTab: p.activeTab || 'assessment',
        workup: {
          ...base.workup,
          ...w,
          refraction: { ...base.workup.refraction, ...w.refraction, od: { ...base.workup.refraction.od, ...w.refraction?.od }, os: { ...base.workup.refraction.os, ...w.refraction?.os }, shared: { ...base.workup.refraction.shared, ...w.refraction?.shared } },
          corneal: { ...base.workup.corneal, ...w.corneal, od: { ...base.workup.corneal.od, ...w.corneal?.od }, os: { ...base.workup.corneal.os, ...w.corneal?.os } },
          ocularSurface: { ...base.workup.ocularSurface, ...w.ocularSurface, od: { ...base.workup.ocularSurface.od, ...w.ocularSurface?.od }, os: { ...base.workup.ocularSurface.os, ...w.ocularSurface?.os } },
          topography: { ...base.workup.topography, ...w.topography, od: { ...base.workup.topography.od, ...w.topography?.od }, os: { ...base.workup.topography.os, ...w.topography?.os }, images: w.topography?.images || [] },
          aberrometry: { ...base.workup.aberrometry, ...w.aberrometry, od: { ...base.workup.aberrometry.od, ...w.aberrometry?.od }, os: { ...base.workup.aberrometry.os, ...w.aberrometry?.os } },
          aiAdvisor: { ...base.workup.aiAdvisor, ...w.aiAdvisor },
          consent: { ...base.workup.consent, ...w.consent, topics: { ...base.workup.consent.topics, ...w.consent?.topics } },
          surgery: { records: Array.isArray(w.surgery?.records) ? w.surgery.records : [] },
          followUp: { visits: Array.isArray(w.followUp?.visits) ? w.followUp.visits : [] },
          outcomes: { ...base.workup.outcomes, ...w.outcomes },
          images: Array.isArray(w.images) ? w.images : []
        },
        history: Array.isArray(p.history) ? p.history : []
      };
    } catch {
      return defaultState();
    }
  }

  function hasLaserData(raw) {
    if (!raw || raw === '{}') return false;
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const w = p.workup || {};
      if ((w.surgery?.records || []).length) return true;
      if ((w.followUp?.visits || []).length) return true;
      if (w.consent?.signed) return true;
      if (w.planning?.selectedProcedure) return true;
      if (Object.keys(w.assessment || {}).length > 2) return true;
      if (w.refraction?.od?.manifestSph || w.refraction?.os?.manifestSph) return true;
      if (w.corneal?.od?.pachymetry || w.corneal?.os?.pachymetry) return true;
      return false;
    } catch {
      return false;
    }
  }

  function syncHiddenField() {
    const el = document.getElementById('laserRefractiveJSON');
    if (!el) return;
    const risk = T().computeRisk?.(state.workup);
    const planning = T().computePlanning?.(state.workup);
    el.value = (global.safeJsonStringify || JSON.stringify)({
      version: 1,
      activeTab: state.activeTab,
      workup: state.workup,
      computed: { risk: risk?.level, planning },
      history: state.history,
      updatedAt: new Date().toISOString()
    });
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(syncHiddenField, 300);
  }

  function panelId(tabId) {
    return 'lrPanel' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
  }

  function chipGroup(id, options, selected, multi) {
    const sel = multi ? (selected || []) : [selected].filter(Boolean);
    return `<div class="lr-chip-group" id="${id}" data-multi="${multi ? '1' : '0'}">${(options || []).map((o) => {
      const on = sel.includes(o);
      return `<button type="button" class="lr-chip${on ? ' active' : ''}" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button>`;
    }).join('')}</div>`;
  }

  function fieldInput(key, val, type) {
    const t = type === 'date' ? 'date' : 'text';
    return `<input type="${t}" class="lr-field" data-lr-key="${key}" value="${escapeHtml(val || '')}" placeholder="—" />`;
  }

  function fieldSelect(key, val, options) {
    return `<select class="lr-field" data-lr-key="${key}"><option value="">—</option>${(options || []).map((o) => `<option value="${escapeHtml(o)}"${o === val ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`;
  }

  function renderFields(fields, dataOd, dataOs, shared, prefix) {
    return `<div class="lr-grid">${(fields || []).map((f) => {
      if (f.full) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label><textarea class="lr-notes" data-lr-key="${f.key}" data-lr-scope="shared">${escapeHtml(shared?.[f.key] || '')}</textarea></div>`;
      if (f.chip && f.shared) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${chipGroup(`${prefix}-${f.key}`, f.chip, shared?.[f.key], false)}</div>`;
      if (f.select && f.shared) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${fieldSelect(f.key, shared?.[f.key], f.select)}</div>`;
      if (f.od && f.os) {
        if (f.chip) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label><div class="lr-od-os-chips"><span>OD</span>${chipGroup(`${prefix}-od-${f.key}`, f.chip, dataOd?.[f.key], false)}<span>OS</span>${chipGroup(`${prefix}-os-${f.key}`, f.chip, dataOs?.[f.key], false)}</div></div>`;
        if (f.select) return `<div class="lr-row"><label>OD ${escapeHtml(f.label)}</label>${fieldSelect(f.key, dataOd?.[f.key], f.select)}</div><div class="lr-row"><label>OS ${escapeHtml(f.label)}</label>${fieldSelect(f.key, dataOs?.[f.key], f.select)}</div>`;
        return `<div class="lr-row"><label>OD ${escapeHtml(f.label)}</label>${fieldInput(f.key, dataOd?.[f.key])}</div><div class="lr-row"><label>OS ${escapeHtml(f.label)}</label>${fieldInput(f.key, dataOs?.[f.key])}</div>`;
      }
      if (f.shared) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${fieldInput(f.key, shared?.[f.key])}</div>`;
      return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${fieldInput(f.key, shared?.[f.key] ?? dataOd?.[f.key])}</div>`;
    }).join('')}</div>`;
  }

  function renderAlerts() {
    const box = document.getElementById('lrAlertsBox');
    if (!box) return;
    const alerts = T().computeSafetyAlerts?.(state.workup) || [];
    if (!alerts.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div class="lr-alerts"><strong><i class="fa-solid fa-triangle-exclamation"></i> Safety alerts</strong><ul>${alerts.map((a) => `<li>${escapeHtml(a.msg)}</li>`).join('')}</ul></div>`;
  }

  function renderRiskPanel() {
    const risk = T().computeRisk?.(state.workup) || {};
    const factors = risk.factors || {};
    return `<h4 class="lr-panel-title">Risk Assessment</h4>
      <div class="lr-risk-banner lr-risk-${(risk.level || '').replace(/\s/g, '-').toLowerCase()}"><strong>${escapeHtml(risk.level || 'Incomplete')}</strong> (score ${risk.score ?? '—'})</div>
      <div class="lr-grid">${Object.entries(factors).map(([k, v]) => `<div class="lr-row"><label>${escapeHtml(k)}</label><span class="lr-risk-val lr-risk-${String(v).toLowerCase()}">${escapeHtml(v)}</span></div>`).join('')}</div>
      ${risk.warnings?.length ? `<div class="lr-alerts"><ul>${risk.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : ''}
      <div class="lr-row span-full"><label>Clinician override / notes</label><textarea class="lr-notes" id="lrRiskOverride">${escapeHtml(state.workup.risk.override || '')}</textarea></div>`;
  }

  function renderPlanningPanel() {
    const plan = T().computePlanning?.(state.workup) || {};
    const w = state.workup.planning;
    const suitRows = Object.entries(plan.suitability || {}).map(([proc, val]) =>
      `<tr><td>${escapeHtml(proc)}</td><td class="lr-suit-${String(val).replace(/\s/g, '-').toLowerCase()}">${escapeHtml(val)}</td></tr>`
    ).join('');
    return `<h4 class="lr-panel-title">Surgical Planning</h4>
      <div class="lr-toolbar no-print"><button type="button" class="btn-secondary btn-sm" data-lr-action="calc-plan">Recalculate</button></div>
      <div class="lr-grid">
        <div class="lr-row"><label>Flap thickness (µm)</label>${fieldInput('flapThickness', w.flapThickness)}</div>
        <div class="lr-row"><label>Cap thickness (µm)</label>${fieldInput('capThickness', w.capThickness)}</div>
        <div class="lr-row"><label>Optical zone (mm)</label>${fieldInput('opticalZone', w.opticalZone)}</div>
        <div class="lr-row"><label>Transition zone (mm)</label>${fieldInput('transitionZone', w.transitionZone)}</div>
        <div class="lr-row"><label>Selected procedure</label>${fieldSelect('selectedProcedure', w.selectedProcedure, T().PROCEDURES)}</div>
      </div>
      <div class="lr-calc-box">
        <p><strong>Ablation depth:</strong> ${escapeHtml(plan.ablationDepth ?? '—')} µm</p>
        <p><strong>Residual stromal bed:</strong> ${escapeHtml(plan.residualStromalBed ?? '—')} µm</p>
        <p><strong>PTA:</strong> ${escapeHtml(plan.ptaPercent ?? '—')}%</p>
        <p><strong>Safety margin:</strong> ${escapeHtml(plan.safetyMargin ?? '—')} µm</p>
        <p><strong>Recommended:</strong> ${escapeHtml(plan.recommendedProcedure ?? '—')}</p>
      </div>
      <h5>Procedure suitability</h5>
      <div class="table-wrapper"><table class="clinic-table"><thead><tr><th>Procedure</th><th>Suitability</th></tr></thead><tbody>${suitRows || '<tr><td colspan="2">Enter refraction and corneal data</td></tr>'}</tbody></table></div>
      <textarea class="lr-notes" id="lrPlanNotes" placeholder="Planning notes">${escapeHtml(w.notes || '')}</textarea>`;
  }

  function getAiReport() {
    if (!global.CorneaLaserRefractiveAdvisor) return null;
    state.workup.aiAdvisor = state.workup.aiAdvisor || { decisions: {}, log: [], collapsed: false };
    const report = global.CorneaLaserRefractiveAdvisor.analyze(state.workup, { activeTab: state.activeTab });
    state.workup.aiAdvisor.lastReport = report;
    state.workup.aiAdvisor._lastWorkup = state.workup;
    return report;
  }

  async function enrichAiReportFromCloud() {
    if (!global.CorneaEctasiaAI || !global.__corneaCloudMode) return;
    if (state.workup.aiAdvisor?.lastReport?.ectasiaAi?.source === 'cloud') return;
    const metrics = global.CorneaEctasiaAI.metricsFromWorkup(state.workup);
    const analysis = await global.CorneaEctasiaAI.analyze(metrics);
    const base = state.workup.aiAdvisor?.lastReport || getAiReport();
    const merged = global.CorneaEctasiaAI.mergeIntoAdvisorReport(base, analysis);
    state.workup.aiAdvisor.lastReport = merged;
    const root = document.getElementById('laserRefractiveBuilder');
    const col = root?.querySelector('.lr-planner-column');
    if (col && global.CorneaLaserRefractiveAdvisor) {
      col.innerHTML = global.CorneaLaserRefractiveAdvisor.renderPanel(merged, state.workup.aiAdvisor);
      bindAiPlannerButtons(root);
    }
  }

  let plannerRefreshTimer = null;

  function refreshAiPlannerPanel() {
    const root = document.getElementById('laserRefractiveBuilder');
    const col = root?.querySelector('.lr-planner-column');
    if (!col || !global.CorneaLaserRefractiveAdvisor) return;
    const report = getAiReport();
    col.innerHTML = global.CorneaLaserRefractiveAdvisor.renderPanel(report, state.workup.aiAdvisor);
    bindAiPlannerButtons(root);
    enrichAiReportFromCloud().catch(() => {});
  }

  let plannerKeyBound = false;

  function bindAiPlannerButtons(root) {
    const panel = root.querySelector('#lrAiPlanner');
    if (!panel) return;
    panel.querySelector('#lrAiToggleCollapse')?.addEventListener('click', () => {
      state.workup.aiAdvisor.collapsed = !state.workup.aiAdvisor.collapsed;
      syncHiddenField();
      refreshAiPlannerPanel();
    });
    panel.querySelectorAll('[data-lr-ai-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = btn.dataset.lrAiAction === 'modify' ? (prompt('Modification note (optional):') || '') : '';
        global.CorneaLaserRefractiveAdvisor.recordDecision(state.workup.aiAdvisor, btn.dataset.recId, btn.dataset.lrAiAction, note, state.workup);
        syncHiddenField();
        buildPanels();
      });
    });
  }

  function bindAiPlannerEvents(root) {
    bindAiPlannerButtons(root);
    if (plannerKeyBound) return;
    plannerKeyBound = true;
    root.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.altKey) return;
      const panel = root.querySelector('#lrAiPlanner');
      if (!panel) return;
      const rec = panel.querySelector('.lr-ai-rec:not(.accepted):not(.rejected)');
      if (!rec) return;
      const id = rec.dataset.recId;
      if (e.key === 'a' || e.key === 'A') {
        global.CorneaLaserRefractiveAdvisor.recordDecision(state.workup.aiAdvisor, id, 'accept', '', state.workup);
        syncHiddenField();
        buildPanels();
      }
      if (e.key === 'r' || e.key === 'R') {
        global.CorneaLaserRefractiveAdvisor.recordDecision(state.workup.aiAdvisor, id, 'reject', '', state.workup);
        syncHiddenField();
        buildPanels();
      }
    });
  }

  function renderAiTabExtra(report) {
    const pc = report?.patientCounseling;
    if (!pc) return '';
    return `<div class="lr-counseling-box">
      <h4>Patient Counseling (AI-generated draft)</h4>
      <p>${escapeHtml(pc.summary)}</p>
      <p><strong>Benefits:</strong> ${escapeHtml(pc.benefits)}</p>
      <p><strong>Risks:</strong> ${escapeHtml(pc.risks)}</p>
      <p><strong>Alternatives:</strong> ${escapeHtml(pc.alternatives)}</p>
      <p class="form-hint">Review and edit before sharing with patient. Surgeon approves final counseling.</p>
    </div>`;
  }

  function renderAiPanel() {
    const report = getAiReport();
    return `<h4 class="lr-panel-title">AI Surgical Advisor — Full View</h4>
      <p class="form-hint">The AI Planner panel remains visible on the left throughout all tabs. Use this tab for patient counseling draft and detailed review.</p>
      ${renderAiTabExtra(report)}
      <div class="lr-ai-tab-detail">${report ? global.CorneaLaserRefractiveAdvisor.renderPanel(report, state.workup.aiAdvisor) : ''}</div>`;
  }

  function renderConsentPanel() {
    const c = state.workup.consent;
    return `<h4 class="lr-panel-title">Informed Consent</h4>
      <div class="lr-row span-full"><label>Procedure</label>${fieldSelect('consentProcedure', c.procedure, T().PROCEDURES)}</div>
      <h5>Topics discussed</h5><div class="lr-check-grid">${(T().CONSENT_TOPICS || []).map((t) => `<label class="lr-check"><input type="checkbox" data-lr-consent-topic value="${escapeHtml(t)}" ${c.topics[t] ? 'checked' : ''} /> ${escapeHtml(t)}</label>`).join('')}</div>
      <h5>Risks discussed</h5>${chipGroup('lr-consent-risks', T().CONSENT_RISKS, c.risksDiscussed, true)}
      <label class="lr-check"><input type="checkbox" id="lrConsentSigned" ${c.signed ? 'checked' : ''} /> Consent signed</label>
      <div class="lr-row"><label>Signed date</label>${fieldInput('signedAt', c.signedAt, 'date')}</div>
      <textarea class="lr-notes" id="lrConsentNotes" placeholder="Consent notes">${escapeHtml(c.notes || '')}</textarea>`;
  }

  function renderSurgeryPanel() {
    const recs = state.workup.surgery.records || [];
    return `<h4 class="lr-panel-title">Surgery Record</h4>
      <div class="table-wrapper"><table class="clinic-table"><thead><tr><th>Date</th><th>Procedure</th><th>Eye</th><th>Surgeon</th><th></th></tr></thead>
      <tbody>${recs.length ? recs.map((r, i) => `<tr><td>${escapeHtml(r.date || '')}</td><td>${escapeHtml(r.procedure || '')}</td><td>${escapeHtml(r.eye || '')}</td><td>${escapeHtml(r.surgeon || '')}</td><td class="no-print"><button type="button" class="btn-secondary btn-sm" data-lr-sx-load="${i}">Load</button></td></tr>`).join('') : '<tr><td colspan="5">No surgery records</td></tr>'}</tbody></table></div>
      <h5>Add / edit record</h5><div class="lr-grid">${(T().SURGERY_FIELDS || []).map((f) => {
        if (f.full) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label><textarea class="lr-notes" data-lr-sx-key="${f.key}">${escapeHtml(state._sxDraft?.[f.key] || '')}</textarea></div>`;
        if (f.type === 'date') return `<div class="lr-row"><label>${escapeHtml(f.label)}</label>${fieldInput(f.key, state._sxDraft?.[f.key], 'date')}</div>`;
        if (f.select) return `<div class="lr-row"><label>${escapeHtml(f.label)}</label>${fieldSelect(f.key, state._sxDraft?.[f.key], f.select)}</div>`;
        if (f.chip) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${chipGroup(`lr-sx-${f.key}`, f.chip, state._sxDraft?.[f.key], false)}</div>`;
        return `<div class="lr-row"><label>${escapeHtml(f.label)}</label><input class="lr-field" data-lr-sx-key="${f.key}" value="${escapeHtml(state._sxDraft?.[f.key] || '')}" /></div>`;
      }).join('')}</div>
      <div class="lr-toolbar no-print"><button type="button" class="btn-primary btn-sm" data-lr-action="sx-add"><i class="fa-solid fa-plus"></i> Save record</button></div>`;
  }

  function renderFollowUpPanel() {
    const visits = state.workup.followUp.visits || [];
    return `<h4 class="lr-panel-title">Follow-up</h4>
      <div class="lr-fu-quick no-print">${(T().FOLLOW_UP_VISITS || []).map((v) => `<button type="button" class="btn-secondary btn-sm" data-lr-fu-template="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')}</div>
      <div class="table-wrapper"><table class="clinic-table"><thead><tr><th>Visit</th><th>Date</th><th>UCVA OD/OS</th><th>Notes</th><th></th></tr></thead>
      <tbody>${visits.length ? visits.map((v, i) => `<tr><td>${escapeHtml(v.label || '')}</td><td>${escapeHtml(v.date || '')}</td><td>${escapeHtml(v.od?.ucva || '—')} / ${escapeHtml(v.os?.ucva || '—')}</td><td>${escapeHtml(v.complications || '—')}</td><td class="no-print"><button type="button" class="btn-secondary btn-sm" data-lr-fu-load="${i}">Load</button></td></tr>`).join('') : '<tr><td colspan="5">No follow-up visits recorded</td></tr>'}</tbody></table></div>
      <h5>Current visit entry</h5>
      <div class="lr-row"><label>Visit label</label>${fieldInput('fuLabel', state._fuDraft?.label)}</div>
      <div class="lr-row"><label>Date</label>${fieldInput('fuDate', state._fuDraft?.date, 'date')}</div>
      ${renderFields(T().FOLLOW_UP_FIELDS, state._fuDraft?.od || {}, state._fuDraft?.os || {}, state._fuDraft || {}, 'lr-fu')}
      <div class="lr-toolbar no-print"><button type="button" class="btn-primary btn-sm" data-lr-action="fu-add">Save visit</button></div>`;
  }

  function renderOutcomesPanel() {
    const o = state.workup.outcomes;
    return `<h4 class="lr-panel-title">Outcomes</h4>
      <div class="lr-grid">${(T().OUTCOME_METRICS || []).map((f) => {
        if (f.chip) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${chipGroup(`lr-out-${f.key}`, f.chip, o[f.key], false)}</div>`;
        if (f.select) return `<div class="lr-row span-full"><label>${escapeHtml(f.label)}</label>${fieldSelect(f.key, o[f.key], f.select)}</div>`;
        return `<div class="lr-row"><label>${escapeHtml(f.label)}</label>${fieldInput(f.key, o[f.key])}</div>`;
      }).join('')}</div>`;
  }

  function renderImagesPanel() {
    const imgs = [...(state.workup.images || []), ...(state.workup.topography?.images || [])];
    return `<h4 class="lr-panel-title">Imaging</h4>
      <div class="lr-toolbar no-print"><label class="btn-secondary btn-sm"><i class="fa-solid fa-upload"></i> Import<input type="file" accept="image/*" data-lr-image hidden /></label>
      <select id="lrImageCat" class="lr-field" style="max-width:180px">${(T().IMAGE_CATEGORIES || []).map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select></div>
      <div class="lr-image-list">${imgs.length ? imgs.map((img, i) => `<div class="lr-image-card"><img src="${img.dataUrl}" alt="${escapeHtml(img.label || img.category)}" /><span>${escapeHtml(img.category || '')}</span><button type="button" class="btn-danger btn-sm no-print" data-lr-img-rm="${i}">×</button></div>`).join('') : '<p class="form-hint">No images imported</p>'}</div>`;
  }

  function buildPanels() {
    const root = document.getElementById('laserRefractiveBuilder');
    if (!root) return;
    state._sxDraft = state._sxDraft || {};
    state._fuDraft = state._fuDraft || { od: {}, os: {} };
    const tabs = T().LR_TABS || [];
    const w = state.workup;

    const report = getAiReport();
    const plannerHtml = global.CorneaLaserRefractiveAdvisor?.renderPanel(report, w.aiAdvisor) || '';

    root.innerHTML = `<div class="lr-module-layout">
      <aside class="lr-planner-column">${plannerHtml}</aside>
      <div class="lr-module-main">
      <div class="lr-progress no-print">${tabs.map((t, i) => `<span class="lr-progress-step${state.activeTab === t.id ? ' current' : ''}" data-lr-tab="${t.id}" title="${escapeHtml(t.label)}">${i + 1}</span>`).join('')}</div>
      <div class="lr-subnav no-print">${tabs.map((t) => `<button type="button" class="lr-subnav-btn${state.activeTab === t.id ? ' active' : ''}" data-lr-panel="${panelId(t.id)}"><i class="fa-solid ${t.icon}"></i> ${escapeHtml(t.label)}</button>`).join('')}</div>
      <div class="lr-templates no-print"><span>Shortcuts:</span>${Object.keys(T().NORMAL_TEMPLATES || {}).map((n) => `<button type="button" class="btn-secondary btn-sm" data-lr-template="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}
        <button type="button" class="btn-secondary btn-sm" data-lr-action="copy-od-os">Copy OD → OS</button></div>
      <div id="lrAlertsBox" hidden></div>
      <div id="lrPanelAssessment" class="lr-panel${state.activeTab === 'assessment' ? ' active' : ''}"><h4 class="lr-panel-title">Patient Assessment</h4>${renderFields(T().ASSESSMENT_FIELDS, {}, {}, w.assessment, 'lr-as')}</div>
      <div id="lrPanelRefraction" class="lr-panel${state.activeTab === 'refraction' ? ' active' : ''}">${renderFields(T().REFRACTION_FIELDS, w.refraction.od, w.refraction.os, w.refraction.shared, 'lr-rx')}</div>
      <div id="lrPanelCorneal" class="lr-panel${state.activeTab === 'corneal' ? ' active' : ''}"><h4 class="lr-panel-title">Corneal Evaluation</h4>${renderFields(T().CORNEAL_FIELDS, w.corneal.od, w.corneal.os, w.corneal.shared, 'lr-cor')}</div>
      <div id="lrPanelOcularSurface" class="lr-panel${state.activeTab === 'ocularSurface' ? ' active' : ''}"><h4 class="lr-panel-title">Tear Film & Ocular Surface</h4>${renderFields(T().OCULAR_SURFACE_FIELDS, w.ocularSurface.od, w.ocularSurface.os, w.ocularSurface.shared, 'lr-os')}</div>
      <div id="lrPanelTopography" class="lr-panel${state.activeTab === 'topography' ? ' active' : ''}"><h4 class="lr-panel-title">Topography & Tomography</h4>
        <div class="lr-toolbar no-print" style="margin-bottom:10px;">
          <button type="button" class="btn-secondary btn-sm" data-lr-action="pentacam-import"><i class="fa-solid fa-file-import"></i> Import Pentacam CSV</button>
          <button type="button" class="btn-secondary btn-sm" data-lr-action="sirius-import"><i class="fa-solid fa-file-import"></i> Import Sirius CSV</button>
        </div>
        ${renderFields(T().TOPOGRAPHY_FIELDS, w.topography.od, w.topography.os, w.topography.shared, 'lr-topo')}${renderImagesPanel()}</div>
      <div id="lrPanelAberrometry" class="lr-panel${state.activeTab === 'aberrometry' ? ' active' : ''}"><h4 class="lr-panel-title">Aberrometry</h4>${renderFields(T().ABERROMETRY_FIELDS, w.aberrometry.od, w.aberrometry.os, w.aberrometry.shared, 'lr-ab')}</div>
      <div id="lrPanelRisk" class="lr-panel${state.activeTab === 'risk' ? ' active' : ''}">${renderRiskPanel()}</div>
      <div id="lrPanelPlanning" class="lr-panel${state.activeTab === 'planning' ? ' active' : ''}">${renderPlanningPanel()}</div>
      <div id="lrPanelAiAdvisor" class="lr-panel${state.activeTab === 'aiAdvisor' ? ' active' : ''}">${renderAiPanel()}</div>
      <div id="lrPanelConsent" class="lr-panel${state.activeTab === 'consent' ? ' active' : ''}">${renderConsentPanel()}</div>
      <div id="lrPanelSurgery" class="lr-panel${state.activeTab === 'surgery' ? ' active' : ''}">${renderSurgeryPanel()}</div>
      <div id="lrPanelFollowUp" class="lr-panel${state.activeTab === 'followUp' ? ' active' : ''}">${renderFollowUpPanel()}</div>
      <div id="lrPanelOutcomes" class="lr-panel${state.activeTab === 'outcomes' ? ' active' : ''}">${renderOutcomesPanel()}</div>
      <div class="lr-print-bar no-print">
        <button type="button" class="btn-teal btn-sm" data-lr-print="workup"><i class="fa-solid fa-print"></i> Work-up summary</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="ai-workup"><i class="fa-solid fa-robot"></i> AI work-up</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="ai-plan">AI surgical plan</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="ai-risk">AI risk report</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="ai-counseling">Patient counseling</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="plan">Surgical plan</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="consent">Consent</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="operative">Operative note</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="followup">Follow-up</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-print="outcomes">Outcomes</button>
        <button type="button" class="btn-secondary btn-sm" data-lr-action="export"><i class="fa-solid fa-download"></i> Export JSON</button>
      </div>
      </div>
    </div>`;

    bindEvents(root);
    bindAiPlannerEvents(root);
    renderAlerts();
  }

  function switchTab(panelIdStr) {
    collectFromDom();
    const tab = (T().LR_TABS || []).find((t) => panelId(t.id) === panelIdStr);
    if (tab) state.activeTab = tab.id;
    syncHiddenField();
    buildPanels();
  }

  function getChipVals(id, multi) {
    const g = document.getElementById(id);
    if (!g) return multi ? [] : '';
    const active = [...g.querySelectorAll('.lr-chip.active')].map((b) => b.dataset.value);
    return multi ? active : (active[0] || '');
  }

  function collectSectionFields(sectionKey, hasOdOs) {
    const sec = state.workup[sectionKey];
    document.querySelectorAll(`#${panelId(state.activeTab)} .lr-field[data-lr-key]`).forEach((el) => {
      const key = el.dataset.lrKey;
      const label = el.closest('.lr-row')?.querySelector('label')?.textContent || '';
      if (label.startsWith('OD ')) sec.od[key] = el.value;
      else if (label.startsWith('OS ')) sec.os[key] = el.value;
      else sec.shared[key] = el.value;
    });
    document.querySelectorAll(`#${panelId(state.activeTab)} .lr-notes[data-lr-key]`).forEach((el) => {
      if (el.dataset.lrScope === 'shared') sec.shared[el.dataset.lrKey] = el.value;
      else sec[el.dataset.lrKey] = el.value;
    });
    if (sectionKey === 'assessment') {
      (T().ASSESSMENT_FIELDS || []).forEach((f) => {
        if (f.chip) sec[f.key] = getChipVals(`lr-as-${f.key}`, false);
        if (f.select) sec[f.key] = document.querySelector(`#lrPanelAssessment select[data-lr-key="${f.key}"]`)?.value || sec[f.key];
      });
    }
  }

  function collectFromDom() {
    (T().ASSESSMENT_FIELDS || []).forEach((f) => {
      const panel = document.getElementById('lrPanelAssessment');
      if (!panel) return;
      if (f.full) state.workup.assessment[f.key] = panel.querySelector(`textarea[data-lr-key="${f.key}"]`)?.value || '';
      else if (f.chip) state.workup.assessment[f.key] = getChipVals(`lr-as-${f.key}`, false);
      else if (f.select) state.workup.assessment[f.key] = panel.querySelector(`select[data-lr-key="${f.key}"]`)?.value || '';
      else state.workup.assessment[f.key] = panel.querySelector(`input[data-lr-key="${f.key}"]`)?.value || '';
    });
    ['refraction', 'corneal', 'ocularSurface', 'topography', 'aberrometry'].forEach(collectSectionFromPanel);
    state.workup.risk.override = document.getElementById('lrRiskOverride')?.value || state.workup.risk.override;
    document.querySelectorAll('#lrPanelPlanning .lr-field').forEach((el) => { if (el.dataset.lrKey) state.workup.planning[el.dataset.lrKey] = el.value; });
    state.workup.planning.notes = document.getElementById('lrPlanNotes')?.value || state.workup.planning.notes;
    if (document.getElementById('lrPanelConsent')) collectConsent();
    document.querySelectorAll('#lrPanelOutcomes .lr-field').forEach((el) => { if (el.dataset.lrKey) state.workup.outcomes[el.dataset.lrKey] = el.value; });
    (T().OUTCOME_METRICS || []).forEach((f) => { if (f.chip) state.workup.outcomes[f.key] = getChipVals(`lr-out-${f.key}`, false); });
    clearTimeout(plannerRefreshTimer);
    plannerRefreshTimer = setTimeout(refreshAiPlannerPanel, 350);
    scheduleAutoSave();
  }

  function collectSectionFromPanel(sectionKey) {
    const sec = state.workup[sectionKey];
    const panel = document.getElementById(panelId(sectionKey));
    if (!panel) return;
    panel.querySelectorAll('.lr-field[data-lr-key]').forEach((el) => {
      const key = el.dataset.lrKey;
      const label = el.closest('.lr-row')?.querySelector('label')?.textContent || '';
      if (label.startsWith('OD ')) sec.od[key] = el.value;
      else if (label.startsWith('OS ')) sec.os[key] = el.value;
      else sec.shared[key] = el.value;
    });
    panel.querySelectorAll('.lr-notes[data-lr-key]').forEach((el) => {
      sec.shared[el.dataset.lrKey] = el.value;
    });
    panel.querySelectorAll('.lr-chip-group').forEach((g) => {
      const id = g.id;
      if (!id) return;
      const multi = g.dataset.multi === '1';
      const val = getChipVals(id, multi);
      const odMatch = id.match(/-od-(.+)$/);
      const osMatch = id.match(/-os-(.+)$/);
      if (odMatch) sec.od[odMatch[1]] = val;
      else if (osMatch) sec.os[osMatch[1]] = val;
      else {
        const key = g.dataset.lrChipKey || id.split('-').slice(2).join('-');
        if (sec.shared) sec.shared[key] = val;
        else sec[key] = val;
      }
    });
  }

  function collectConsent() {
    const c = state.workup.consent;
    c.procedure = document.querySelector('#lrPanelConsent select[data-lr-key="consentProcedure"]')?.value || c.procedure;
    c.signed = document.getElementById('lrConsentSigned')?.checked || false;
    c.signedAt = document.querySelector('#lrPanelConsent input[data-lr-key="signedAt"]')?.value || '';
    c.notes = document.getElementById('lrConsentNotes')?.value || '';
    c.risksDiscussed = getChipVals('lr-consent-risks', true);
    c.topics = {};
    document.querySelectorAll('[data-lr-consent-topic]:checked').forEach((el) => { c.topics[el.value] = true; });
  }

  function bindChips(root) {
    root.querySelectorAll('.lr-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.closest('.lr-chip-group');
        const multi = g?.dataset.multi === '1';
        if (!multi) g.querySelectorAll('.lr-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.toggle('active');
        collectFromDom();
        renderAlerts();
        refreshAiPlannerPanel();
      });
    });
  }

  function bindEvents(root) {
    root.querySelectorAll('.lr-subnav-btn, .lr-progress-step').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.lrPanel || panelId(btn.dataset.lrTab)));
    });
    bindChips(root);
    root.querySelectorAll('.lr-field, .lr-notes').forEach((el) => {
      el.addEventListener('input', () => { collectFromDom(); renderAlerts(); });
      el.addEventListener('change', () => { collectFromDom(); renderAlerts(); });
    });
    root.querySelectorAll('[data-lr-template]').forEach((btn) => {
      btn.addEventListener('click', () => applyTemplate(btn.dataset.lrTemplate));
    });
    root.querySelector('[data-lr-action="copy-od-os"]')?.addEventListener('click', copyOdToOs);
    root.querySelector('[data-lr-action="export"]')?.addEventListener('click', exportJson);
    root.querySelector('[data-lr-action="pentacam-import"]')?.addEventListener('click', () => {
      global.openLaserPentacamImport?.();
    });
    root.querySelector('[data-lr-action="sirius-import"]')?.addEventListener('click', () => {
      global.openLaserSiriusImport?.();
    });
    root.querySelectorAll('[data-lr-print]').forEach((btn) => btn.addEventListener('click', () => printDoc(btn.dataset.lrPrint)));
    root.querySelector('[data-lr-action="sx-add"]')?.addEventListener('click', saveSurgeryRecord);
    root.querySelector('[data-lr-action="fu-add"]')?.addEventListener('click', saveFollowUpVisit);
    root.querySelector('[data-lr-image]')?.addEventListener('change', handleImageImport);
    root.querySelectorAll('[data-lr-img-rm]').forEach((btn) => {
      btn.addEventListener('click', () => { state.workup.images.splice(Number(btn.dataset.lrImgRm), 1); buildPanels(); scheduleAutoSave(); });
    });
  }

  function copyOdToOs() {
    const map = { refraction: 'refraction', corneal: 'corneal', ocularSurface: 'ocularSurface', topography: 'topography', aberrometry: 'aberrometry' };
    const key = map[state.activeTab];
    if (!key) return;
    state.workup[key].os = { ...state.workup[key].od };
    buildPanels();
    scheduleAutoSave();
  }

  function applyTemplate(name) {
    const tpl = T().NORMAL_TEMPLATES?.[name];
    if (!tpl) return;
    Object.assign(state.workup.assessment, tpl.assessment || {});
    if (tpl.ocularSurface) { Object.assign(state.workup.ocularSurface.od, tpl.ocularSurface.od || {}); Object.assign(state.workup.ocularSurface.os, tpl.ocularSurface.os || tpl.ocularSurface.od || {}); }
    if (tpl.corneal) { Object.assign(state.workup.corneal.od, tpl.corneal.od || {}); Object.assign(state.workup.corneal.os, tpl.corneal.os || tpl.corneal.od || {}); }
    buildPanels();
    scheduleAutoSave();
  }

  function saveSurgeryRecord() {
    collectFromDom();
    const draft = {};
    document.querySelectorAll('[data-lr-sx-key]').forEach((el) => { draft[el.dataset.lrSxKey] = el.value; });
    document.querySelectorAll('.lr-chip-group[id^="lr-sx-"]').forEach((g) => {
      draft[g.id.replace('lr-sx-', '')] = getChipVals(g.id, false);
    });
    state.workup.surgery.records.push({ ...draft, savedAt: new Date().toISOString() });
    state._sxDraft = {};
    buildPanels();
    scheduleAutoSave();
  }

  function saveFollowUpVisit() {
    collectFromDom();
    state.workup.followUp.visits.push({
      label: document.querySelector('[data-lr-key="fuLabel"]')?.value || state._fuDraft?.label,
      date: document.querySelector('[data-lr-key="fuDate"]')?.value || new Date().toISOString().split('T')[0],
      od: { ...state._fuDraft?.od },
      os: { ...state._fuDraft?.os },
      complications: state._fuDraft?.complications || ''
    });
    state._fuDraft = { od: {}, os: {} };
    buildPanels();
    scheduleAutoSave();
  }

  function handleImageImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.workup.images.push({ id: Date.now(), category: document.getElementById('lrImageCat')?.value || 'Other', label: file.name, dataUrl: reader.result, at: new Date().toISOString() });
      buildPanels();
      scheduleAutoSave();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function printHtml(title, body) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:system-ui;padding:24px;max-width:800px;margin:0 auto}h1{color:#1565c0}</style></head><body><h1>${escapeHtml(title)}</h1>${body}<p style="margin-top:40px;font-size:12px;color:#666">Generated ${new Date().toLocaleString()}</p></body></html>`);
    w.document.close();
    w.print();
  }

  function printDoc(type) {
    collectFromDom();
    const name = document.getElementById('fullName')?.value || 'Patient';
    const w = state.workup;
    const risk = T().computeRisk?.(w);
    const plan = T().computePlanning?.(w);
    let body = '';
    if (type === 'workup') {
      body = `<p><strong>${escapeHtml(name)}</strong></p><p><strong>Risk:</strong> ${escapeHtml(risk?.level || '—')}</p>
        <p><strong>Refraction OD:</strong> ${escapeHtml(w.refraction.od?.manifestSph || '—')} / ${escapeHtml(w.refraction.od?.manifestCyl || '—')} × ${escapeHtml(w.refraction.od?.manifestAxis || '—')}</p>
        <p><strong>Pachymetry:</strong> OD ${escapeHtml(w.corneal.od?.pachymetry || '—')} · OS ${escapeHtml(w.corneal.os?.pachymetry || '—')} µm</p>
        ${global.CorneaLaserRefractiveAdvisor?.formatPrintBlock(w.aiAdvisor?.lastReport, w.aiAdvisor, w.planning?.notes) || ''}`;
    } else if (type === 'ai-workup') {
      body = global.CorneaLaserRefractiveAdvisor?.formatPrintBlock(getAiReport(), w.aiAdvisor, w.planning?.notes, 'workup') || '';
    } else if (type === 'ai-plan') {
      body = global.CorneaLaserRefractiveAdvisor?.formatPrintBlock(w.aiAdvisor?.lastReport || getAiReport(), w.aiAdvisor, w.planning?.notes, 'plan') || '';
    } else if (type === 'ai-risk') {
      body = global.CorneaLaserRefractiveAdvisor?.formatPrintBlock(w.aiAdvisor?.lastReport || getAiReport(), w.aiAdvisor, w.risk?.override, 'risk') || '';
    } else if (type === 'ai-counseling') {
      body = global.CorneaLaserRefractiveAdvisor?.formatPrintBlock(w.aiAdvisor?.lastReport || getAiReport(), w.aiAdvisor, w.consent?.notes, 'counseling') || '';
    } else if (type === 'plan') {
      body = `<p><strong>Procedure:</strong> ${escapeHtml(w.planning.selectedProcedure || plan?.recommendedProcedure || '—')}</p>
        <p>RSB: ${escapeHtml(plan?.residualStromalBed ?? '—')} µm · PTA: ${escapeHtml(plan?.ptaPercent ?? '—')}% · Ablation: ${escapeHtml(plan?.ablationDepth ?? '—')} µm</p>`;
    } else if (type === 'consent') {
      body = `<p><strong>Procedure:</strong> ${escapeHtml(w.consent.procedure || '—')}</p><p>Signed: ${w.consent.signed ? 'Yes' : 'No'} ${escapeHtml(w.consent.signedAt || '')}</p><p>${escapeHtml(w.consent.notes || '')}</p>`;
    } else if (type === 'operative') {
      const last = (w.surgery.records || []).slice(-1)[0];
      body = last ? `<pre>${escapeHtml(JSON.stringify(last, null, 2))}</pre>` : '<p>No surgery record</p>';
    } else if (type === 'followup') {
      body = (w.followUp.visits || []).map((v) => `<p><strong>${escapeHtml(v.label)}</strong> (${escapeHtml(v.date)}): UCVA ${escapeHtml(v.od?.ucva || '—')} / ${escapeHtml(v.os?.ucva || '—')}</p>`).join('') || '<p>No follow-up</p>';
    } else if (type === 'outcomes') {
      body = Object.entries(w.outcomes || {}).map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join('') || '<p>No outcomes recorded</p>';
    }
    printHtml(`Laser Refractive — ${type}`, body);
  }

  function exportJson() {
    collectFromDom();
    syncHiddenField();
    const blob = new Blob([document.getElementById('laserRefractiveJSON')?.value || '{}'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laser-refractive-${Date.now()}.json`;
    a.click();
  }

  function updateToggleButton(visible) {
    const btn = document.getElementById('btnToggleLaserRefractive');
    if (!btn) return;
    btn.classList.toggle('active', visible);
    btn.innerHTML = visible ? '<i class="fa-solid fa-eye-slash"></i> Hide Laser Work-up' : '<i class="fa-solid fa-bolt"></i> Laser Work-up';
  }

  function setSectionVisible(show) {
    const section = document.getElementById('section-laser-refractive');
    if (!section) return;
    if (show) {
      section.hidden = false;
      updateToggleButton(true);
      if (!document.getElementById('laserRefractiveBuilder')?.innerHTML?.trim()) buildPanels();
      if (global.initFormSectionCollapse) global.initFormSectionCollapse(section);
      if (global.refreshFormSectionNav) global.refreshFormSectionNav();
      requestAnimationFrame(() => {
        if (global.navigateToFormSection) global.navigateToFormSection(section.id);
        else section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      section.hidden = true;
      updateToggleButton(false);
      if (global.refreshFormSectionNav) global.refreshFormSectionNav();
    }
  }

  function formatReadOnly(data) {
    const st = parseState(data?.laserRefractiveJSON);
    if (!hasLaserData(data?.laserRefractiveJSON)) return '';
    const w = st.workup;
    const risk = T().computeRisk?.(w);
    const plan = T().computePlanning?.(w);
    const aiLabel = st.workup?.aiAdvisor?.lastReport?.suitability;
    const body = `<p><strong>Risk level:</strong> ${escapeHtml(risk?.level || '—')}</p>
      <p><strong>Planned procedure:</strong> ${escapeHtml(w.planning?.selectedProcedure || plan?.recommendedProcedure || '—')}</p>
      <p><strong>Refraction OD:</strong> ${escapeHtml(w.refraction?.od?.manifestSph || '—')} D · OS: ${escapeHtml(w.refraction?.os?.manifestSph || '—')} D</p>
      <p><strong>Pachymetry:</strong> ${escapeHtml(w.corneal?.od?.pachymetry || '—')} / ${escapeHtml(w.corneal?.os?.pachymetry || '—')} µm</p>
      ${w.consent?.signed ? `<p><strong>Consent:</strong> Signed ${escapeHtml(w.consent.signedAt || '')}</p>` : ''}
      ${aiLabel ? `<p><strong>AI planner:</strong> ${escapeHtml(aiLabel)} (decision support only)</p>` : ''}`;
    return global.buildEmrRoSection
      ? global.buildEmrRoSection('Laser Refractive Work-up', 'fa-bolt', body, '', 'section-theme-refractive')
      : `<div class="emr-ro-section">${body}</div>`;
  }

  const CorneaLaserRefractive = {
    init() {
      state = parseState(document.getElementById('laserRefractiveJSON')?.value || '{}');
      setSectionVisible(false);
    },
    reset() { state = defaultState(); syncHiddenField(); setSectionVisible(false); },
    syncToHiddenField() { collectFromDom(); syncHiddenField(); },
    onFormPopulated(data) {
      state = parseState(data?.laserRefractiveJSON);
      if (hasLaserData(data?.laserRefractiveJSON)) setSectionVisible(true);
      else setSectionVisible(false);
    },
    applyBeforeSave(data) {
      collectFromDom();
      if (state.workup.aiAdvisor?.lastReport) {
        state.workup.aiAdvisor.log = state.workup.aiAdvisor.log || [];
        state.workup.aiAdvisor.log.push({ type: 'save_snapshot', report: state.workup.aiAdvisor.lastReport, at: new Date().toISOString() });
      }
      syncHiddenField();
      data.laserRefractiveJSON = document.getElementById('laserRefractiveJSON')?.value || '{}';
    },
    toggleSection(show) {
      if (show === true) setSectionVisible(true);
      else if (show === false) setSectionVisible(false);
      else setSectionVisible(document.getElementById('section-laser-refractive')?.hidden !== false);
    },
    applyTopoReadings(readings) {
      const importer = global.CorneaTopographyImport || global.CorneaPentacamImport;
      if (!readings?.length || !importer) return 0;
      collectFromDom();
      const patches = importer.toLaserWorkupPatches(readings);
      state.workup.topography = state.workup.topography || { od: {}, os: {}, shared: {}, images: [] };
      state.workup.corneal = state.workup.corneal || { od: {}, os: {} };
      state.workup.topography.device = patches.topography.device || readings[0]?.device || 'Pentacam';
      state.workup.topography.od = { ...state.workup.topography.od, ...patches.topography.od };
      state.workup.topography.os = { ...state.workup.topography.os, ...patches.topography.os };
      state.workup.corneal.od = { ...state.workup.corneal.od, ...patches.corneal.od };
      state.workup.corneal.os = { ...state.workup.corneal.os, ...patches.corneal.os };
      state.activeTab = 'topography';
      syncHiddenField();
      setSectionVisible(true);
      buildPanels();
      return readings.length;
    },
    applyPentacamReadings(readings) {
      return this.applyTopoReadings(readings);
    },
    formatReadOnly
  };

  global.CorneaLaserRefractive = CorneaLaserRefractive;
})(typeof window !== 'undefined' ? window : globalThis);
