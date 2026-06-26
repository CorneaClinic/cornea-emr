/**

 * Contact Lens Fitting & Follow-up Module

 */

(function (global) {

  'use strict';



  const T = () => global.CorneaContactLensTaxonomy || {};



  function emptyFit() {

    return {

      indication: [],

      prefitting: { od: {}, os: {}, shared: {} },

      lensSelection: { od: {}, os: {}, shared: { eye: 'Both' } },

      trial: { od: {}, os: {}, shared: { trialInserted: false } },

      finalRx: { od: {}, os: {}, shared: {} },

      dispensing: { checklist: [], solutions: [], notes: '' },

      followUp: { interval: '', compare: {}, notes: '', date: '' },

      complications: [],

      notes: ''

    };

  }



  function defaultState() {

    return { version: 1, activeTab: 'indication', fit: emptyFit(), history: [] };

  }



  let state = defaultState();

  let inventory = [];



  function escapeHtml(s) {

    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  }



  function syncHiddenField() {

    const el = document.getElementById('contactLensJSON');

    if (!el) return;

    el.value = (global.safeJsonStringify || JSON.stringify)({ version: 1, activeTab: state.activeTab, fit: state.fit, history: state.history });

  }



  function loadInventory() {

    try {

      inventory = JSON.parse(localStorage.getItem(T().INVENTORY_STORAGE_KEY) || '[]');

    } catch {

      inventory = [];

    }

  }



  function saveInventory() {

    try {

      localStorage.setItem(T().INVENTORY_STORAGE_KEY, JSON.stringify(inventory));

    } catch (_) {}

  }



  function hasContactLensData(raw) {
    if (!raw) return false;
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if ((p.fit?.indication || []).length) return true;
      if ((p.fit?.complications || []).length) return true;
      if ((p.history || []).length) return true;
      const od = p.fit?.finalRx?.od || {};
      const os = p.fit?.finalRx?.os || {};
      return [...Object.values(od), ...Object.values(os)].some((v) => String(v ?? '').trim());
    } catch {
      return false;
    }
  }

  function updateToggleButton(visible) {
    const btn = document.getElementById('btnToggleContactLens');
    if (!btn) return;
    btn.classList.toggle('active', visible);
    btn.innerHTML = visible
      ? '<i class="fa-solid fa-eye-slash"></i> Hide Contact Lens'
      : '<i class="fa-solid fa-eye"></i> Contact Lens';
  }

  function setSectionVisible(show) {
    const section = document.getElementById('section-contact-lens');
    if (!section) return;
    if (show) {
      section.hidden = false;
      updateToggleButton(true);
      if (!document.getElementById('contactLensBuilder')?.innerHTML?.trim()) buildPanels();
      if (global.initFormSectionCollapse) global.initFormSectionCollapse(section);
      requestAnimationFrame(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else {
      section.hidden = true;
      updateToggleButton(false);
    }
  }

  function parseState(raw) {

    if (!raw) return defaultState();

    try {

      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;

      const base = defaultState();

      return {

        version: p.version || 1,

        activeTab: p.activeTab || 'indication',

        fit: {

          ...base.fit,

          ...p.fit,

          prefitting: { ...base.fit.prefitting, ...(p.fit?.prefitting || {}) },

          lensSelection: { ...base.fit.lensSelection, ...(p.fit?.lensSelection || {}) },

          trial: { ...base.fit.trial, ...(p.fit?.trial || {}) },

          finalRx: { ...base.fit.finalRx, ...(p.fit?.finalRx || {}) },

          dispensing: { ...base.fit.dispensing, ...(p.fit?.dispensing || {}) },

          followUp: { ...base.fit.followUp, ...(p.fit?.followUp || {}) }

        },

        history: Array.isArray(p.history) ? p.history : []

      };

    } catch {

      return defaultState();

    }

  }



  function withFit(fit, fn) {

    const prev = state.fit;

    state.fit = fit;

    const out = fn();

    state.fit = prev;

    return out;

  }



  function computeAlerts(fit) {

    const f = fit || state.fit;

    return (T().SAFETY_RULES || []).filter((r) => {

      try { return r.check(f); } catch { return false; }

    }).map((r) => r.msg);

  }



  function panelId(tabId) {

    return 'clPanel' + tabId.charAt(0).toUpperCase() + tabId.slice(1);

  }



  function renderAlerts() {

    const box = document.getElementById('clAlertsBox');

    if (!box) return;

    const alerts = computeAlerts();

    if (!alerts.length) { box.innerHTML = ''; box.hidden = true; return; }

    box.hidden = false;

    box.innerHTML = `<div class="cl-alerts"><strong><i class="fa-solid fa-triangle-exclamation"></i> Clinical alerts</strong><ul>${

      alerts.map((a) => `<li>${escapeHtml(a)}</li>`).join('')

    }</ul></div>`;

  }



  function chipGroup(id, options, selected, multi) {

    const sel = multi ? (selected || []) : [selected].filter(Boolean);

    return `<div class="cl-chip-group" id="${id}" data-multi="${multi ? '1' : '0'}">${

      (options || []).map((o) => {

        const on = sel.includes(o);

        return `<button type="button" class="cl-chip${on ? ' active' : ''}" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button>`;

      }).join('')

    }</div>`;

  }



  function fieldInput(key, val, type) {

    const t = type === 'date' ? 'date' : 'text';

    return `<input type="${t}" class="cl-field" data-cl-key="${key}" value="${escapeHtml(val || '')}" placeholder="—" />`;

  }



  function fieldSelect(key, val, options) {

    return `<select class="cl-field" data-cl-key="${key}"><option value="">—</option>${

      (options || []).map((o) => `<option value="${escapeHtml(o)}"${o === val ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')

    }</select>`;

  }



  function odOsGrid(fields, dataOd, dataOs, shared) {

    const rows = (fields || []).map((f) => {

      if (f.chip) {

        return `<div class="cl-row span-full"><label>${escapeHtml(f.label)}</label>${chipGroup(`cl-${f.key}`, ['Yes', 'No', 'Mild', 'Moderate', 'Severe', 'Poor', 'Good'], shared?.[f.key], false)}</div>`;

      }

      if (f.select) {

        return `<div class="cl-row span-full"><label>${escapeHtml(f.label)}</label>${fieldSelect(f.key, shared?.[f.key], f.select)}</div>`;

      }

      if (f.od && f.os) {

        return `<div class="cl-row"><label>OD ${escapeHtml(f.label)}</label>${fieldInput(f.key, dataOd?.[f.key])}</div>

          <div class="cl-row"><label>OS ${escapeHtml(f.label)}</label>${fieldInput(f.key, dataOs?.[f.key])}</div>`;

      }

      return `<div class="cl-row span-full"><label>${escapeHtml(f.label)}</label>${fieldInput(f.key, shared?.[f.key], f.type)}</div>`;

    }).join('');

    return `<div class="cl-toolbar no-print">

      <button type="button" class="btn-secondary btn-sm" data-cl-action="copy-od-os"><i class="fa-solid fa-copy"></i> Copy OD → OS</button>

      <button type="button" class="btn-secondary btn-sm" data-cl-action="copy-prev"><i class="fa-solid fa-clock-rotate-left"></i> Copy previous visit</button>

    </div><div class="cl-grid">${rows}</div>`;

  }



  function getChipValues(id) {

    const g = document.getElementById(id);

    if (!g) return [];

    const multi = g.dataset.multi === '1';

    const active = [...g.querySelectorAll('.cl-chip.active')].map((b) => b.dataset.value);

    return multi ? active : (active[0] || '');

  }



  function collectPanelData(panel) {

    const out = { od: {}, os: {}, shared: {} };

    if (!panel) return out;

    panel.querySelectorAll('.cl-field').forEach((el) => {

      const key = el.dataset.clKey;

      const label = el.closest('.cl-row')?.querySelector('label')?.textContent || '';

      if (label.startsWith('OD ')) out.od[key] = el.value;

      else if (label.startsWith('OS ')) out.os[key] = el.value;

      else out.shared[key] = el.value;

    });

    panel.querySelectorAll('.cl-chip-group').forEach((g) => {

      const key = g.id.replace(/^cl-/, '');

      if (['indications', 'complications', 'eye'].includes(key)) return;

      out.shared[key] = getChipValues(g.id);

      if (!g.dataset.multi || g.dataset.multi === '0') {

        const v = getChipValues(g.id);

        out.shared[key] = Array.isArray(v) ? (v[0] || '') : v;

      }

    });

    return out;

  }



  function collectFromDom() {

    state.fit.indication = getChipValues('cl-indications');

    state.fit.complications = getChipValues('cl-complications');



    const pre = document.getElementById('clPanelPrefitting');

    const lens = document.getElementById('clPanelLensSelection');

    const trial = document.getElementById('clPanelTrial');

    const final = document.getElementById('clPanelFinalRx');

    if (pre) state.fit.prefitting = collectPanelData(pre);

    if (lens) state.fit.lensSelection = collectPanelData(lens);

    if (trial) {

      state.fit.trial = collectPanelData(trial);

      state.fit.trial.shared.trialInserted = !!document.getElementById('clTrialInserted')?.checked;

    }

    if (final) state.fit.finalRx = collectPanelData(final);



    const eye = getChipValues('cl-eye');

    state.fit.lensSelection.shared.eye = Array.isArray(eye) ? (eye[0] || 'Both') : (eye || 'Both');



    const disp = document.getElementById('clPanelDispensing');

    if (disp) {

      state.fit.dispensing.checklist = [...disp.querySelectorAll('[data-disp-check]:checked')].map((c) => c.value);

      state.fit.dispensing.solutions = [...disp.querySelectorAll('[data-disp-sol]:checked')].map((c) => c.value);

      state.fit.dispensing.notes = disp.querySelector('#clDispNotes')?.value || '';

    }

    const fu = document.getElementById('clPanelFollowUp');

    if (fu) {

      state.fit.followUp.notes = fu.querySelector('#clFuNotes')?.value || '';

      state.fit.followUp.interval = fu.querySelector('.cl-fu-btn.active')?.dataset.interval || state.fit.followUp.interval;

      const cmp = {};

      fu.querySelectorAll('[data-fu-compare]:checked').forEach((c) => { cmp[c.value] = true; });

      state.fit.followUp.compare = cmp;

    }

    syncHiddenField();

  }



  function bindChips(root) {

    root.querySelectorAll('.cl-chip-group').forEach((g) => {

      g.querySelectorAll('.cl-chip').forEach((btn) => {

        btn.addEventListener('click', () => {

          const multi = g.dataset.multi === '1';

          if (multi) btn.classList.toggle('active');

          else {

            g.querySelectorAll('.cl-chip').forEach((b) => b.classList.remove('active'));

            btn.classList.add('active');

          }

          collectFromDom();

          renderAlerts();

        });

      });

    });

  }



  function bindFields(root) {

    root.querySelectorAll('.cl-field').forEach((el) => {

      el.addEventListener('input', () => { collectFromDom(); renderAlerts(); });

      el.addEventListener('change', () => { collectFromDom(); renderAlerts(); });

    });

  }



  function applyTemplate(name) {

    const tpl = T().SPECIALIST_TEMPLATES?.[name];

    if (!tpl) return;

    if (tpl.indication) state.fit.indication = [...tpl.indication];

    if (tpl.lensSelection) state.fit.lensSelection = { ...state.fit.lensSelection, ...JSON.parse(JSON.stringify(tpl.lensSelection)) };

    if (tpl.finalRx) state.fit.finalRx = { ...state.fit.finalRx, ...JSON.parse(JSON.stringify(tpl.finalRx)) };

    renderAll();

  }



  function switchClPanel(id) {

    const tab = id.replace('clPanel', '');

    state.activeTab = tab.charAt(0).toLowerCase() + tab.slice(1);

    document.querySelectorAll('.cl-panel').forEach((p) => p.classList.remove('active'));

    document.querySelectorAll('.cl-subnav-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(id)?.classList.add('active');

    document.querySelector(`.cl-subnav-btn[data-cl-panel="${id}"]`)?.classList.add('active');

    syncHiddenField();

  }



  function renderInvAlerts() {

    const box = document.getElementById('clInvAlerts');

    if (!box) return;

    const soon = inventory.filter((i) => i.expiry && ((new Date(i.expiry) - new Date()) / 86400000) <= 30);

    const low = inventory.filter((i) => Number(i.qty) <= 1);

    const msgs = [];

    if (soon.length) msgs.push(`${soon.length} item(s) expiring within 30 days`);

    if (low.length) msgs.push(`${low.length} item(s) low stock`);

    box.innerHTML = msgs.length ? `<div class="cl-alerts cl-alerts-warn">${msgs.map(escapeHtml).join(' · ')}</div>` : '';

  }



  function buildPanels() {

    const root = document.getElementById('contactLensBuilder');

    if (!root) return;

    const tabs = T().CL_TABS || [];



    root.innerHTML = `

      <div class="cl-subnav no-print" role="tablist">${tabs.map((t, i) =>

        `<button type="button" class="cl-subnav-btn${state.activeTab === t.id ? ' active' : ''}" data-cl-panel="${panelId(t.id)}"><i class="fa-solid ${t.icon}"></i> ${escapeHtml(t.label)}</button>`

      ).join('')}</div>

      <div class="cl-templates no-print"><span class="cl-templates-label">Shortcuts:</span>${

        Object.keys(T().SPECIALIST_TEMPLATES || {}).map((n) =>

          `<button type="button" class="btn-secondary btn-sm" data-cl-template="${escapeHtml(n)}">${escapeHtml(n)}</button>`

        ).join('')

      }</div>

      <div id="clAlertsBox" hidden></div>

      <div id="clPanelIndication" class="cl-panel${state.activeTab === 'indication' ? ' active' : ''}"><h4 class="cl-panel-title">Indication</h4><p class="form-hint">Tap all that apply</p>${chipGroup('cl-indications', T().INDICATIONS, state.fit.indication, true)}</div>

      <div id="clPanelPrefitting" class="cl-panel${state.activeTab === 'prefitting' ? ' active' : ''}"><h4 class="cl-panel-title">Pre-fitting Assessment</h4>${odOsGrid(T().PREFITTING_FIELDS, state.fit.prefitting.od, state.fit.prefitting.os, state.fit.prefitting.shared)}</div>

      <div id="clPanelLensSelection" class="cl-panel${state.activeTab === 'lensSelection' ? ' active' : ''}"><h4 class="cl-panel-title">Lens Selection</h4><div class="cl-row span-full"><label>Eye</label>${chipGroup('cl-eye', ['OD', 'OS', 'Both'], state.fit.lensSelection.shared.eye, false)}</div>${odOsGrid(T().LENS_PARAM_FIELDS, state.fit.lensSelection.od, state.fit.lensSelection.os, state.fit.lensSelection.shared)}</div>

      <div id="clPanelTrial" class="cl-panel${state.activeTab === 'trial' ? ' active' : ''}"><h4 class="cl-panel-title">Trial Lens Assessment</h4><label class="cl-check"><input type="checkbox" id="clTrialInserted" ${state.fit.trial.shared.trialInserted ? 'checked' : ''} /> Trial lens inserted</label>${odOsGrid((T().TRIAL_ASSESSMENT_FIELDS || []).map((f) => ({ key: f.key, label: f.label, od: true, os: true })), state.fit.trial.od, state.fit.trial.os, state.fit.trial.shared)}</div>

      <div id="clPanelFinalRx" class="cl-panel${state.activeTab === 'finalRx' ? ' active' : ''}"><h4 class="cl-panel-title">Final Prescription</h4>${odOsGrid(T().FINAL_RX_FIELDS, state.fit.finalRx.od, state.fit.finalRx.os, state.fit.finalRx.shared)}

        <div class="cl-toolbar no-print"><button type="button" class="btn-teal btn-sm" data-cl-action="print-rx"><i class="fa-solid fa-print"></i> Prescription</button>

        <button type="button" class="btn-secondary btn-sm" data-cl-action="print-summary">Summary</button>

        <button type="button" class="btn-secondary btn-sm" data-cl-action="print-instructions">Instructions</button></div></div>

      <div id="clPanelDispensing" class="cl-panel${state.activeTab === 'dispensing' ? ' active' : ''}"><h4 class="cl-panel-title">Dispensing</h4>

        <div class="cl-check-grid">${(T().DISPENSING_CHECKLIST || []).map((c) => `<label class="cl-check"><input type="checkbox" data-disp-check value="${escapeHtml(c)}" ${state.fit.dispensing.checklist.includes(c) ? 'checked' : ''} /> ${escapeHtml(c)}</label>`).join('')}</div>

        <h5>Solutions prescribed</h5><div class="cl-check-grid">${(T().SOLUTIONS || []).map((s) => `<label class="cl-check"><input type="checkbox" data-disp-sol value="${escapeHtml(s)}" ${state.fit.dispensing.solutions.includes(s) ? 'checked' : ''} /> ${escapeHtml(s)}</label>`).join('')}</div>

        <textarea id="clDispNotes" class="cl-notes" placeholder="Dispensing notes">${escapeHtml(state.fit.dispensing.notes)}</textarea></div>

      <div id="clPanelFollowUp" class="cl-panel${state.activeTab === 'followUp' ? ' active' : ''}"><h4 class="cl-panel-title">Follow-up</h4>

        <div class="followup-intervals">${(T().FOLLOW_UP_INTERVALS || []).map((i) => `<button type="button" class="cl-fu-btn followup-interval-btn${state.fit.followUp.interval === i.key ? ' active' : ''}" data-interval="${i.key}">${escapeHtml(i.label)}</button>`).join('')}</div>

        <h5>Compare at follow-up</h5><div class="cl-check-grid">${(T().FOLLOW_UP_COMPARE || []).map((c) => `<label class="cl-check"><input type="checkbox" data-fu-compare value="${escapeHtml(c)}" ${state.fit.followUp.compare[c] ? 'checked' : ''} /> ${escapeHtml(c)}</label>`).join('')}</div>

        <textarea id="clFuNotes" class="cl-notes" placeholder="Follow-up notes">${escapeHtml(state.fit.followUp.notes)}</textarea>

        <div class="cl-toolbar no-print"><button type="button" class="btn-secondary btn-sm" data-cl-action="print-fu"><i class="fa-solid fa-calendar"></i> Follow-up schedule</button></div></div>

      <div id="clPanelComplications" class="cl-panel${state.activeTab === 'complications' ? ' active' : ''}"><h4 class="cl-panel-title">Complications</h4>${chipGroup('cl-complications', T().COMPLICATIONS, state.fit.complications, true)}</div>

      <div id="clPanelInventory" class="cl-panel${state.activeTab === 'inventory' ? ' active' : ''}"><h4 class="cl-panel-title">Lens Inventory</h4><div id="clInvAlerts"></div>

        <div class="table-wrapper"><table class="clinic-table"><thead><tr><th>Category</th><th>Manufacturer</th><th>Brand</th><th>Parameters</th><th>Expiry</th><th>Qty</th><th></th></tr></thead>

        <tbody id="clInvBody">${inventory.length ? inventory.map((item, idx) => `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.manufacturer)}</td><td>${escapeHtml(item.brand)}</td><td>${escapeHtml(item.params || '')}</td><td>${escapeHtml(item.expiry || '')}</td><td>${escapeHtml(item.qty ?? '')}</td><td class="no-print"><button type="button" class="btn-danger btn-sm" data-inv-remove="${idx}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="7">No inventory items</td></tr>'}</tbody></table></div>

        <div class="cl-inv-add no-print cl-grid">${fieldSelect('invCat', '', T().INVENTORY_CATEGORIES)}${fieldInput('invMfr', '')}${fieldInput('invBrand', '')}${fieldInput('invParams', '')}${fieldInput('invExpiry', '', 'date')}${fieldInput('invQty', '')}<button type="button" class="btn-primary btn-sm" data-cl-action="inv-add"><i class="fa-solid fa-plus"></i> Add stock</button></div></div>

      <div id="clPanelHistory" class="cl-panel${state.activeTab === 'history' ? ' active' : ''}"><h4 class="cl-panel-title">Contact Lens History</h4>

        <div class="table-wrapper"><table class="clinic-table"><thead><tr><th>Date</th><th>Indication</th><th>Lens</th><th>Complications</th><th></th></tr></thead>

        <tbody>${state.history.length ? state.history.map((h, i) => `<tr><td>${escapeHtml(h.date || '')}</td><td>${escapeHtml((h.indication || []).join(', '))}</td><td>${escapeHtml(h.lensType || '')}</td><td>${escapeHtml(h.complications || '')}</td><td class="no-print"><button type="button" class="btn-secondary btn-sm" data-hist-load="${i}">Load</button></td></tr>`).join('') : '<tr><td colspan="5">No prior fittings stored for this visit</td></tr>'}</tbody></table></div>

        <div class="cl-toolbar no-print"><button type="button" class="btn-secondary btn-sm" data-cl-action="export-cl"><i class="fa-solid fa-download"></i> Export JSON</button></div></div>`;



    root.querySelectorAll('.cl-subnav-btn').forEach((btn) => {

      btn.addEventListener('click', () => switchClPanel(btn.dataset.clPanel));

    });

    bindChips(root);

    bindFields(root);

    bindActions(root);

    renderInvAlerts();

    renderAlerts();

  }



  function bindActions(root) {

    root.querySelectorAll('[data-cl-template]').forEach((btn) => {

      btn.addEventListener('click', () => applyTemplate(btn.dataset.clTemplate));

    });

    root.querySelectorAll('[data-cl-action="copy-od-os"]').forEach((btn) => {

      btn.addEventListener('click', () => {

        const panel = btn.closest('.cl-panel');

        if (!panel) return;

        panel.querySelectorAll('.cl-row').forEach((row) => {

          const label = row.querySelector('label')?.textContent || '';

          if (!label.startsWith('OD ')) return;

          const odField = row.querySelector('.cl-field');

          const osRow = [...panel.querySelectorAll('.cl-row')].find((r) => r.querySelector('label')?.textContent === label.replace('OD ', 'OS '));

          const osField = osRow?.querySelector('.cl-field');

          if (osField && odField) osField.value = odField.value;

        });

        collectFromDom();

      });

    });

    root.querySelectorAll('[data-cl-action="copy-prev"]').forEach((btn) => {

      btn.addEventListener('click', () => {

        if (!state.history.length) { alert('No previous fitting in history.'); return; }

        const prev = state.history[state.history.length - 1];

        if (prev?.snapshot) { state.fit = { ...emptyFit(), ...prev.snapshot }; renderAll(); }

      });

    });

    root.querySelectorAll('.cl-fu-btn').forEach((btn) => {

      btn.addEventListener('click', () => {

        root.querySelectorAll('.cl-fu-btn').forEach((b) => b.classList.remove('active'));

        btn.classList.add('active');

        state.fit.followUp.interval = btn.dataset.interval;

        syncHiddenField();

      });

    });

    root.querySelectorAll('[data-disp-check], [data-disp-sol], #clDispNotes, #clFuNotes, #clTrialInserted').forEach((el) => {

      el.addEventListener('change', () => { collectFromDom(); renderAlerts(); });

      el.addEventListener('input', () => { collectFromDom(); renderAlerts(); });

    });

    root.querySelector('[data-cl-action="inv-add"]')?.addEventListener('click', () => {

      const wrap = root.querySelector('.cl-inv-add');

      inventory.push({

        category: wrap?.querySelector('[data-cl-key="invCat"]')?.value || '',

        manufacturer: wrap?.querySelector('[data-cl-key="invMfr"]')?.value || '',

        brand: wrap?.querySelector('[data-cl-key="invBrand"]')?.value || '',

        params: wrap?.querySelector('[data-cl-key="invParams"]')?.value || '',

        expiry: wrap?.querySelector('[data-cl-key="invExpiry"]')?.value || '',

        qty: wrap?.querySelector('[data-cl-key="invQty"]')?.value || '1'

      });

      saveInventory();

      buildPanels();

    });

    root.querySelectorAll('[data-inv-remove]').forEach((btn) => {

      btn.addEventListener('click', () => {

        inventory.splice(Number(btn.dataset.invRemove), 1);

        saveInventory();

        buildPanels();

      });

    });

    root.querySelectorAll('[data-hist-load]').forEach((btn) => {

      btn.addEventListener('click', () => {

        const h = state.history[Number(btn.dataset.histLoad)];

        if (h?.snapshot) { state.fit = { ...emptyFit(), ...h.snapshot }; renderAll(); }

      });

    });

    root.querySelector('[data-cl-action="print-rx"]')?.addEventListener('click', () => CorneaContactLens.printPrescription());

    root.querySelector('[data-cl-action="print-summary"]')?.addEventListener('click', () => CorneaContactLens.printSummary());

    root.querySelector('[data-cl-action="print-instructions"]')?.addEventListener('click', () => CorneaContactLens.printInstructions());

    root.querySelector('[data-cl-action="print-fu"]')?.addEventListener('click', () => CorneaContactLens.printFollowUp());

    root.querySelector('[data-cl-action="export-cl"]')?.addEventListener('click', () => CorneaContactLens.exportData());

  }



  function renderAll() {

    buildPanels();

    syncHiddenField();

  }



  function snapshotForHistory() {

    collectFromDom();

    return {

      date: document.getElementById('visitDate')?.value || new Date().toISOString().split('T')[0],

      indication: [...(state.fit.indication || [])],

      lensType: state.fit.finalRx?.od?.lensType || state.fit.lensSelection?.shared?.lensType || '',

      complications: (state.fit.complications || []).join(', '),

      snapshot: JSON.parse(JSON.stringify(state.fit))

    };

  }



  function printHtml(title, body) {

    const w = window.open('', '_blank');

    if (!w) return;

    w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;max-width:800px;margin:0 auto}h1{font-size:1.2rem}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}th{background:#f0f4f8}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`);

    w.document.close();

    w.focus();

    w.print();

  }



  function formatReadOnly(data) {

    const st = parseState(data?.contactLensJSON);

    const hasData = (st.fit.indication || []).length || st.history.length || Object.keys(st.fit.finalRx?.od || {}).length;

    if (!hasData) return '';

    const od = st.fit.finalRx?.od || {};

    const os = st.fit.finalRx?.os || {};

    const rx = `<div class="emr-ro-grid">${['lensType', 'baseCurve', 'diameter', 'power', 'cylinder', 'axis'].map((k) =>

      `<div class="emr-ro-field span-full"><div class="emr-ro-label">${k}</div><div class="emr-ro-value">OD: ${escapeHtml(od[k] || '—')} · OS: ${escapeHtml(os[k] || '—')}</div></div>`

    ).join('')}</div><p><strong>Indication:</strong> ${escapeHtml((st.fit.indication || []).join(', ') || '—')}</p>`;

    const alerts = withFit(st.fit, () => computeAlerts(st.fit));

    const alertHtml = alerts.length ? `<div class="cl-alerts">${alerts.map((a) => escapeHtml(a)).join('<br>')}</div>` : '';

    return global.buildEmrRoSection

      ? global.buildEmrRoSection('Contact Lens', 'fa-eye', alertHtml + rx, '', 'section-theme-contactlens')

      : `<div class="emr-ro-section">${rx}</div>`;

  }



  const CorneaContactLens = {

    init() {
      loadInventory();
      state = parseState(document.getElementById('contactLensJSON')?.value || '{}');
      setSectionVisible(false);
      buildPanels();
    },

    reset() {
      state = defaultState();
      renderAll();
      setSectionVisible(false);
    },

    syncToHiddenField() { collectFromDom(); syncHiddenField(); },

    onFormPopulated(data) {
      state = parseState(data?.contactLensJSON);
      renderAll();
      const slRaw = data?.scleralLensJSON;
      let slHas = false;
      try { slHas = slRaw && JSON.parse(typeof slRaw === 'string' ? slRaw : JSON.stringify(slRaw))?.fit?.indication?.length; } catch (_) {}
      if (hasContactLensData(data?.contactLensJSON) || slHas) setSectionVisible(true);
      else setSectionVisible(false);
    },

    toggleSection(show) {
      const section = document.getElementById('section-contact-lens');
      if (!section) return;
      if (show === true) setSectionVisible(true);
      else if (show === false) setSectionVisible(false);
      else setSectionVisible(section.hidden);
    },

    applyBeforeSave(data) {

      collectFromDom();

      const snap = snapshotForHistory();

      const last = state.history[state.history.length - 1];

      if (!last || JSON.stringify(last.snapshot) !== JSON.stringify(snap.snapshot)) state.history.push(snap);

      syncHiddenField();

      data.contactLensJSON = document.getElementById('contactLensJSON')?.value || '{}';

    },

    switchPanel(id) { switchClPanel(id); },

    formatReadOnly,

    exportData() {

      collectFromDom();

      const blob = new Blob([JSON.stringify({ fit: state.fit, history: state.history, inventory }, null, 2)], { type: 'application/json' });

      const a = document.createElement('a');

      a.href = URL.createObjectURL(blob);

      a.download = `contact-lens-${document.getElementById('patientId')?.value || 'export'}.json`;

      a.click();

    },

    printPrescription() {

      collectFromDom();

      const od = state.fit.finalRx.od || {};

      const os = state.fit.finalRx.os || {};

      printHtml('Contact Lens Prescription', `<p><strong>${escapeHtml(document.getElementById('fullName')?.value || 'Patient')}</strong></p><table><tr><th></th><th>OD</th><th>OS</th></tr>${

        ['lensType', 'baseCurve', 'diameter', 'power', 'cylinder', 'axis', 'add'].map((k) => `<tr><th>${k}</th><td>${escapeHtml(od[k] || '—')}</td><td>${escapeHtml(os[k] || '—')}</td></tr>`).join('')

      }</table>`);

    },

    printSummary() {

      collectFromDom();

      printHtml('Contact Lens Clinical Summary', `<p><strong>Indication:</strong> ${escapeHtml((state.fit.indication || []).join(', '))}</p><p><strong>Complications:</strong> ${escapeHtml((state.fit.complications || []).join(', ') || 'None')}</p>${computeAlerts().map((a) => `<p style="color:#c62828">⚠ ${escapeHtml(a)}</p>`).join('')}`);

    },

    printFollowUp() {

      const iv = (T().FOLLOW_UP_INTERVALS || []).find((i) => i.key === state.fit.followUp.interval);

      printHtml('Contact Lens Follow-up', `<p>Recommended: <strong>${escapeHtml(iv?.label || 'Not set')}</strong></p><p>${escapeHtml(state.fit.followUp.notes || '')}</p>`);

    },

    printInstructions() {

      collectFromDom();

      printHtml('Patient Instructions', `<ul>${(state.fit.dispensing.checklist || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul><p>Solutions: ${escapeHtml((state.fit.dispensing.solutions || []).join(', '))}</p>`);

    }

  };



  global.CorneaContactLens = CorneaContactLens;

})(typeof window !== 'undefined' ? window : globalThis);


