/**
 * Cornea Clinic — comprehensive visual acuity & refraction module.
 * Preserves legacy field IDs (visionREUCVA, visionREBCVA, subDvReSph, etc.)
 */
(function (global) {
  'use strict';

  const DISTANCE_UCVA = Object.freeze([
    'NLP', 'PL', 'PR Accurate', 'PR Inaccurate', 'HM', 'CF',
    '1/60', '2/60', '3/60', '4/60', '5/60', '6/60', '6/36', '6/24',
    '6/18', '6/12', '6/9', '6/7.5', '6/6', '6/5'
  ]);

  const NEAR_UCVA = Object.freeze(['N36', 'N24', 'N18', 'N12', 'N10', 'N8', 'N6']);

  const PINHOLE_STATUS = Object.freeze(['Not done', 'No improvement', 'Improves to']);

  const QUICK_DISTANCE = Object.freeze(['6/6', '6/9', '6/12', '6/18', '6/24', '6/60', 'CF', 'HM', 'PL']);

  const CORNEA_CAUSES = Object.freeze([
    'Corneal opacity', 'Corneal edema', 'Keratoconus', 'Graft failure',
    'Graft rejection', 'Scarring', 'Dry eye', 'Band keratopathy', 'Other'
  ]);

  /** Snellen metres (6/x) → decimal; qualitative ranks for trend */
  const QUAL_RANK = Object.freeze({
    NLP: 0, PL: 1, 'PR Inaccurate': 2, 'PR Accurate': 3, HM: 4, CF: 5
  });

  const SNELLEN_DECIMAL = Object.freeze({
    '1/60': 0.017, '2/60': 0.033, '3/60': 0.05, '4/60': 0.067, '5/60': 0.083,
    '6/60': 0.1, '6/36': 0.167, '6/24': 0.25, '6/18': 0.333, '6/12': 0.5,
    '6/9': 0.667, '6/7.5': 0.8, '6/6': 1, '6/5': 1.2
  });

  const LEGACY_SYNC = Object.freeze([
    { from: 'vaReDistUcva', to: 'visionREUCVA' },
    { from: 'vaLeDistUcva', to: 'visionLEUCVA' },
    { from: 'vaReDistBcva', to: 'visionREBCVA' },
    { from: 'vaLeDistBcva', to: 'visionLEBCVA' }
  ]);

  const EYE_PAIRS = Object.freeze([
    ['Re', 'Le'],
    ['Od', 'Os']
  ]);

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function optionHtml(list, selected) {
    const sel = String(selected || '').trim();
    let html = '<option value="">—</option>';
    list.forEach((v) => {
      html += `<option value="${escapeHtml(v)}"${sel === v ? ' selected' : ''}>${escapeHtml(v)}</option>`;
    });
    if (sel && !list.includes(sel)) {
      html += `<option value="${escapeHtml(sel)}" selected>${escapeHtml(sel)} (legacy)</option>`;
    }
    return html;
  }

  function parseSnellenDecimal(value) {
    const v = String(value || '').trim();
    if (!v) return null;
    if (QUAL_RANK[v] != null) return QUAL_RANK[v] * 0.001;
    if (SNELLEN_DECIMAL[v] != null) return SNELLEN_DECIMAL[v];
    const m = v.match(/^6\s*\/\s*([\d.]+)$/);
    if (m) {
      const denom = parseFloat(m[1]);
      if (denom > 0) return 6 / denom;
    }
    const dec = parseFloat(v);
    return Number.isFinite(dec) ? dec : null;
  }

  function toLogMar(decimal) {
    if (decimal == null || decimal <= 0) return null;
    return Math.round(Math.log10(1 / decimal) * 100) / 100;
  }

  function trendLabel(current, previous) {
    const c = parseSnellenDecimal(current);
    const p = parseSnellenDecimal(previous);
    if (c == null || p == null) return null;
    const diff = c - p;
    if (Math.abs(diff) < 0.05) return 'stable';
    return diff > 0 ? 'improved' : 'worsened';
  }

  function trendClass(label) {
    if (label === 'improved') return 'va-trend-improved';
    if (label === 'worsened') return 'va-trend-worsened';
    if (label === 'stable') return 'va-trend-stable';
    return '';
  }

  function syncLegacyFields() {
    LEGACY_SYNC.forEach(({ from, to }) => {
      const src = $(from);
      const dst = $(to);
      if (src && dst && src.value) dst.value = src.value;
    });
    ['Re', 'Le'].forEach((eye) => {
      const status = $(`va${eye}PinholeStatus`)?.value;
      const improves = $(`va${eye}PinholeImprovesTo`)?.value;
      const phField = $(`subDv${eye}VaPh`);
      if (!phField) return;
      if (status === 'Improves to' && improves) phField.value = improves;
      else if (status === 'No improvement') phField.value = 'No improvement';
      else if (status === 'Not done') phField.value = '';
    });
    updateStandardizedHidden();
  }

  function updateStandardizedHidden() {
    [
      ['vaReDistUcva', 'vaReDistUcvaStd'],
      ['vaLeDistUcva', 'vaLeDistUcvaStd'],
      ['vaReDistBcva', 'vaReDistBcvaStd'],
      ['vaLeDistBcva', 'vaLeDistBcvaStd']
    ].forEach(([srcId, dstId]) => {
      const src = $(srcId);
      const dst = $(dstId);
      if (!src || !dst) return;
      const dec = parseSnellenDecimal(src.value);
      dst.value = dec != null ? String(dec) : '';
      const logId = dstId.replace('Std', 'LogMar');
      const logEl = $(logId);
      if (logEl) {
        const lm = toLogMar(dec);
        logEl.value = lm != null ? String(lm) : '';
      }
    });
  }

  function migrateLegacyToStructured(data) {
    if (!data || typeof data !== 'object') return;
    if (!data.vaReDistUcva && data.visionREUCVA) data.vaReDistUcva = data.visionREUCVA;
    if (!data.vaLeDistUcva && data.visionLEUCVA) data.vaLeDistUcva = data.visionLEUCVA;
    if (!data.vaReDistBcva && data.visionREBCVA) data.vaReDistBcva = data.visionREBCVA;
    if (!data.vaLeDistBcva && data.visionLEBCVA) data.vaLeDistBcva = data.visionLEBCVA;
    if (!data.vaReNearBcva && data.subNvReVa) data.vaReNearBcva = data.subNvReVa;
    if (!data.vaLeNearBcva && data.subNvLeVa) data.vaLeNearBcva = data.subNvLeVa;
    if (!data.vaReNearUcva && data.subNvReVaUa) data.vaReNearUcva = data.subNvReVaUa;
    if (!data.vaLeNearUcva && data.subNvLeVaUa) data.vaLeNearUcva = data.subNvLeVaUa;
  }

  function syncCorneaCausesToHidden() {
    const hidden = $('vaCorneaVisionCauseJSON');
    if (!hidden) return;
    const selected = [];
    document.querySelectorAll('[data-va-cornea-cause]:checked').forEach((el) => {
      selected.push(el.getAttribute('data-va-cornea-cause'));
    });
    const other = $('vaCorneaCauseOther')?.value?.trim();
    if (other) selected.push('Other: ' + other);
    hidden.value = selected.length ? JSON.stringify(selected) : '[]';
  }

  function loadCorneaCausesFromData(data) {
    const hidden = $('vaCorneaVisionCauseJSON');
    if (!hidden) return;
    let list = [];
    try {
      list = JSON.parse(data?.vaCorneaVisionCauseJSON || hidden.value || '[]');
    } catch (_) {
      list = [];
    }
    document.querySelectorAll('[data-va-cornea-cause]').forEach((el) => {
      const key = el.getAttribute('data-va-cornea-cause');
      el.checked = list.some((x) => x === key || String(x).startsWith('Other'));
    });
    const otherEl = $('vaCorneaCauseOther');
    if (otherEl) {
      const otherEntry = list.find((x) => String(x).startsWith('Other:'));
      otherEl.value = otherEntry ? String(otherEntry).replace(/^Other:\s*/, '') : '';
    }
  }

  function copyReToLe(fieldMap) {
    fieldMap.forEach(([reSuffix, leSuffix]) => {
      const reEl = $(reSuffix);
      const leEl = $(leSuffix);
      if (reEl && leEl) leEl.value = reEl.value;
    });
    syncLegacyFields();
  }

  function swapReLe(fieldMap) {
    fieldMap.forEach(([reId, leId]) => {
      const reEl = $(reId);
      const leEl = $(leId);
      if (!reEl || !leEl) return;
      const tmp = reEl.value;
      reEl.value = leEl.value;
      leEl.value = tmp;
    });
    syncLegacyFields();
  }

  const COPY_FIELD_MAP = [
    ['vaReDistUcva', 'vaLeDistUcva'],
    ['vaReNearUcva', 'vaLeNearUcva'],
    ['vaRePinholeStatus', 'vaLePinholeStatus'],
    ['vaRePinholeImprovesTo', 'vaLePinholeImprovesTo'],
    ['vaRePresentDist', 'vaLePresentDist'],
    ['vaRePresentNear', 'vaLePresentNear'],
    ['vaReDistBcva', 'vaLeDistBcva'],
    ['vaReNearBcva', 'vaLeNearBcva'],
    ['rxReAdd', 'rxLeAdd'],
    ['rxRePrism', 'rxLePrism'],
    ['rxRePd', 'rxLePd'],
    ['autoReSph', 'autoLeSph'], ['autoReCyl', 'autoLeCyl'], ['autoReAxis', 'autoLeAxis'],
    ['manifestReSph', 'manifestLeSph'], ['manifestReCyl', 'manifestLeCyl'], ['manifestReAxis', 'manifestLeAxis'],
    ['cycloReSph', 'cycloLeSph'], ['cycloReCyl', 'cycloLeCyl'], ['cycloReAxis', 'cycloLeAxis'],
    ['finalReSph', 'finalLeSph'], ['finalReCyl', 'finalLeCyl'], ['finalReAxis', 'finalLeAxis'],
    ['visionREUCVA', 'visionLEUCVA'],
    ['visionREBCVA', 'visionLEBCVA'],
    ['subDvReSph', 'subDvLeSph'], ['subDvReCyl', 'subDvLeCyl'], ['subDvReAxis', 'subDvLeAxis'],
    ['subDvReVaPh', 'subDvLeVaPh'],
    ['subNvReVaUa', 'subNvLeVaUa'], ['subNvReVa', 'subNvLeVa'],
    ['vaReAphakia', 'vaLeAphakia'],
    ['vaRePseudophakia', 'vaLePseudophakia']
  ];

  function copyOdToOs() {
    copyReToLe(COPY_FIELD_MAP);
    [['vaReAphakia', 'vaLeAphakia'], ['vaRePseudophakia', 'vaLePseudophakia']].forEach(([reId, leId]) => {
      const reEl = $(reId);
      const leEl = $(leId);
      if (reEl && leEl) leEl.checked = reEl.checked;
    });
    renderTrendPanel();
  }

  function swapOdOs() {
    swapReLe(COPY_FIELD_MAP);
    [['vaReAphakia', 'vaLeAphakia'], ['vaRePseudophakia', 'vaLePseudophakia']].forEach(([a, b]) => {
      const elA = $(a);
      const elB = $(b);
      if (elA && elB && elA.type === 'checkbox') {
        const t = elA.checked;
        elA.checked = elB.checked;
        elB.checked = t;
      }
    });
    renderTrendPanel();
  }

  function copyPreviousVisit() {
    const prev = global.__vaPreviousVisit;
    if (!prev) {
      alert('No previous visit found for this patient.');
      return;
    }
    if (!confirm('Copy visual acuity & refraction values from the previous visit? Existing entries in this section will be overwritten.')) return;
    migrateLegacyToStructured(prev);
    const form = document.getElementById('patientForm');
    if (!form) return;
    Object.keys(prev).forEach((key) => {
      if (!key.startsWith('va') && !key.startsWith('vision') && !key.startsWith('sub')
        && !key.startsWith('rx') && !key.startsWith('auto') && !key.startsWith('manifest')
        && !key.startsWith('cyclo') && !key.startsWith('final') && !key.startsWith('vaSpec')
        && !key.startsWith('vaLow') && !key.startsWith('vaPed') && key !== 'vaCorneaVisionCauseJSON') return;
      const el = $(key);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!prev[key];
      else el.value = prev[key] ?? '';
    });
    loadCorneaCausesFromData(prev);
    syncLegacyFields();
    renderTrendPanel();
  }

  function fetchPreviousVisit(callback) {
    const patientId = $('patientId')?.value?.trim();
    if (!patientId || !global.db || typeof global.loadPatientVisits !== 'function') {
      global.__vaPreviousVisit = null;
      callback(null);
      return;
    }
    const currentId = parseInt($('currentRecordId')?.value || '', 10);
    global.loadPatientVisits(patientId, (visits) => {
      const sorted = (visits || []).filter((v) => v.id !== currentId)
        .sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || '')));
      const prev = sorted[0] || null;
      global.__vaPreviousVisit = prev;
      callback(prev);
    });
  }

  function renderTrendPanel() {
    const panel = $('vaTrendPanel');
    if (!panel) return;
    const prev = global.__vaPreviousVisit;
    if (!prev) {
      panel.innerHTML = '<p class="form-hint">No prior visit for trend comparison.</p>';
      return;
    }
    migrateLegacyToStructured(prev);
    const rows = [
      ['Distance UCVA RE', 'vaReDistUcva', prev.vaReDistUcva || prev.visionREUCVA],
      ['Distance UCVA LE', 'vaLeDistUcva', prev.vaLeDistUcva || prev.visionLEUCVA],
      ['Distance BCVA RE', 'vaReDistBcva', prev.vaReDistBcva || prev.visionREBCVA],
      ['Distance BCVA LE', 'vaLeDistBcva', prev.vaLeDistBcva || prev.visionLEBCVA]
    ];
    let html = `<div class="va-trend-header"><strong>Trend vs previous visit (${escapeHtml(prev.visitDate || '—')})</strong></div><table class="records-table va-trend-table"><thead><tr><th>Measure</th><th>Previous</th><th>Current</th><th>Trend</th></tr></thead><tbody>`;
    rows.forEach(([label, fieldId, prevVal]) => {
      const cur = $(fieldId)?.value || '';
      const trend = trendLabel(cur, prevVal);
      const cls = trendClass(trend);
      const trendText = trend ? trend.charAt(0).toUpperCase() + trend.slice(1) : '—';
      const warn = trend === 'worsened' ? ' va-trend-warn' : '';
      html += `<tr class="${cls}${warn}"><td>${escapeHtml(label)}</td><td>${escapeHtml(prevVal || '—')}</td><td>${escapeHtml(cur || '—')}</td><td><span class="va-trend-badge ${cls}">${escapeHtml(trendText)}</span></td></tr>`;
    });
    html += '</tbody></table>';
    panel.innerHTML = html;
  }

  function attachQuickSelect(containerId, targetId, options) {
    const container = $(containerId);
    const target = $(targetId);
    if (!container || !target) return;
    container.innerHTML = options.map((v) =>
      `<button type="button" class="va-quick-btn" data-va-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`
    ).join('');
    container.querySelectorAll('.va-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        target.value = btn.getAttribute('data-va-value');
        target.dispatchEvent(new Event('change', { bubbles: true }));
        syncLegacyFields();
        renderTrendPanel();
      });
    });
  }

  function validateAxisInput(el) {
    if (!el || !el.id.toLowerCase().includes('axis')) return;
    const v = el.value.trim();
    if (!v) return;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0 || n > 180) {
      el.setCustomValidity('Axis must be 0–180');
    } else {
      el.setCustomValidity('');
      el.value = String(n);
    }
  }

  function bindPinholeVisibility(eye) {
    const status = $(`va${eye}PinholeStatus`);
    const improvesWrap = $(`va${eye}PinholeImprovesWrap`);
    if (!status || !improvesWrap) return;
    const update = () => {
      improvesWrap.hidden = status.value !== 'Improves to';
    };
    status.addEventListener('change', update);
    update();
  }

  function bindEvents() {
    const form = document.getElementById('patientForm');
    if (!form || bindEvents._done) return;
    bindEvents._done = true;

    form.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-va-cornea-cause], #vaCorneaCauseOther')) syncCorneaCausesToHidden();
      if (t.id && (t.id.startsWith('va') || t.id.startsWith('vision') || LEGACY_SYNC.some((x) => x.from === t.id || x.to === t.id))) {
        syncLegacyFields();
        renderTrendPanel();
      }
      validateAxisInput(t);
    });

    form.addEventListener('input', (e) => {
      validateAxisInput(e.target);
    });

    form.addEventListener('keydown', (e) => {
      if (!e.target.matches('.va-table select')) return;
      const selects = [...form.querySelectorAll('.va-table select')];
      const idx = selects.indexOf(e.target);
      if (idx < 0) return;
      if (e.key === 'ArrowRight' && selects[idx + 1]) {
        e.preventDefault();
        selects[idx + 1].focus();
      } else if (e.key === 'ArrowLeft' && selects[idx - 1]) {
        e.preventDefault();
        selects[idx - 1].focus();
      }
    });

    $('vaCopyOdToOs')?.addEventListener('click', copyOdToOs);
    $('vaSwapOdOs')?.addEventListener('click', swapOdOs);
    $('vaCopyPrevious')?.addEventListener('click', copyPreviousVisit);

    ['Re', 'Le'].forEach((eye) => bindPinholeVisibility(eye));

    const patientIdEl = $('patientId');
    if (patientIdEl) {
      patientIdEl.addEventListener('change', () => fetchPreviousVisit(renderTrendPanel));
      patientIdEl.addEventListener('blur', () => fetchPreviousVisit(renderTrendPanel));
    }

    attachQuickSelect('vaQuickReDist', 'vaReDistUcva', QUICK_DISTANCE);
    attachQuickSelect('vaQuickLeDist', 'vaLeDistUcva', QUICK_DISTANCE);
    attachQuickSelect('vaQuickReBcva', 'vaReDistBcva', QUICK_DISTANCE);
    attachQuickSelect('vaQuickLeBcva', 'vaLeDistBcva', QUICK_DISTANCE);
  }

  function onFormPopulated(data) {
    migrateLegacyToStructured(data || {});
    populateSelects(data || {});
    loadCorneaCausesFromData(data || {});
    syncLegacyFields();
    fetchPreviousVisit(renderTrendPanel);
  }

  function applyBeforeSave(data) {
    if (!data) return data;
    migrateLegacyToStructured(data);
    LEGACY_SYNC.forEach(({ from, to }) => {
      if (data[from] && !data[to]) data[to] = data[from];
    });
    ['Re', 'Le'].forEach((eye) => {
      const status = data[`va${eye}PinholeStatus`];
      const improves = data[`va${eye}PinholeImprovesTo`];
      if (status === 'Improves to' && improves) data[`subDv${eye}VaPh`] = improves;
      else if (status === 'No improvement') data[`subDv${eye}VaPh`] = 'No improvement';
      const dec = parseSnellenDecimal(data[`va${eye}DistUcva`]);
      if (dec != null) {
        data[`va${eye}DistUcvaStd`] = String(dec);
        const lm = toLogMar(dec);
        if (lm != null) data[`va${eye}DistUcvaLogMar`] = String(lm);
      }
      const bdec = parseSnellenDecimal(data[`va${eye}DistBcva`]);
      if (bdec != null) {
        data[`va${eye}DistBcvaStd`] = String(bdec);
        const lm = toLogMar(bdec);
        if (lm != null) data[`va${eye}DistBcvaLogMar`] = String(lm);
      }
    });
    if (typeof document !== 'undefined') syncCorneaCausesToHidden();
    if (data.vaCorneaVisionCauseJSON == null && $('vaCorneaVisionCauseJSON')) {
      data.vaCorneaVisionCauseJSON = $('vaCorneaVisionCauseJSON').value || '[]';
    }
    return data;
  }

  function gv(data, k) {
    const v = data?.[k];
    return v != null && String(v).trim() !== '' ? escapeHtml(String(v).trim()) : '';
  }

  function row(label, value) {
    if (!value) return '';
    return `<tr><td style="width:34%;font-weight:600;color:#3d5166;background:#f7fafd;">${escapeHtml(label)}</td><td>${value}</td></tr>`;
  }

  function formatReadOnly(data) {
    const d = data || {};
    migrateLegacyToStructured(d);
    let html = '';

    const metaRows = [
      row('Vision chart', gv(d, 'refractionVisionChart')),
      row('Occupation', gv(d, 'refractionOccupation')),
      row('Complaints', gv(d, 'refractionComplaints'))
    ].filter(Boolean).join('');
    if (metaRows) {
      html += `<div class="refraction-ro-block"><div class="table-scroll"><table class="records-table"><tbody>${metaRows}</tbody></table></div></div>`;
    }

    const uaRows = ['Re', 'Le'].map((eye) => {
      const label = eye === 'Re' ? 'RE (OD)' : 'LE (OS)';
      const dist = gv(d, `va${eye}DistUcva`) || gv(d, eye === 'Re' ? 'visionREUCVA' : 'visionLEUCVA');
      const near = gv(d, `va${eye}NearUcva`);
      const ph = gv(d, `va${eye}PinholeStatus`);
      const phTo = gv(d, `va${eye}PinholeImprovesTo`);
      if (!dist && !near && !ph) return '';
      return `<tr><td><strong>${label}</strong></td><td>${dist || '—'}</td><td>${near || '—'}</td><td>${ph || '—'}${phTo ? ' → ' + phTo : ''}</td></tr>`;
    }).filter(Boolean).join('');
    if (uaRows) {
      html += `<div class="refraction-ro-block"><h5>Unaided Visual Acuity</h5><div class="table-scroll"><table class="records-table"><thead><tr><th>Eye</th><th>Distance UCVA</th><th>Near UCVA</th><th>Pinhole</th></tr></thead><tbody>${uaRows}</tbody></table></div></div>`;
    }

    const presRows = ['Re', 'Le'].map((eye) => {
      const label = eye === 'Re' ? 'RE (OD)' : 'LE (OS)';
      const dist = gv(d, `va${eye}PresentDist`);
      const near = gv(d, `va${eye}PresentNear`);
      if (!dist && !near) return '';
      return `<tr><td><strong>${label}</strong></td><td>${dist || '—'}</td><td>${near || '—'}</td></tr>`;
    }).filter(Boolean).join('');
    const presMeta = [
      row('Current glasses', gv(d, 'vaPresentGlasses')),
      row('Current contact lenses', gv(d, 'vaPresentCl')),
      row('Aphakia RE / LE', [
      d.vaReAphakia ? 'RE' : '',
      d.vaLeAphakia ? 'LE' : ''
    ].filter(Boolean).join(', ') || ''),
      row('Pseudophakia RE / LE', [
      d.vaRePseudophakia ? 'RE' : '',
      d.vaLePseudophakia ? 'LE' : ''
    ].filter(Boolean).join(', ') || '')
    ].filter(Boolean).join('');
    if (presRows || presMeta) {
      html += `<div class="refraction-ro-block"><h5>Presenting Vision</h5>`;
      if (presRows) {
        html += `<div class="table-scroll"><table class="records-table"><thead><tr><th>Eye</th><th>Distance</th><th>Near</th></tr></thead><tbody>${presRows}</tbody></table></div>`;
      }
      if (presMeta) html += `<div class="table-scroll"><table class="records-table"><tbody>${presMeta}</tbody></table></div>`;
      html += `</div>`;
    }

    const bcvaRows = ['Re', 'Le'].map((eye) => {
      const label = eye === 'Re' ? 'RE (OD)' : 'LE (OS)';
      const dist = gv(d, `va${eye}DistBcva`) || gv(d, eye === 'Re' ? 'visionREBCVA' : 'visionLEBCVA');
      const near = gv(d, `va${eye}NearBcva`);
      if (!dist && !near) return '';
      return `<tr><td><strong>${label}</strong></td><td>${dist || '—'}</td><td>${near || '—'}</td></tr>`;
    }).filter(Boolean).join('');
    if (bcvaRows) {
      html += `<div class="refraction-ro-block"><h5>Best Corrected Visual Acuity</h5><div class="table-scroll"><table class="records-table"><thead><tr><th>Eye</th><th>Distance BCVA</th><th>Near BCVA</th></tr></thead><tbody>${bcvaRows}</tbody></table></div></div>`;
    }

    const rxBlock = (title, prefix) => {
      const rows = ['Re', 'Le'].map((eye) => {
        const label = eye === 'Re' ? 'RE' : 'LE';
        const sph = gv(d, `${prefix}${eye}Sph`);
        const cyl = gv(d, `${prefix}${eye}Cyl`);
        const axis = gv(d, `${prefix}${eye}Axis`);
        if (!sph && !cyl && !axis) return '';
        return `<tr><td><strong>${label}</strong></td><td>${sph || '—'}</td><td>${cyl || '—'}</td><td>${axis || '—'}</td></tr>`;
      }).filter(Boolean).join('');
      if (!rows) return '';
      return `<div class="refraction-ro-block"><h5>${escapeHtml(title)}</h5><div class="table-scroll"><table class="records-table"><thead><tr><th>Eye</th><th>Sphere</th><th>Cylinder</th><th>Axis</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    };

    html += rxBlock('Auto-refraction', 'auto');
    html += rxBlock('Manifest refraction', 'manifest');
    html += rxBlock('Cycloplegic refraction', 'cyclo');
    html += rxBlock('Final prescription', 'final');

    const rxExtra = [
      row('Add RE / LE', [gv(d, 'rxReAdd'), gv(d, 'rxLeAdd')].filter(Boolean).join(' / ')),
      row('Prism RE / LE', [gv(d, 'rxRePrism'), gv(d, 'rxLePrism')].filter(Boolean).join(' / ')),
      row('PD RE / LE', [gv(d, 'rxRePd'), gv(d, 'rxLePd')].filter(Boolean).join(' / ')),
      row('Vertex distance', gv(d, 'rxVertexDist'))
    ].filter(Boolean).join('');
    if (rxExtra) {
      html += `<div class="refraction-ro-block"><h5>Refraction Details</h5><div class="table-scroll"><table class="records-table"><tbody>${rxExtra}</tbody></table></div></div>`;
    }

    // Legacy PG, retino, subjective blocks (same as original formatter)
    html += formatLegacyBlocks(d);

    const specRows = [
      row('Potential acuity (AMSLER/PAM)', gv(d, 'vaSpecPotentialAcuity')),
      row('Brightness acuity test', gv(d, 'vaSpecBat')),
      row('Glare testing', gv(d, 'vaSpecGlare')),
      row('Contrast sensitivity', gv(d, 'vaSpecContrast')),
      row('Amsler grid', gv(d, 'vaSpecAmsler')),
      row('Colour vision', gv(d, 'vaSpecColour')),
      row('Stereoacuity', gv(d, 'vaSpecStereo')),
      row('Potential vision', gv(d, 'vaSpecPotentialVision'))
    ].filter(Boolean).join('');
    if (specRows) {
      html += `<div class="refraction-ro-block"><h5>Special Tests</h5><div class="table-scroll"><table class="records-table"><tbody>${specRows}</tbody></table></div></div>`;
    }

    const lowRows = [
      row('Count fingers RE / LE', [gv(d, 'vaLowCfRe'), gv(d, 'vaLowCfLe')].filter(Boolean).join(' / ')),
      row('Hand movements RE / LE', [gv(d, 'vaLowHmRe'), gv(d, 'vaLowHmLe')].filter(Boolean).join(' / ')),
      row('Light perception RE / LE', [gv(d, 'vaLowLpRe'), gv(d, 'vaLowLpLe')].filter(Boolean).join(' / ')),
      row('Projection of rays RE / LE', [gv(d, 'vaLowProjRe'), gv(d, 'vaLowProjLe')].filter(Boolean).join(' / ')),
      row('Fixation RE / LE', [gv(d, 'vaLowFixRe'), gv(d, 'vaLowFixLe')].filter(Boolean).join(' / ')),
      row('Eccentric fixation RE / LE', [gv(d, 'vaLowEccFixRe'), gv(d, 'vaLowEccFixLe')].filter(Boolean).join(' / '))
    ].filter(Boolean).join('');
    if (lowRows) {
      html += `<div class="refraction-ro-block"><h5>Low Vision</h5><div class="table-scroll"><table class="records-table"><tbody>${lowRows}</tbody></table></div></div>`;
    }

    const pedRows = [
      row('Fix and follow', gv(d, 'vaPedFixFollow')),
      row('CSM', gv(d, 'vaPedCsm')),
      row('Central / Steady / Maintained', [gv(d, 'vaPedCentral'), gv(d, 'vaPedSteady'), gv(d, 'vaPedMaintained')].filter(Boolean).join(' / ')),
      row('Preferential looking', gv(d, 'vaPedPrefLooking')),
      row('Lea symbols / Kay / Teller', [gv(d, 'vaPedLea'), gv(d, 'vaPedKay'), gv(d, 'vaPedTeller')].filter(Boolean).join(' / '))
    ].filter(Boolean).join('');
    if (pedRows) {
      html += `<div class="refraction-ro-block"><h5>Pediatric</h5><div class="table-scroll"><table class="records-table"><tbody>${pedRows}</tbody></table></div></div>`;
    }

    let corneaCauses = [];
    try { corneaCauses = JSON.parse(d.vaCorneaVisionCauseJSON || '[]'); } catch (_) { /* ignore */ }
    if (corneaCauses.length) {
      html += `<div class="refraction-ro-block"><h5>Cornea — vision reduction causes</h5><p class="emr-ro-value">${escapeHtml(corneaCauses.join('; '))}</p></div>`;
    }

    return html || '<p class="emr-ro-value empty">No refraction data recorded.</p>';
  }

  function formatLegacyBlocks(d) {
    let html = '';
    const pgEyeRow = (dist, eye, p) => {
      const vals = [gv(d, p + 'Sph'), gv(d, p + 'Cyl'), gv(d, p + 'Axis'), gv(d, p + 'Va'), gv(d, p + 'SpecCond')].filter(Boolean);
      if (!vals.length) return '';
      return `<tr><td><strong>${escapeHtml(dist + ' ' + eye)}</strong></td><td>${gv(d, p + 'Sph') || '—'}</td><td>${gv(d, p + 'Cyl') || '—'}</td><td>${gv(d, p + 'Axis') || '—'}</td><td>${gv(d, p + 'Va') || '—'}</td><td>${gv(d, p + 'SpecCond') || '—'}</td></tr>`;
    };
    const subEyeRow = (dist, eye, ids) => {
      const cells = ids.map((id) => gv(d, id) || '—');
      if (cells.every((c) => c === '—')) return '';
      return `<tr><td><strong>${escapeHtml(dist + ' ' + eye)}</strong></td>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    };

    const pgRows = [
      pgEyeRow('DV', 'RE', 'pgDvRe'),
      pgEyeRow('DV', 'LE', 'pgDvLe'),
      (gv(d, 'pgNvReAdd') ? `<tr><td><strong>NV RE Add</strong></td><td colspan="5">${gv(d, 'pgNvReAdd')}</td></tr>` : ''),
      (gv(d, 'pgNvLeAdd') ? `<tr><td><strong>NV LE Add</strong></td><td colspan="5">${gv(d, 'pgNvLeAdd')}</td></tr>` : '')
    ].filter(Boolean).join('');
    if (pgRows) {
      html += `<div class="refraction-ro-block"><h5>Present Glasses (PG) Power</h5><div class="table-scroll"><table class="records-table"><thead><tr><th></th><th>Sphere</th><th>Cylinder</th><th>Axis</th><th>VA with PG</th><th>Condition</th></tr></thead><tbody>${pgRows}</tbody></table></div></div>`;
    }

    const pgMeta = [
      row('Duration', gv(d, 'pgDuration')),
      row('Type of glass', gv(d, 'pgGlassType')),
      row('Lens', gv(d, 'pgLens')),
      row('Frame', gv(d, 'pgFrame')),
      row('D BOC', gv(d, 'pgDboc')),
      row('MPD RE / LE', [gv(d, 'pgMpdRe'), gv(d, 'pgMpdLe')].filter(Boolean).join(' / '))
    ].filter(Boolean).join('');
    if (pgMeta) {
      html += `<div class="refraction-ro-block"><h5>PG Details</h5><div class="table-scroll"><table class="records-table"><tbody>${pgMeta}</tbody></table></div></div>`;
    }

    const retinoMeta = [
      row('Retinoscopy', gv(d, 'refractionRetinoType')),
      row('Working distance', gv(d, 'refractionRetinoWd'))
    ].filter(Boolean).join('');
    const retinoRows = [
      (gv(d, 'retinoReSph') || gv(d, 'retinoReCyl') || gv(d, 'retinoReAxis')
        ? `<tr><td><strong>RE</strong></td><td>${gv(d, 'retinoReSph') || '—'}</td><td>${gv(d, 'retinoReCyl') || '—'}</td><td>${gv(d, 'retinoReAxis') || '—'}</td></tr>` : ''),
      (gv(d, 'retinoLeSph') || gv(d, 'retinoLeCyl') || gv(d, 'retinoLeAxis')
        ? `<tr><td><strong>LE</strong></td><td>${gv(d, 'retinoLeSph') || '—'}</td><td>${gv(d, 'retinoLeCyl') || '—'}</td><td>${gv(d, 'retinoLeAxis') || '—'}</td></tr>` : '')
    ].filter(Boolean).join('');
    if (retinoMeta || retinoRows) {
      html += `<div class="refraction-ro-block"><h5>Retinoscopy</h5>`;
      if (retinoMeta) html += `<div class="table-scroll"><table class="records-table"><tbody>${retinoMeta}</tbody></table></div>`;
      if (retinoRows) {
        html += `<div class="table-scroll"><table class="records-table"><thead><tr><th>Eye</th><th>Sphere</th><th>Cylinder</th><th>Axis</th></tr></thead><tbody>${retinoRows}</tbody></table></div>`;
      }
      html += `</div>`;
    }

    const subRows = [
      subEyeRow('DV', 'RE', ['visionREUCVA', 'subDvReSph', 'subDvReCyl', 'subDvReAxis', 'visionREBCVA', 'subDvReVaPh']),
      subEyeRow('DV', 'LE', ['visionLEUCVA', 'subDvLeSph', 'subDvLeCyl', 'subDvLeAxis', 'visionLEBCVA', 'subDvLeVaPh']),
      subEyeRow('NV', 'RE', ['subNvReVaUa', 'subNvReSph', 'subNvReCyl', 'subNvReAxis', 'subNvReVa', 'subNvReVaPh']),
      subEyeRow('NV', 'LE', ['subNvLeVaUa', 'subNvLeSph', 'subNvLeCyl', 'subNvLeAxis', 'subNvLeVa', 'subNvLeVaPh'])
    ].filter(Boolean).join('');
    if (subRows) {
      html += `<div class="refraction-ro-block"><h5>Subjective Refraction</h5><div class="table-scroll"><table class="records-table"><thead><tr><th></th><th>VA unaided</th><th>SPH</th><th>CYL</th><th>Axis</th><th>VA</th><th>VA with PH</th></tr></thead><tbody>${subRows}</tbody></table></div></div>`;
    }

    const footerRows = [
      row('Checked with JCC', gv(d, 'refractionJcc')),
      row('Duo chrome test', gv(d, 'refractionDuoChrome')),
      row('MH present', gv(d, 'refractionMhPresent')),
      row('Cycloplegic refraction needed', gv(d, 'refractionCycloNeeded')),
      row('Comfortable with current PG', gv(d, 'refractionComfortablePg')),
      row('Wants spectacles', gv(d, 'refractionWantsSpectacles')),
      row('Signature', gv(d, 'refractionSignature')),
      row('Time', gv(d, 'refractionTime')),
      row('Advise', gv(d, 'refractionAdvise') || gv(d, 'distantRemarks'))
    ].filter(Boolean).join('');
    if (footerRows) {
      html += `<div class="refraction-ro-block"><h5>Refraction Notes</h5><div class="table-scroll"><table class="records-table"><tbody>${footerRows}</tbody></table></div></div>`;
    }
    return html;
  }

  function populateSelects(data) {
    const d = data || {};
    ['Re', 'Le'].forEach((eye) => {
      const dist = $(`va${eye}DistUcva`);
      const near = $(`va${eye}NearUcva`);
      const bcvaDist = $(`va${eye}DistBcva`);
      const bcvaNear = $(`va${eye}NearBcva`);
      const presDist = $(`va${eye}PresentDist`);
      const presNear = $(`va${eye}PresentNear`);
      const phStatus = $(`va${eye}PinholeStatus`);
      const phImp = $(`va${eye}PinholeImprovesTo`);
      const distVal = d[`va${eye}DistUcva`] || dist?.value;
      const nearVal = d[`va${eye}NearUcva`] || near?.value;
      if (dist) dist.innerHTML = optionHtml(DISTANCE_UCVA, distVal);
      if (near) near.innerHTML = optionHtml(NEAR_UCVA, nearVal);
      if (bcvaDist) bcvaDist.innerHTML = optionHtml(DISTANCE_UCVA, d[`va${eye}DistBcva`] || bcvaDist.value);
      if (bcvaNear) bcvaNear.innerHTML = optionHtml(NEAR_UCVA, d[`va${eye}NearBcva`] || bcvaNear.value);
      if (presDist) presDist.innerHTML = optionHtml(DISTANCE_UCVA, d[`va${eye}PresentDist`] || presDist.value);
      if (presNear) presNear.innerHTML = optionHtml(NEAR_UCVA, d[`va${eye}PresentNear`] || presNear.value);
      if (phStatus) phStatus.innerHTML = optionHtml(PINHOLE_STATUS, d[`va${eye}PinholeStatus`] || phStatus.value);
      if (phImp) phImp.innerHTML = optionHtml(DISTANCE_UCVA, d[`va${eye}PinholeImprovesTo`] || phImp.value);
    });
  }

  function init() {
    populateSelects();
    bindEvents();
  }

  global.CorneaVisualAcuity = {
    DISTANCE_UCVA,
    NEAR_UCVA,
    CORNEA_CAUSES,
    init,
    onFormPopulated,
    applyBeforeSave,
    formatReadOnly,
    migrateLegacyToStructured,
    syncLegacyFields,
    parseSnellenDecimal,
    copyOdToOs,
    swapOdOs,
    copyPreviousVisit,
    renderTrendPanel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    setTimeout(init, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
