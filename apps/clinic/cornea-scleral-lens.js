/**
 * Scleral Lens Fitting Wizard
 */
(function (global) {
  'use strict';

  const T = () => global.CorneaScleralLensTaxonomy || {};

  function emptyFit() {
    return {
      indication: [],
      prefitting: { od: {}, os: {}, shared: {} },
      trialSelection: { od: {}, os: {}, shared: { eye: 'OD' } },
      insertion: { checklist: [], photoNote: '', drawingNote: '' },
      centralClearance: { od: {}, os: {}, shared: { method: 'Manual estimate' } },
      limbalClearance: {},
      landingZone: {},
      movement: { amount: '', decentration: '' },
      overRefraction: { od: {}, os: {} },
      finalDesign: { od: {}, os: {}, shared: {} },
      complications: { findings: [], solutions: '' },
      education: { checklist: [] },
      followUp: { interval: '', track: {}, notes: '' }
    };
  }

  function defaultState() {
    return {
      version: 1,
      currentStep: 1,
      completedSteps: [],
      fit: emptyFit(),
      photos: [],
      history: [],
      aiAdvisor: { decisions: {}, log: [], collapsed: false, lastReport: null }
    };
  }

  let state = defaultState();
  let autoSaveTimer = null;

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function syncHiddenField() {
    const el = document.getElementById('scleralLensJSON');
    if (!el) return;
    const recs = T().computeRecommendations?.(state.fit) || [];
    state.fit.finalDesign.shared = { ...state.fit.finalDesign.shared, ...T().suggestFinalDesign?.(state.fit) };
    el.value = JSON.stringify({
      version: 1,
      currentStep: state.currentStep,
      completedSteps: state.completedSteps,
      fit: state.fit,
      photos: state.photos,
      recommendations: recs,
      history: state.history,
      aiAdvisor: state.aiAdvisor,
      updatedAt: new Date().toISOString()
    });
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(syncHiddenField, 300);
  }

  function parseState(raw) {
    if (!raw) return defaultState();
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const base = defaultState();
      return {
        version: p.version || 1,
        currentStep: p.currentStep || 1,
        completedSteps: Array.isArray(p.completedSteps) ? p.completedSteps : [],
        fit: { ...base.fit, ...p.fit },
        photos: Array.isArray(p.photos) ? p.photos : [],
        history: Array.isArray(p.history) ? p.history : [],
        aiAdvisor: { ...base.aiAdvisor, ...(p.aiAdvisor || {}) }
      };
    } catch {
      return defaultState();
    }
  }

  function hasScleralData(raw) {
    if (!raw || raw === '{}') return false;
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if ((p.fit?.indication || []).length) return true;
      if ((p.completedSteps || []).length > 1) return true;
      if ((p.history || []).length) return true;
      if ((p.photos || []).length) return true;
      return false;
    } catch {
      return false;
    }
  }

  function setWizardVisible(show) {
    const panel = document.getElementById('section-scleral-wizard');
    const btn = document.getElementById('btnToggleScleralWizard');
    if (!panel) return;
    if (show) {
      if (global.CorneaContactLens?.toggleSection) global.CorneaContactLens.toggleSection(true);
      panel.hidden = false;
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Hide Scleral Wizard';
      }
      renderWizard();
      requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else {
      panel.hidden = true;
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Scleral Lens Wizard';
      }
    }
  }

  function chipGroup(id, options, selected, multi) {
    const sel = multi ? (selected || []) : [selected].filter(Boolean);
    return `<div class="sl-chip-group" id="${id}" data-multi="${multi ? '1' : '0'}">${(options || []).map((o) => {
      const on = sel.includes(o);
      return `<button type="button" class="sl-chip${on ? ' active' : ''}" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button>`;
    }).join('')}</div>`;
  }

  function fieldInput(key, val, type, ph) {
    const t = type === 'date' ? 'date' : 'text';
    return `<input type="${t}" class="sl-field" data-sl-key="${key}" value="${escapeHtml(val || '')}" placeholder="${ph || '—'}" />`;
  }

  function renderProgress() {
    const steps = T().SL_STEPS || [];
    return `<div class="sl-progress no-print" role="navigation" aria-label="Wizard progress">${steps.map((s) => {
      const done = state.completedSteps.includes(s.id) || s.id < state.currentStep;
      const cur = s.id === state.currentStep;
      return `<button type="button" class="sl-progress-step${done ? ' done' : ''}${cur ? ' current' : ''}" data-goto-step="${s.id}" title="${escapeHtml(s.title)}">
        <span class="sl-step-num">${done && !cur ? '✓' : s.id}</span>
        <span class="sl-step-label">${escapeHtml(s.title)}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function renderRecommendations() {
    const recs = T().computeRecommendations?.(state.fit) || [];
    const alerts = (T().SAFETY_RULES || []).filter((r) => { try { return r.check(state.fit); } catch { return false; } }).map((r) => r.msg);
    if (!recs.length && !alerts.length) return '';
    return `<div class="sl-rec-panel">${alerts.length ? `<div class="sl-alerts"><strong>Clinical alerts</strong><ul>${alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
      ${recs.length ? `<div class="sl-recs"><strong>Recommendations</strong><ul>${recs.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}</div>`;
  }

  function renderTemplates() {
    return `<div class="sl-templates no-print"><span>Shortcuts:</span>${Object.keys(T().SPECIALIST_TEMPLATES || {}).map((n) =>
      `<button type="button" class="btn-secondary btn-sm" data-sl-template="${escapeHtml(n)}">${escapeHtml(n)}</button>`
    ).join('')}</div>`;
  }

  function renderStep1() {
    return `<h4 class="sl-step-title">Step 1 — Patient Selection</h4><p class="form-hint">Select indication(s)</p>
      ${chipGroup('sl-indications', T().INDICATIONS, state.fit.indication, true)}`;
  }

  function odOsGrid(fields, od, os, shared) {
    const rows = (fields || []).map((f) => {
      if (f.chip) return `<div class="sl-row span-full"><label>${escapeHtml(f.label)}</label>${chipGroup(`sl-pf-${f.key}`, ['Yes', 'No', 'Mild', 'Moderate', 'Severe'], shared?.[f.key], false)}</div>`;
      if (f.od && f.os) {
        return `<div class="sl-row"><label>OD ${escapeHtml(f.label)}</label>${fieldInput(f.key, od?.[f.key])}</div>
          <div class="sl-row"><label>OS ${escapeHtml(f.label)}</label>${fieldInput(f.key, os?.[f.key])}</div>`;
      }
      return '';
    }).join('');
    return `<div class="sl-toolbar no-print"><button type="button" class="btn-secondary btn-sm" data-sl-action="copy-od-os"><i class="fa-solid fa-copy"></i> Copy OD → OS</button>
      <button type="button" class="btn-secondary btn-sm" data-sl-action="normal-prefit">One-click normal</button></div><div class="sl-grid">${rows}</div>`;
  }

  function renderStep2() {
    return `<h4 class="sl-step-title">Step 2 — Pre-fitting Assessment</h4>${odOsGrid(T().PREFIT_FIELDS, state.fit.prefitting.od, state.fit.prefitting.os, state.fit.prefitting.shared)}`;
  }

  function renderStep3() {
    const f = T().TRIAL_FIELDS || [];
    const sh = state.fit.trialSelection.shared || {};
    const rows = f.map((fld) => `<div class="sl-row"><label>${escapeHtml(fld.label)}</label>${fieldInput(fld.key, sh[fld.key])}</div>`).join('');
    return `<h4 class="sl-step-title">Step 3 — Trial Lens Selection</h4>
      <div class="sl-row span-full"><label>Eye</label>${chipGroup('sl-eye', ['OD', 'OS', 'Both'], sh.eye || 'OD', false)}</div>
      <div class="sl-grid">${rows}</div>`;
  }

  function renderStep4() {
    const items = ['Lens filled with saline', 'No air bubbles', 'Lens centered', 'Comfort acceptable'];
    const chk = state.fit.insertion.checklist || [];
    return `<h4 class="sl-step-title">Step 4 — Lens Insertion</h4>
      <div class="sl-check-grid">${items.map((c) => `<label class="sl-check"><input type="checkbox" data-sl-ins value="${escapeHtml(c)}" ${chk.includes(c) ? 'checked' : ''} /> ${escapeHtml(c)}</label>`).join('')}</div>
      <div class="sl-row span-full"><label>Photograph note</label>${fieldInput('photoNote', state.fit.insertion.photoNote)}</div>
      <div class="sl-row span-full"><label>Clinical drawing note</label>${fieldInput('drawingNote', state.fit.insertion.drawingNote)}</div>`;
  }

  function renderStep5() {
    const microns = T().CENTRAL_CLEARANCE_MICRONS || [];
    const cc = state.fit.centralClearance.shared || {};
    const btns = microns.map((m) => {
      const st = T().clearanceStatus?.(m) || {};
      const active = String(cc.estimate) === String(m);
      return `<button type="button" class="sl-clearance-btn ${st.cls || ''}${active ? ' active' : ''}" data-micron="${m}">${m} µm</button>`;
    }).join('');
    const st = T().clearanceStatus?.(cc.estimate);
    return `<h4 class="sl-step-title">Step 5 — Central Clearance</h4>
      <div class="sl-row span-full"><label>Method</label>${chipGroup('sl-cc-method', ['OCT', 'Manual estimate'], cc.method || 'Manual estimate', false)}</div>
      <div class="sl-clearance-grid">${btns}</div>
      ${st?.label ? `<div class="sl-clearance-verdict ${st.cls}"><strong>${escapeHtml(st.label)}</strong> — ${escapeHtml(st.rec || '')}</div>` : ''}
      <div class="sl-grid"><div class="sl-row"><label>OD (µm)</label>${fieldInput('odMicrons', cc.odMicrons)}</div>
      <div class="sl-row"><label>OS (µm)</label>${fieldInput('osMicrons', cc.osMicrons)}</div></div>`;
  }

  function renderQuadrantStep(title, stepNum, dataKey, options) {
    const data = state.fit[dataKey] || {};
    const quads = T().QUADRANTS || [];
    return `<h4 class="sl-step-title">Step ${stepNum} — ${title}</h4>
      <div class="sl-quad-grid">${quads.map((q) => `<div class="sl-quad-card"><strong>${escapeHtml(q)}</strong>
        ${chipGroup(`sl-${dataKey}-${q}`, options, data[q], false)}</div>`).join('')}</div>`;
  }

  function renderStep8() {
    const mv = state.fit.movement || {};
    return `<h4 class="sl-step-title">Step 8 — Lens Movement</h4>
      <div class="sl-row span-full"><label>Movement</label>${chipGroup('sl-movement', T().MOVEMENT_OPTIONS, mv.amount, false)}</div>
      <div class="sl-row span-full"><label>Decentration</label>${chipGroup('sl-decentration', T().DECENTRATION, mv.decentration, false)}</div>`;
  }

  function renderStep9() {
    const od = state.fit.overRefraction.od || {};
    const os = state.fit.overRefraction.os || {};
    const fields = ['sphere', 'cylinder', 'axis', 'add', 'nearVision', 'distanceVision', 'finalVa'];
    const rows = fields.flatMap((k) => [
      `<div class="sl-row"><label>OD ${k}</label>${fieldInput(k, od[k])}</div>`,
      `<div class="sl-row"><label>OS ${k}</label>${fieldInput(k, os[k])}</div>`
    ]).join('');
    return `<h4 class="sl-step-title">Step 9 — Over Refraction</h4>
      <div class="sl-toolbar no-print"><button type="button" class="btn-secondary btn-sm" data-sl-action="copy-od-os">Copy OD → OS</button>
      <button type="button" class="btn-secondary btn-sm" data-sl-action="calc-power">Calculate final power</button></div>
      <div class="sl-grid">${rows}</div>
      <div id="slPowerCalc" class="form-hint"></div>`;
  }

  function renderStep10() {
    const design = { ...state.fit.trialSelection?.shared, ...T().suggestFinalDesign?.(state.fit) };
    const fields = T().FINAL_DESIGN_FIELDS || [];
    return `<h4 class="sl-step-title">Step 10 — Final Lens Design</h4><p class="form-hint">Auto-generated from trial + over-refraction + clearance</p>
      <div class="sl-grid">${fields.map((k) => `<div class="sl-row"><label>${escapeHtml(k)}</label>${fieldInput(k, design[k])}</div>`).join('')}</div>`;
  }

  function renderStep11() {
    const comp = state.fit.complications.findings || [];
    const sols = (T().computeRecommendations?.(state.fit) || []).join('\n');
    return `<h4 class="sl-step-title">Step 11 — Complication Check</h4>
      ${chipGroup('sl-complications', T().COMPLICATIONS, comp, true)}
      <div class="sl-row span-full"><label>Suggested solutions</label><textarea class="sl-notes" id="slCompSolutions" readonly>${escapeHtml(sols || state.fit.complications.solutions || '')}</textarea></div>`;
  }

  function renderStep12() {
    const chk = state.fit.education.checklist || [];
    return `<h4 class="sl-step-title">Step 12 — Patient Education</h4>
      <div class="sl-check-grid">${(T().EDUCATION_ITEMS || []).map((c) =>
        `<label class="sl-check"><input type="checkbox" data-sl-edu value="${escapeHtml(c)}" ${chk.includes(c) ? 'checked' : ''} /> ${escapeHtml(c)}</label>`
      ).join('')}</div>`;
  }

  function renderStep13() {
    const fu = state.fit.followUp;
    return `<h4 class="sl-step-title">Step 13 — Follow-up</h4>
      <div class="followup-intervals">${(T().FOLLOW_UP_INTERVALS || []).map((i) =>
        `<button type="button" class="sl-fu-btn followup-interval-btn${fu.interval === i.key ? ' active' : ''}" data-interval="${i.key}">${escapeHtml(i.label)}</button>`
      ).join('')}</div>
      <h5>Track at follow-up</h5><div class="sl-check-grid">${(T().FOLLOW_UP_TRACK || []).map((c) =>
        `<label class="sl-check"><input type="checkbox" data-sl-fu-track value="${escapeHtml(c)}" ${fu.track?.[c] ? 'checked' : ''} /> ${escapeHtml(c)}</label>`
      ).join('')}</div>
      <textarea class="sl-notes" id="slFuNotes" placeholder="Follow-up notes">${escapeHtml(fu.notes || '')}</textarea>
      <div class="sl-history-panel">${renderHistoryCompare()}</div>`;
  }

  function renderPhotos() {
    const cats = T().PHOTO_CATEGORIES || [];
    const list = (state.photos || []).map((p, i) => `<div class="sl-photo-item">${p.category}: ${escapeHtml(p.name)} <button type="button" class="btn-danger btn-sm" data-sl-photo-rm="${i}">×</button></div>`).join('');
    return `<div class="sl-photos no-print"><h5>Photographs</h5><div class="sl-photo-list">${list || '<span class="form-hint">No photos attached</span>'}</div>
      ${cats.map((c) => `<label class="btn-secondary btn-sm sl-photo-btn"><i class="fa-solid fa-camera"></i> ${escapeHtml(c.label)}
        <input type="file" accept="image/*" hidden data-sl-photo-cat="${c.key}" /></label>`).join('')}</div>`;
  }

  function renderHistoryCompare() {
    if (!state.history.length) return '<p class="form-hint">No previous scleral fittings in this visit history.</p>';
    return `<table class="clinic-table sl-history-table"><thead><tr><th>Date</th><th>Sag</th><th>Clearance</th><th>VA</th><th>Comfort</th></tr></thead><tbody>
      ${state.history.map((h) => `<tr><td>${escapeHtml(h.date || '')}</td><td>${escapeHtml(h.sag || '—')}</td><td>${escapeHtml(h.clearance || '—')}</td><td>${escapeHtml(h.va || '—')}</td><td>${escapeHtml(h.comfort || '—')}</td></tr>`).join('')}
    </tbody></table>`;
  }

  const STEP_RENDERERS = {
    1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5,
    6: () => renderQuadrantStep('Limbal Clearance', 6, 'limbalClearance', T().LIMBAL_OPTIONS),
    7: () => renderQuadrantStep('Landing Zone', 7, 'landingZone', T().LANDING_FINDINGS),
    8: renderStep8, 9: renderStep9, 10: renderStep10, 11: renderStep11, 12: renderStep12, 13: renderStep13
  };

  function collectFromDom() {
    state.fit.indication = getChipVals('sl-indications', true);
    state.fit.complications.findings = getChipVals('sl-complications', true);

    collectOdOsPanel('sl-pf-', state.fit.prefitting);
    collectTrialSelection();
    collectCentralClearance();
    collectQuadrants('limbalClearance');
    collectQuadrants('landingZone');

    state.fit.movement.amount = getChipVals('sl-movement', false);
    state.fit.movement.decentration = getChipVals('sl-decentration', false);
    collectOverRefraction();
    collectEducationFollowUp();
    clearTimeout(advisorRefreshTimer);
    advisorRefreshTimer = setTimeout(refreshAdvisorPanel, 350);
    scheduleAutoSave();
  }

  function getChipVals(id, multi) {
    const g = document.getElementById(id);
    if (!g) return multi ? [] : '';
    const active = [...g.querySelectorAll('.sl-chip.active')].map((b) => b.dataset.value);
    return multi ? active : (active[0] || '');
  }

  function collectOdOsPanel(prefix, target) {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((g) => {
      const key = g.id.replace(prefix, '');
      target.shared[key] = getChipVals(g.id, false);
    });
    document.querySelectorAll('#slStepContent .sl-field').forEach((el) => {
      const key = el.dataset.slKey;
      const label = el.closest('.sl-row')?.querySelector('label')?.textContent || '';
      if (label.startsWith('OD ')) target.od[key] = el.value;
      else if (label.startsWith('OS ')) target.os[key] = el.value;
    });
  }

  function collectTrialSelection() {
    const sh = state.fit.trialSelection.shared;
    sh.eye = getChipVals('sl-eye', false) || 'OD';
    document.querySelectorAll('#slStepContent .sl-field').forEach((el) => {
      const key = el.dataset.slKey;
      const label = el.closest('.sl-row')?.querySelector('label')?.textContent || '';
      if (!label.startsWith('OD ') && !label.startsWith('OS ') && TRIAL_KEYS.includes(key)) sh[key] = el.value;
    });
  }

  const TRIAL_KEYS = ['manufacturer', 'design', 'trialSet', 'diameter', 'baseCurve', 'sagittalDepth', 'landingZone', 'peripheralCurve', 'power', 'material', 'dk', 'surfaceCoating', 'tint'];

  function collectCentralClearance() {
    const sh = state.fit.centralClearance.shared;
    sh.method = getChipVals('sl-cc-method', false);
    document.querySelectorAll('#slStepContent .sl-field[data-sl-key="odMicrons"], #slStepContent .sl-field[data-sl-key="osMicrons"]').forEach((el) => {
      sh[el.dataset.slKey] = el.value;
    });
    const st = T().clearanceStatus?.(sh.estimate);
    sh.recommendation = st?.rec || '';
  }

  function collectQuadrants(key) {
    (T().QUADRANTS || []).forEach((q) => {
      state.fit[key][q] = getChipVals(`sl-${key}-${q}`, false);
    });
  }

  function collectOverRefraction() {
    document.querySelectorAll('#slStepContent .sl-field').forEach((el) => {
      const key = el.dataset.slKey;
      const label = el.closest('.sl-row')?.querySelector('label')?.textContent || '';
      if (label.startsWith('OD ')) state.fit.overRefraction.od[key] = el.value;
      if (label.startsWith('OS ')) state.fit.overRefraction.os[key] = el.value;
    });
  }

  function collectEducationFollowUp() {
    state.fit.insertion.checklist = [...document.querySelectorAll('[data-sl-ins]:checked')].map((c) => c.value);
    state.fit.education.checklist = [...document.querySelectorAll('[data-sl-edu]:checked')].map((c) => c.value);
    state.fit.followUp.notes = document.getElementById('slFuNotes')?.value || '';
    const track = {};
    document.querySelectorAll('[data-sl-fu-track]:checked').forEach((c) => { track[c.value] = true; });
    state.fit.followUp.track = track;
  }

  function goToStep(n) {
    collectFromDom();
    if (n > state.currentStep && !state.completedSteps.includes(state.currentStep)) {
      state.completedSteps.push(state.currentStep);
    }
    state.currentStep = Math.max(1, Math.min(13, n));
    syncHiddenField();
    renderWizard();
  }

  function getAiReport() {
    if (!global.CorneaScleralLensAdvisor) return null;
    state.aiAdvisor = state.aiAdvisor || { decisions: {}, log: [], collapsed: false };
    const report = global.CorneaScleralLensAdvisor.analyze(state.fit, {
      currentStep: state.currentStep,
      history: state.history
    });
    state.aiAdvisor.lastReport = report;
    state.aiAdvisor._lastFit = state.fit;
    return report;
  }

  let advisorKeyBound = false;

  function refreshAdvisorPanel() {
    const root = document.getElementById('scleralLensBuilder');
    const col = root?.querySelector('.sl-advisor-column');
    if (!col || !global.CorneaScleralLensAdvisor) return;
    const report = getAiReport();
    col.innerHTML = global.CorneaScleralLensAdvisor.renderPanel(report, state.aiAdvisor, state.fit);
    bindAdvisorPanelButtons(root);
  }

  let advisorRefreshTimer = null;

  function bindAdvisorPanelButtons(root) {
    const panel = root.querySelector('#slAiAdvisor');
    if (!panel) return;

    panel.querySelector('#slAiToggleCollapse')?.addEventListener('click', () => {
      state.aiAdvisor.collapsed = !state.aiAdvisor.collapsed;
      panel.classList.toggle('collapsed');
      syncHiddenField();
    });

    panel.querySelectorAll('[data-ai-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.recId;
        const action = btn.dataset.aiAction;
        let note = '';
        if (action === 'modify') {
          note = prompt('Modification note (optional):') || '';
        }
        global.CorneaScleralLensAdvisor.recordDecision(state.aiAdvisor, recId, action, note);
        syncHiddenField();
        renderWizard();
      });
    });
  }

  function bindAdvisorEvents(root) {
    bindAdvisorPanelButtons(root);
    if (advisorKeyBound) return;
    advisorKeyBound = true;
    root.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.altKey) return;
      const panel = root.querySelector('#slAiAdvisor');
      if (!panel) return;
      const rec = panel.querySelector('.sl-ai-rec:not(.accepted):not(.rejected)');
      if (!rec) return;
      const id = rec.dataset.recId;
      if (e.key === 'a' || e.key === 'A') {
        global.CorneaScleralLensAdvisor.recordDecision(state.aiAdvisor, id, 'accept');
        syncHiddenField();
        renderWizard();
      }
      if (e.key === 'r' || e.key === 'R') {
        global.CorneaScleralLensAdvisor.recordDecision(state.aiAdvisor, id, 'reject');
        syncHiddenField();
        renderWizard();
      }
    });
  }

  function renderWizard() {
    const root = document.getElementById('scleralLensBuilder');
    if (!root) return;
    const render = STEP_RENDERERS[state.currentStep] || renderStep1;
    const report = getAiReport();
    const advisorHtml = global.CorneaScleralLensAdvisor?.renderPanel(report, state.aiAdvisor, state.fit) || '';

    root.innerHTML = `<div class="sl-wizard-layout">
      <aside class="sl-advisor-column">${advisorHtml}</aside>
      <div class="sl-wizard-main">
        ${renderProgress()}${renderTemplates()}${renderRecommendations()}${renderPhotos()}
        <div id="slStepContent">${render()}</div>
        <div class="sl-nav no-print">
          <button type="button" class="btn-secondary" data-sl-nav="prev" ${state.currentStep <= 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left"></i> Previous</button>
          <span class="sl-nav-label">Step ${state.currentStep} of 13</span>
          <button type="button" class="btn-primary" data-sl-nav="next">${state.currentStep >= 13 ? 'Finish' : 'Next'} <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <div class="sl-print-bar no-print">
          <button type="button" class="btn-teal btn-sm" data-sl-print="report"><i class="fa-solid fa-print"></i> Fitting report</button>
          <button type="button" class="btn-secondary btn-sm" data-sl-print="order">Order form</button>
          <button type="button" class="btn-secondary btn-sm" data-sl-print="instructions">Patient instructions</button>
          <button type="button" class="btn-secondary btn-sm" data-sl-print="followup">Follow-up sheet</button>
          <button type="button" class="btn-secondary btn-sm" data-sl-print="ai-summary"><i class="fa-solid fa-robot"></i> AI summary</button>
          <button type="button" class="btn-secondary btn-sm" data-sl-action="export"><i class="fa-solid fa-download"></i> Export JSON</button>
        </div>
      </div>
    </div>`;
    bindWizardEvents(root);
    bindAdvisorEvents(root);
    renderRecommendations();
  }

  function bindWizardEvents(root) {
    root.querySelectorAll('.sl-chip-group .sl-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.closest('.sl-chip-group');
        const multi = g?.dataset.multi === '1';
        if (multi) btn.classList.toggle('active');
        else { g.querySelectorAll('.sl-chip').forEach((b) => b.classList.remove('active')); btn.classList.add('active'); }
        collectFromDom();
        if (state.currentStep === 5 || state.currentStep >= 6) renderWizard();
      });
    });
    root.querySelectorAll('.sl-field, .sl-notes, [data-sl-ins], [data-sl-edu], [data-sl-fu-track]').forEach((el) => {
      el.addEventListener('input', collectFromDom);
      el.addEventListener('change', collectFromDom);
    });
    root.querySelectorAll('[data-goto-step]').forEach((btn) => {
      btn.addEventListener('click', () => goToStep(Number(btn.dataset.gotoStep)));
    });
    root.querySelector('[data-sl-nav="prev"]')?.addEventListener('click', () => goToStep(state.currentStep - 1));
    root.querySelector('[data-sl-nav="next"]')?.addEventListener('click', () => goToStep(state.currentStep + 1));
    root.querySelectorAll('.sl-clearance-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.sl-clearance-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.fit.centralClearance.shared.estimate = btn.dataset.micron;
        collectFromDom();
        renderWizard();
      });
    });
    root.querySelectorAll('.sl-fu-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.sl-fu-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.fit.followUp.interval = btn.dataset.interval;
        scheduleAutoSave();
      });
    });
    root.querySelectorAll('[data-sl-template]').forEach((btn) => {
      btn.addEventListener('click', () => applyTemplate(btn.dataset.slTemplate));
    });
    root.querySelectorAll('[data-sl-action="copy-od-os"]').forEach((btn) => {
      btn.addEventListener('click', () => copyOdToOs());
    });
    root.querySelector('[data-sl-action="normal-prefit"]')?.addEventListener('click', () => {
      state.fit.prefitting.shared = { blepharitis: 'No', mgd: 'No', topographyAvailable: 'Yes' };
      state.fit.prefitting.od = { tbut: '>10s', schirmer: 'Normal', cornealStaining: 'None' };
      state.fit.prefitting.os = { ...state.fit.prefitting.od };
      renderWizard();
      scheduleAutoSave();
    });
    root.querySelector('[data-sl-action="calc-power"]')?.addEventListener('click', () => {
      const design = T().suggestFinalDesign?.(state.fit);
      const el = document.getElementById('slPowerCalc');
      if (el && design) el.textContent = `Suggested final power: ${design.power || '—'} (trial ${state.fit.trialSelection?.shared?.power || '—'} + OR ${state.fit.overRefraction?.od?.sphere || '—'})`;
    });
    root.querySelectorAll('[data-sl-print]').forEach((btn) => {
      btn.addEventListener('click', () => printDoc(btn.dataset.slPrint));
    });
    root.querySelector('[data-sl-action="export"]')?.addEventListener('click', () => exportJson());
    root.querySelectorAll('[data-sl-photo-cat]').forEach((input) => {
      input.addEventListener('change', (e) => handlePhoto(e.target));
    });
    root.querySelectorAll('[data-sl-photo-rm]').forEach((btn) => {
      btn.addEventListener('click', () => { state.photos.splice(Number(btn.dataset.slPhotoRm), 1); renderWizard(); scheduleAutoSave(); });
    });
  }

  function copyOdToOs() {
    document.querySelectorAll('#slStepContent .sl-row').forEach((row) => {
      const label = row.querySelector('label')?.textContent || '';
      if (!label.startsWith('OD ')) return;
      const odField = row.querySelector('.sl-field');
      const osRow = [...document.querySelectorAll('#slStepContent .sl-row')].find((r) => r.querySelector('label')?.textContent === label.replace('OD ', 'OS '));
      const osField = osRow?.querySelector('.sl-field');
      if (odField && osField) osField.value = odField.value;
    });
    collectFromDom();
  }

  function applyTemplate(name) {
    const tpl = T().SPECIALIST_TEMPLATES?.[name];
    if (!tpl) return;
    if (tpl.indication) state.fit.indication = [...tpl.indication];
    if (tpl.trialSelection) state.fit.trialSelection = { ...state.fit.trialSelection, ...JSON.parse(JSON.stringify(tpl.trialSelection)) };
    renderWizard();
    scheduleAutoSave();
  }

  function handlePhoto(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.photos.push({ category: input.dataset.slPhotoCat, name: file.name, dataUrl: reader.result, mimeType: file.type });
      renderWizard();
      scheduleAutoSave();
    };
    reader.readAsDataURL(file);
  }

  function printDoc(type) {
    collectFromDom();
    syncHiddenField();
    const name = document.getElementById('fullName')?.value || 'Patient';
    const fit = state.fit;
    const design = { ...fit.trialSelection?.shared, ...T().suggestFinalDesign?.(fit) };
    let body = '';
    if (type === 'report') {
      body = `<p><strong>${escapeHtml(name)}</strong></p><p>Indication: ${escapeHtml((fit.indication || []).join(', '))}</p>
        <p>Central clearance: ${escapeHtml(fit.centralClearance?.shared?.estimate || '—')} µm</p>
        <p>Final sag: ${escapeHtml(design.sagittalDepth || '—')} · Diameter: ${escapeHtml(design.diameter || '—')}</p>
        <p>Recommendations: ${(T().computeRecommendations?.(fit) || []).map(escapeHtml).join('; ')}</p>
        ${global.CorneaScleralLensAdvisor?.formatPrintBlock(state.aiAdvisor?.lastReport || getAiReport(), state.aiAdvisor, fit.followUp?.notes) || ''}`;
    } else if (type === 'ai-summary') {
      body = global.CorneaScleralLensAdvisor?.formatPrintBlock(state.aiAdvisor?.lastReport || getAiReport(), state.aiAdvisor, fit.followUp?.notes) || '<p>No AI analysis available.</p>';
    } else if (type === 'order') {
      body = `<table><tr><th>Parameter</th><th>Value</th></tr>${(T().FINAL_DESIGN_FIELDS || []).map((k) =>
        `<tr><td>${k}</td><td>${escapeHtml(design[k] || '—')}</td></tr>`).join('')}</table>`;
    } else if (type === 'instructions') {
      body = `<ul>${(fit.education.checklist || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`;
    } else {
      const iv = (T().FOLLOW_UP_INTERVALS || []).find((i) => i.key === fit.followUp.interval);
      body = `<p>Follow-up: ${escapeHtml(iv?.label || '—')}</p><p>${escapeHtml(fit.followUp.notes || '')}</p>`;
    }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Scleral Lens ${type}</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px">${body}</body></html>`);
    w.document.close();
    w.print();
  }

  function exportJson() {
    syncHiddenField();
    const blob = new Blob([document.getElementById('scleralLensJSON')?.value || '{}'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scleral-lens-${document.getElementById('patientId')?.value || 'export'}.json`;
    a.click();
  }

  function snapshotForHistory() {
    collectFromDom();
    return {
      date: document.getElementById('visitDate')?.value || new Date().toISOString().split('T')[0],
      sag: state.fit.trialSelection?.shared?.sagittalDepth || state.fit.finalDesign?.shared?.sagittalDepth || '',
      clearance: state.fit.centralClearance?.shared?.estimate || '',
      va: state.fit.overRefraction?.od?.finalVa || '',
      comfort: state.fit.followUp?.track?.Comfort ? 'Tracked' : '',
      snapshot: JSON.parse(JSON.stringify(state.fit))
    };
  }

  function formatReadOnly(data) {
    const st = parseState(data?.scleralLensJSON);
    if (!hasScleralData(data?.scleralLensJSON)) return '';
    const design = { ...st.fit.trialSelection?.shared, ...T().suggestFinalDesign?.(st.fit) };
    let aiLabel = st.aiAdvisor?.lastReport?.overall?.label;
    if (!aiLabel && global.CorneaScleralLensAdvisor) {
      aiLabel = global.CorneaScleralLensAdvisor.analyze(st.fit, { currentStep: st.currentStep, history: st.history })?.overall?.label;
    }
    const body = `<p><strong>Indication:</strong> ${escapeHtml((st.fit.indication || []).join(', ') || '—')}</p>
      <p><strong>Final design:</strong> Sag ${escapeHtml(design.sagittalDepth || '—')} · Ø ${escapeHtml(design.diameter || '—')} · Power ${escapeHtml(design.power || '—')}</p>
      <p><strong>Step progress:</strong> ${st.completedSteps.length}/13 completed</p>
      ${aiLabel ? `<p><strong>AI advisor:</strong> ${escapeHtml(aiLabel)} (decision support only)</p>` : ''}`;
    return global.buildEmrRoSection
      ? global.buildEmrRoSection('Scleral Lens Fitting', 'fa-wand-magic-sparkles', body, '', 'section-theme-contactlens')
      : `<div class="emr-ro-section">${body}</div>`;
  }

  const CorneaScleralLens = {
    init() {
      state = parseState(document.getElementById('scleralLensJSON')?.value || '{}');
      setWizardVisible(false);
    },
    reset() {
      state = defaultState();
      syncHiddenField();
      setWizardVisible(false);
    },
    syncToHiddenField() { collectFromDom(); syncHiddenField(); },
    onFormPopulated(data) {
      state = parseState(data?.scleralLensJSON);
      if (hasScleralData(data?.scleralLensJSON)) {
        if (global.CorneaContactLens?.toggleSection) global.CorneaContactLens.toggleSection(true);
        setWizardVisible(true);
      } else setWizardVisible(false);
    },
    applyBeforeSave(data) {
      collectFromDom();
      const snap = snapshotForHistory();
      const last = state.history[state.history.length - 1];
      if (!last || JSON.stringify(last.snapshot) !== JSON.stringify(snap.snapshot)) state.history.push(snap);
      if (state.aiAdvisor?.lastReport) {
        state.aiAdvisor.log = state.aiAdvisor.log || [];
        state.aiAdvisor.log.push({ type: 'save_snapshot', report: state.aiAdvisor.lastReport, at: new Date().toISOString() });
      }
      syncHiddenField();
      data.scleralLensJSON = document.getElementById('scleralLensJSON')?.value || '{}';
    },
    toggleWizard(show) {
      if (show === true) setWizardVisible(true);
      else if (show === false) setWizardVisible(false);
      else setWizardVisible(document.getElementById('section-scleral-wizard')?.hidden !== false);
    },
    formatReadOnly
  };

  global.CorneaScleralLens = CorneaScleralLens;
})(typeof window !== 'undefined' ? window : globalThis);
