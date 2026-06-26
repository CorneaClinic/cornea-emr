/**
 * Cornea Clinic — Slit-Lamp Style Anterior Segment Examination Builder
 * Syncs structured state ↔ legacy fields (lidRE, corneaLE, …) for backward compatibility.
 */
(function (global) {
  'use strict';

  const T = global.CorneaAnteriorSegmentTaxonomy;
  if (!T) return;

  const ROOT_ID = 'anteriorSegmentBuilder';
  const JSON_FIELD = 'anteriorSegmentJSON';
  const DRAW_HINT_KEY = 'cornea_asb_draw_hint';

  /** @type {Record<string, Record<string, EyeState>>} */
  let state = {};
  let previousSnapshot = null;
  let compareMode = false;
  let activeMode = null; // specialist | trauma | postop
  let searchQuery = '';
  let collapsedNormals = true;
  let favorites = [];
  let recentFindings = [];
  let initialized = false;

  /**
   * @typedef {{ status: 'normal'|'abnormal'|'legacy', findings: FindingInst[], expanded: boolean, legacyText?: string }} EyeState
   * @typedef {{ id: string, label: string, sub?: string[], details?: Record<string,string>, note?: string }} FindingInst
   */

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function loadPrefs() {
    try {
      favorites = JSON.parse(localStorage.getItem(T.STORAGE_KEYS.favorites) || '[]');
      recentFindings = JSON.parse(localStorage.getItem(T.STORAGE_KEYS.recent) || '[]');
      collapsedNormals = localStorage.getItem(T.STORAGE_KEYS.collapsed) !== '0';
    } catch (_) {
      favorites = [];
      recentFindings = [];
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(T.STORAGE_KEYS.favorites, JSON.stringify(favorites.slice(0, 40)));
      localStorage.setItem(T.STORAGE_KEYS.recent, JSON.stringify(recentFindings.slice(0, 30)));
      localStorage.setItem(T.STORAGE_KEYS.collapsed, collapsedNormals ? '1' : '0');
    } catch (_) { /* ignore */ }
  }

  function defaultEyeState() {
    return { status: 'normal', findings: [], expanded: false, freeText: '' };
  }

  function ensureState() {
    T.STRUCTURES.forEach((s) => {
      if (!state[s.id]) state[s.id] = { RE: defaultEyeState(), LE: defaultEyeState() };
      T.EYES.forEach((eye) => {
        if (state[s.id][eye].freeText === undefined) state[s.id][eye].freeText = '';
      });
    });
  }

  function isNormalText(structureId, text) {
    const s = T.structureById(structureId);
    const t = String(text || '').trim().toLowerCase();
    if (!t) return true;
    if (t === s.normalText.toLowerCase()) return true;
    return (s.legacyNormal || []).some((n) => t === n.toLowerCase() || t.includes(n.toLowerCase()));
  }

  function formatFinding(inst, structureId) {
    const def = T.findingById(structureId, inst.id);
    const label = inst.label || def?.label || inst.id;
    const parts = [label];
    if (inst.sub?.length) parts.push(inst.sub.join(', '));
    if (inst.details) {
      Object.entries(inst.details).forEach(([k, v]) => {
        if (v) parts.push(`${k}: ${v}`);
      });
    }
    if (inst.note) parts.push(inst.note);
    return parts.join(' — ');
  }

  function getEyeDisplayValue(structureId, eye, data) {
    const struct = T.structureById(structureId);
    const fieldKey = T.fieldId(structureId, eye);
    const raw = data?.[fieldKey];
    if (raw != null && String(raw).trim()) return String(raw).trim();
    return serializeEye(structureId, eye).trim() || struct.normalText;
  }

  function serializeEye(structureId, eye) {
    const s = state[structureId]?.[eye];
    const struct = T.structureById(structureId);
    if (!s) return struct.normalText;
    if (s.status === 'legacy' && s.legacyText) return s.legacyText;

    const parts = [];
    if (s.findings.length) {
      parts.push(...s.findings.map((f) => formatFinding(f, structureId)));
    }
    if (s.freeText?.trim()) parts.push(s.freeText.trim());

    if (!parts.length) return struct.normalText;
    return parts.join('; ');
  }

  function setFreeText(structureId, eye, text) {
    ensureState();
    const eyeState = state[structureId][eye];
    eyeState.freeText = text;
    if (text.trim()) {
      eyeState.status = 'abnormal';
      eyeState.expanded = true;
    } else if (!eyeState.findings.length) {
      eyeState.status = 'normal';
    }
    checkConflicts(structureId, eye);
    syncToLegacyFields();
  }

  function syncToLegacyFields() {
    ensureState();
    T.STRUCTURES.forEach((struct) => {
      T.EYES.forEach((eye) => {
        const el = $(T.fieldId(struct.id, eye));
        if (el) {
          el.value = serializeEye(struct.id, eye);
          global.checkNormalModification?.(T.fieldId(struct.id, eye));
        }
      });
    });
    const jsonEl = $(JSON_FIELD);
    if (jsonEl) {
      jsonEl.value = (global.safeJsonStringify || JSON.stringify)({
        version: 1,
        state,
        updatedAt: new Date().toISOString()
      });
    }
    global.refreshExamFindingHighlights?.();
  }

  function parseLegacyToState(structureId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || isNormalText(structureId, trimmed)) {
      return { status: 'normal', findings: [], expanded: false };
    }
    return {
      status: 'legacy',
      legacyText: trimmed,
      findings: [{ id: 'legacy', label: trimmed, note: trimmed }],
      expanded: true
    };
  }

  function hydrateFromJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr || '{}');
      if (parsed?.state && typeof parsed.state === 'object') {
        state = parsed.state;
        ensureState();
        return true;
      }
    } catch (_) { /* fall through */ }
    return false;
  }

  function hydrateFromLegacyFields() {
    state = {};
    ensureState();
    T.STRUCTURES.forEach((struct) => {
      T.EYES.forEach((eye) => {
        const el = $(T.fieldId(struct.id, eye));
        state[struct.id][eye] = parseLegacyToState(struct.id, el?.value || '');
      });
    });
  }

  function migrateLegacyToStructured(structureId, eye) {
    const eyeState = state[structureId][eye];
    if (eyeState.status !== 'legacy' || !eyeState.legacyText) return;
    const text = eyeState.legacyText.toLowerCase();
    const struct = T.structureById(structureId);
    const matched = [];
    struct.findings.forEach((f) => {
      if (text.includes(f.label.toLowerCase())) {
        matched.push({ id: f.id, label: f.label });
      }
    });
    if (matched.length) {
      state[structureId][eye] = { status: 'abnormal', findings: matched, expanded: true };
    }
  }

  function addFinding(structureId, eye, findingId, opts = {}) {
    ensureState();
    const def = T.findingById(structureId, findingId);
    if (!def) return;
    const eyeState = state[structureId][eye];
    eyeState.status = 'abnormal';
    eyeState.expanded = true;
    eyeState.legacyText = '';

    const inst = {
      id: findingId,
      label: def.label,
      sub: opts.sub ? (Array.isArray(opts.sub) ? opts.sub : [opts.sub]) : [],
      details: opts.details ? { ...opts.details } : {},
      note: opts.note || ''
    };

    const exists = eyeState.findings.some((f) => f.id === findingId && JSON.stringify(f.sub) === JSON.stringify(inst.sub));
    if (!exists) eyeState.findings.push(inst);

    checkConflicts(structureId, eye);
    trackRecent(structureId, findingId);
    syncToLegacyFields();
    render();
  }

  function removeFinding(structureId, eye, index) {
    const eyeState = state[structureId][eye];
    eyeState.findings.splice(index, 1);
    if (!eyeState.findings.length) eyeState.status = 'normal';
    checkConflicts(structureId, eye);
    syncToLegacyFields();
    render();
  }

  function setNormal(structureId, eye) {
    state[structureId][eye] = { status: 'normal', findings: [], expanded: false };
    syncToLegacyFields();
    render();
  }

  function setAbnormal(structureId, eye) {
    const eyeState = state[structureId][eye];
    eyeState.status = 'abnormal';
    eyeState.expanded = true;
    if (!eyeState.findings.length) eyeState.findings = [];
    render();
  }

  function toggleExpand(structureId, eye) {
    state[structureId][eye].expanded = !state[structureId][eye].expanded;
    render();
  }

  function copyEye(structureId, fromEye, toEye) {
    state[structureId][toEye] = JSON.parse(JSON.stringify(state[structureId][fromEye]));
    syncToLegacyFields();
    render();
  }

  function swapEyes(structureId) {
    const a = state[structureId].RE;
    state[structureId].RE = JSON.parse(JSON.stringify(state[structureId].LE));
    state[structureId].LE = a;
    syncToLegacyFields();
    render();
  }

  function setAllNormal() {
    T.STRUCTURES.forEach((s) => T.EYES.forEach((e) => setNormal(s.id, e)));
  }

  function checkConflicts(structureId, eye) {
    const groups = T.CONFLICT_GROUPS[structureId];
    if (!groups) return [];
    const eyeState = state[structureId][eye];
    const ids = eyeState.findings.map((f) => f.id);
    const warnings = [];
    groups.forEach((group) => {
      const hit = group.filter((g) => ids.includes(g));
      if (hit.length > 1) {
        warnings.push(`Conflicting ${T.structureById(structureId).label} findings: ${hit.join(', ')}`);
      }
    });
    if (structureId === 'cornea' && eyeState.status === 'normal' && ids.length) {
      warnings.push('Cornea cannot be Clear with other findings.');
    }
    if (structureId === 'lens') {
      if (ids.includes('aphakia') && ids.some((id) => id === 'cataract' || id === 'clear')) {
        warnings.push('Lens cannot be both aphakic and clear/cataractous.');
      }
    }
    eyeState._warnings = warnings;
    return warnings;
  }

  function trackRecent(structureId, findingId) {
    const key = `${structureId}:${findingId}`;
    recentFindings = [key, ...recentFindings.filter((k) => k !== key)].slice(0, 30);
    savePrefs();
  }

  function toggleFavorite(structureId, findingId) {
    const key = `${structureId}:${findingId}`;
    if (favorites.includes(key)) favorites = favorites.filter((k) => k !== key);
    else favorites = [key, ...favorites].slice(0, 40);
    savePrefs();
    render();
  }

  function applyTemplate(template, templateMap) {
    const t = templateMap[template];
    if (!t) return;
    if (t.apply && T.SPECIALIST_TEMPLATES[t.apply]) {
      applyTemplate(t.apply, T.SPECIALIST_TEMPLATES);
      return;
    }
    (t.findings || []).forEach((f) => {
      const structId = f.structure || t.structure;
      T.EYES.forEach((eye) => {
        addFinding(structId, eye, f.id, { sub: f.sub, details: f.details, note: f.note });
      });
    });
    if (t.drawLink) promptDrawing(f.label || t.label);
  }

  function promptDrawing(label) {
    try {
      sessionStorage.setItem(DRAW_HINT_KEY, label || '');
    } catch (_) { /* ignore */ }
    if (typeof global.openAnteriorDrawingModal === 'function') {
      global.openAnteriorDrawingModal();
    }
  }

  function pullPreviousVisit() {
    if (typeof global.pullPreviousAntSegment === 'function') {
      global.pullPreviousAntSegment();
      setTimeout(() => {
        hydrateFromLegacyFields();
        syncToLegacyFields();
        render();
      }, 300);
    }
  }

  function loadPreviousForCompare() {
    const patientId = $('patientId')?.value?.trim();
    if (!patientId || !global.loadPatientVisits) return;
    global.loadPatientVisits(patientId, (visits) => {
      const currentId = parseInt($('currentRecordId')?.value || '', 10);
      const sorted = visits.filter((v) => v.id !== currentId).sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
      if (!sorted.length) {
        alert('No previous visit for comparison.');
        return;
      }
      previousSnapshot = sorted[0];
      compareMode = true;
      render();
    });
  }

  function compareStatus(structureId, eye) {
    if (!previousSnapshot) return null;
    const prev = String(previousSnapshot[T.fieldId(structureId, eye)] || '').trim().toLowerCase();
    const curr = serializeEye(structureId, eye).trim().toLowerCase();
    if (prev === curr) return 'stable';
    if (!prev && curr) return 'new';
    if (prev && !curr) return 'cleared';
    const struct = T.structureById(structureId);
    if (curr === struct.normalText.toLowerCase() && prev !== struct.normalText.toLowerCase()) return 'improved';
    if (prev === struct.normalText.toLowerCase() && curr !== struct.normalText.toLowerCase()) return 'worsened';
    return 'changed';
  }

  function formatProseNotes(data) {
    const lines = [];
    T.STRUCTURES.forEach((struct) => {
      const re = getEyeDisplayValue(struct.id, 'RE', data);
      const le = getEyeDisplayValue(struct.id, 'LE', data);
      if (re === le) {
        lines.push(`${struct.label}:\n${re}.`);
      } else {
        lines.push(`${struct.label} (OD):\n${re}.`);
        lines.push(`${struct.label} (OS):\n${le}.`);
      }
    });
    return lines.join('\n\n');
  }

  function formatReadOnlyCell(structureId, eye, value) {
    const v = String(value || '').trim();
    if (!v) return '<span class="emr-ro-value empty">—</span>';
    const abnormal = !isNormalText(structureId, v);
    const cls = abnormal ? 'emr-ro-value finding-abnormal' : 'emr-ro-value';
    return `<span class="${cls}">${escapeHtml(v)}</span>`;
  }

  function formatReadOnlyTable(data) {
    const rows = T.STRUCTURES.map((struct) => {
      const reVal = getEyeDisplayValue(struct.id, 'RE', data);
      const leVal = getEyeDisplayValue(struct.id, 'LE', data);
      return `<tr>
        <th scope="row">${escapeHtml(struct.label)}</th>
        <td>${formatReadOnlyCell(struct.id, 'RE', reVal)}</td>
        <td>${formatReadOnlyCell(struct.id, 'LE', leVal)}</td>
      </tr>`;
    }).join('');
    return `<div class="table-wrapper asb-ro-wrap">
      <table class="clinic-table asb-ro-table">
        <thead>
          <tr><th scope="col">Structure</th><th scope="col">OD (Right)</th><th scope="col">OS (Left)</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderToolbar() {
    return `
      <div class="asb-toolbar no-print" role="toolbar" aria-label="Anterior segment tools">
        <div class="asb-toolbar-row">
          <button type="button" class="btn-secondary btn-sm" data-asb="all-normal"><i class="fa-solid fa-check-double"></i> All Normal</button>
          <button type="button" class="btn-secondary btn-sm" data-asb="prev"><i class="fa-solid fa-rotate-left"></i> Previous Visit</button>
          <button type="button" class="btn-secondary btn-sm" data-asb="compare"><i class="fa-solid fa-code-compare"></i> Compare</button>
          <button type="button" class="btn-secondary btn-sm" data-asb="collapse">${collapsedNormals ? 'Expand All' : 'Collapse Normals'}</button>
          <button type="button" class="btn-secondary btn-sm" data-asb="export"><i class="fa-solid fa-file-export"></i> Export JSON</button>
        </div>
        <div class="asb-toolbar-row">
          <input type="search" class="asb-search" id="asbSearchInput" placeholder="Search findings… ( / )" value="${escapeHtml(searchQuery)}" aria-label="Search findings">
          <div class="asb-mode-tabs">
            <button type="button" class="asb-mode-btn${activeMode === 'specialist' ? ' active' : ''}" data-asb-mode="specialist">Cornea Specialist</button>
            <button type="button" class="asb-mode-btn${activeMode === 'trauma' ? ' active' : ''}" data-asb-mode="trauma">Trauma</button>
            <button type="button" class="asb-mode-btn${activeMode === 'postop' ? ' active' : ''}" data-asb-mode="postop">Post-op</button>
          </div>
        </div>
        ${activeMode ? renderModePanel() : ''}
        ${compareMode && previousSnapshot ? `<div class="asb-compare-banner">Comparing with visit ${escapeHtml(previousSnapshot.visitDate || '')} · <button type="button" class="asb-link-btn" data-asb="compare-off">Dismiss</button></div>` : ''}
      </div>`;
  }

  function renderModePanel() {
    let map = T.SPECIALIST_TEMPLATES;
    if (activeMode === 'trauma') map = T.TRAUMA_TEMPLATES;
    if (activeMode === 'postop') map = T.POSTOP_TEMPLATES;
    const btns = Object.entries(map).map(([key, t]) =>
      `<button type="button" class="asb-quick-btn" data-asb-template="${escapeHtml(key)}" data-asb-mode-map="${activeMode}">${escapeHtml(t.label)}</button>`
    ).join('');
    return `<div class="asb-mode-panel">${btns}</div>`;
  }

  function renderFindingTags(structureId, eye) {
    const eyeState = state[structureId][eye];
    const struct = T.structureById(structureId);
    const tags = [];

    if (eyeState.status === 'normal' && !eyeState.freeText?.trim() && !eyeState.findings.length) {
      tags.push(`<span class="asb-tag asb-tag-normal">${escapeHtml(struct.normalText)}</span>`);
    } else {
      eyeState.findings.forEach((f, i) => {
        const text = formatFinding(f, structureId);
        const fav = favorites.includes(`${structureId}:${f.id}`);
        tags.push(`<span class="asb-tag asb-tag-finding" data-asb-rm="${structureId}:${eye}:${i}">
          ${escapeHtml(text)}
          <button type="button" class="asb-tag-x" aria-label="Remove">×</button>
          ${f.id !== 'legacy' ? `<button type="button" class="asb-tag-fav${fav ? ' on' : ''}" data-asb-fav="${structureId}:${f.id}" title="Favourite">★</button>` : ''}
        </span>`);
      });
      if (eyeState.freeText?.trim()) {
        tags.push(`<span class="asb-tag asb-tag-freetext" title="Free text finding">${escapeHtml(eyeState.freeText.trim())}</span>`);
      }
    }
    return tags.join('');
  }

  function renderAbnormalMenu(structureId, eye) {
    const struct = T.structureById(structureId);
    const q = searchQuery.trim().toLowerCase();
    let findings = struct.findings;
    if (q) {
      findings = findings.filter((f) => f.label.toLowerCase().includes(q));
    }
    const favSection = favorites.filter((k) => k.startsWith(structureId + ':')).slice(0, 6);
    let html = '';
    if (favSection.length) {
      html += `<div class="asb-sub-label">Favourites</div><div class="asb-chip-row">${favSection.map((k) => {
        const fid = k.split(':')[1];
        const f = T.findingById(structureId, fid);
        return f ? `<button type="button" class="asb-chip" data-asb-add="${structureId}:${eye}:${fid}">${escapeHtml(f.label)}</button>` : '';
      }).join('')}</div>`;
    }
    html += `<div class="asb-sub-label">Findings</div><div class="asb-chip-row">`;
    html += findings.map((f) =>
      `<button type="button" class="asb-chip" data-asb-add="${structureId}:${eye}:${f.id}" data-asb-draw="${f.drawLink ? '1' : '0'}">${escapeHtml(f.label)}</button>`
    ).join('');
    html += '</div>';

    const eyeState = state[structureId][eye];
    if (eyeState.findings.length) {
      html += `<div class="asb-detail-editor">`;
      eyeState.findings.forEach((inst, idx) => {
        const def = T.findingById(structureId, inst.id);
        if (def?.children?.length) {
          html += `<div class="asb-detail-block"><span class="asb-detail-title">${escapeHtml(inst.label)}</span><div class="asb-chip-row">`;
          def.children.forEach((c) => {
            const on = inst.sub?.includes(c);
            html += `<button type="button" class="asb-chip asb-chip-sub${on ? ' on' : ''}" data-asb-sub="${structureId}:${eye}:${idx}:${escapeHtml(c)}">${escapeHtml(c)}</button>`;
          });
          html += '</div></div>';
        }
        if (def?.details?.length) {
          html += `<div class="asb-detail-block"><span class="asb-detail-title">Details</span>`;
          def.details.forEach((d) => {
            const val = inst.details?.[d] || '';
            if (d === 'Hypopyon' || (inst.id === 'hypopyon' && d === 'Size')) {
              html += `<div class="asb-detail-row"><label>${escapeHtml(d)}</label><select data-asb-detail="${structureId}:${eye}:${idx}:${escapeHtml(d)}">
                <option value="">—</option>${['1 mm', '2 mm', '3 mm', '4 mm', '5 mm'].map((mm) => `<option value="${mm}"${val === mm ? ' selected' : ''}>${mm}</option>`).join('')}
              </select></div>`;
            } else {
              html += `<div class="asb-detail-row"><label>${escapeHtml(d)}</label><input type="text" value="${escapeHtml(val)}" data-asb-detail="${structureId}:${eye}:${idx}:${escapeHtml(d)}" placeholder="${escapeHtml(d)}"></div>`;
            }
          });
          html += '</div>';
        }
        if (def?.freeText || inst.id === 'legacy') {
          html += `<div class="asb-detail-row"><label>Note</label><input type="text" value="${escapeHtml(inst.note || inst.label)}" data-asb-note="${structureId}:${eye}:${idx}"></div>`;
        }
      });
      html += '</div>';
    }

    if (structureId === 'lid' && typeof global.getAllLidConditionStrings === 'function') {
      html += `<div class="asb-lid-search"><input type="text" placeholder="Search full lid list…" data-asb-lid="${eye}" class="asb-lid-input"><div class="asb-lid-results" data-asb-lid-results="${eye}"></div></div>`;
    }

    const warnings = eyeState._warnings || [];
    if (warnings.length) {
      html += `<div class="asb-warn">${warnings.map((w) => escapeHtml(w)).join('<br>')}</div>`;
    }
    return html;
  }

  function renderEyeColumn(structureId, eye) {
    const struct = T.structureById(structureId);
    const eyeState = state[structureId][eye];
    const isNormal = eyeState.status === 'normal';
    const collapsed = collapsedNormals && isNormal && !eyeState.expanded;
    const cmp = compareMode ? compareStatus(structureId, eye) : null;
    const cmpBadge = cmp ? `<span class="asb-cmp asb-cmp-${cmp}">${cmp}</span>` : '';

    return `
      <div class="asb-eye-col" data-eye="${eye}">
        <div class="asb-eye-head">${T.EYE_LABELS[eye]} ${cmpBadge}</div>
        <div class="asb-eye-actions no-print">
          <button type="button" class="asb-action-btn asb-normal${isNormal ? ' active' : ''}" data-asb-normal="${structureId}:${eye}" title="Normal (N)">Normal</button>
          <button type="button" class="asb-action-btn asb-abnormal${!isNormal ? ' active' : ''}" data-asb-abnormal="${structureId}:${eye}">Abnormal</button>
          <button type="button" class="asb-action-btn" data-asb-expand="${structureId}:${eye}" title="Expand">${eyeState.expanded ? '▲' : '▼'}</button>
        </div>
        <div class="asb-tags">${renderFindingTags(structureId, eye)}</div>
        <div class="asb-freetext no-print">
          <label class="asb-freetext-label">Other findings (free text)</label>
          <textarea class="asb-freetext-input" rows="2" placeholder="Enter unlisted abnormalities for ${escapeHtml(struct.label)}…" data-asb-freetext="${structureId}:${eye}">${escapeHtml(eyeState.freeText || '')}</textarea>
        </div>
        ${!collapsed && !isNormal ? `<div class="asb-abnormal-panel">${renderAbnormalMenu(structureId, eye)}</div>` : ''}
        ${!collapsed && isNormal && eyeState.expanded ? `<p class="asb-normal-hint">Normal — use free text or Abnormal for additional findings.</p>` : ''}
      </div>`;
  }

  function renderStructureCard(struct) {
    const eyeStateRE = state[struct.id].RE;
    const eyeStateLE = state[struct.id].LE;
    const isBothNormal = eyeStateRE.status === 'normal' && eyeStateLE.status === 'normal'
      && !eyeStateRE.freeText?.trim() && !eyeStateLE.freeText?.trim();
    const cardCollapsed = collapsedNormals && isBothNormal;
    return `
      <article class="asb-card${cardCollapsed ? ' asb-card-collapsed' : ''}" data-structure="${struct.id}" id="asb-card-${struct.id}">
        <header class="asb-card-header">
          <span class="asb-card-num">${struct.order}</span>
          <h4 class="asb-card-title">${escapeHtml(struct.label)}</h4>
          <div class="asb-card-tools no-print">
            <button type="button" class="asb-icon-btn" data-asb-copy="od-os:${struct.id}" title="Copy OD → OS">OD→OS</button>
            <button type="button" class="asb-icon-btn" data-asb-copy="os-od:${struct.id}" title="Copy OS → OD">OS→OD</button>
            <button type="button" class="asb-icon-btn" data-asb-swap="${struct.id}" title="Swap eyes">⇄</button>
            <button type="button" class="asb-icon-btn" data-asb-prev="${struct.id}" title="Previous visit">⟲</button>
          </div>
        </header>
        <div class="asb-card-body">
          <div class="asb-eyes-grid">
            ${renderEyeColumn(struct.id, 'RE')}
            ${renderEyeColumn(struct.id, 'LE')}
          </div>
        </div>
      </article>`;
  }

  function render() {
    const root = $(ROOT_ID);
    if (!root) return;
    ensureState();
    T.STRUCTURES.forEach((s) => T.EYES.forEach((e) => checkConflicts(s.id, e)));
    root.innerHTML = renderToolbar() + `<div class="asb-cards">${T.STRUCTURES.map(renderStructureCard).join('')}</div>`;
    bindEvents(root);
  }

  function bindEvents(root) {
    root.querySelector('[data-asb="all-normal"]')?.addEventListener('click', setAllNormal);
    root.querySelector('[data-asb="prev"]')?.addEventListener('click', pullPreviousVisit);
    root.querySelector('[data-asb="compare"]')?.addEventListener('click', loadPreviousForCompare);
    root.querySelector('[data-asb="compare-off"]')?.addEventListener('click', () => { compareMode = false; render(); });
    root.querySelector('[data-asb="collapse"]')?.addEventListener('click', () => { collapsedNormals = !collapsedNormals; savePrefs(); render(); });
    root.querySelector('[data-asb="export"]')?.addEventListener('click', exportJson);

    root.querySelector('#asbSearchInput')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    root.querySelectorAll('[data-asb-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMode = activeMode === btn.dataset.asbMode ? null : btn.dataset.asbMode;
        render();
      });
    });

    root.querySelectorAll('[data-asb-template]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.asbModeMap;
        const map = mode === 'trauma' ? T.TRAUMA_TEMPLATES : mode === 'postop' ? T.POSTOP_TEMPLATES : T.SPECIALIST_TEMPLATES;
        applyTemplate(btn.dataset.asbTemplate, map);
      });
    });

    root.querySelectorAll('[data-asb-normal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [sid, eye] = btn.dataset.asbNormal.split(':');
        setNormal(sid, eye);
      });
    });

    root.querySelectorAll('[data-asb-abnormal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [sid, eye] = btn.dataset.asbAbnormal.split(':');
        setAbnormal(sid, eye);
      });
    });

    root.querySelectorAll('[data-asb-expand]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [sid, eye] = btn.dataset.asbExpand.split(':');
        toggleExpand(sid, eye);
      });
    });

    root.querySelectorAll('[data-asb-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [dir, sid] = btn.dataset.asbCopy.split(':');
        copyEye(sid, dir === 'od-os' ? 'RE' : 'LE', dir === 'od-os' ? 'LE' : 'RE');
      });
    });

    root.querySelectorAll('[data-asb-swap]').forEach((btn) => {
      btn.addEventListener('click', () => swapEyes(btn.dataset.asbSwap));
    });

    root.querySelectorAll('[data-asb-prev]').forEach((btn) => {
      btn.addEventListener('click', pullPreviousVisit);
    });

    root.querySelectorAll('[data-asb-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [sid, eye, fid] = btn.dataset.asbAdd.split(':');
        addFinding(sid, eye, fid);
        if (btn.dataset.asbDraw === '1') promptDrawing(T.findingById(sid, fid)?.label);
      });
    });

    root.querySelectorAll('[data-asb-rm]').forEach((el) => {
      el.querySelector('.asb-tag-x')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const [sid, eye, idx] = el.dataset.asbRm.split(':');
        removeFinding(sid, eye, parseInt(idx, 10));
      });
    });

    root.querySelectorAll('[data-asb-fav]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [sid, fid] = btn.dataset.asbFav.split(':');
        toggleFavorite(sid, fid);
      });
    });

    root.querySelectorAll('[data-asb-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const parts = btn.dataset.asbSub.split(':');
        const sid = parts[0];
        const eye = parts[1];
        const idx = parseInt(parts[2], 10);
        const subVal = parts.slice(3).join(':');
        const inst = state[sid][eye].findings[idx];
        if (!inst.sub) inst.sub = [];
        const i = inst.sub.indexOf(subVal);
        if (i >= 0) inst.sub.splice(i, 1);
        else inst.sub.push(subVal);
        syncToLegacyFields();
        render();
      });
    });

    root.querySelectorAll('[data-asb-detail]').forEach((el) => {
      const handler = () => {
        const parts = el.dataset.asbDetail.split(':');
        const sid = parts[0];
        const eye = parts[1];
        const idx = parseInt(parts[2], 10);
        const key = parts.slice(3).join(':');
        const inst = state[sid][eye].findings[idx];
        if (!inst.details) inst.details = {};
        inst.details[key] = el.value;
        syncToLegacyFields();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    root.querySelectorAll('[data-asb-note]').forEach((el) => {
      el.addEventListener('input', () => {
        const [sid, eye, idx] = el.dataset.asbNote.split(':');
        const inst = state[sid][eye].findings[parseInt(idx, 10)];
        inst.note = el.value;
        if (inst.id === 'legacy') inst.label = el.value;
        syncToLegacyFields();
      });
    });

    root.querySelectorAll('[data-asb-freetext]').forEach((el) => {
      el.addEventListener('input', () => {
        const [sid, eye] = el.dataset.asbFreetext.split(':');
        ensureState();
        const eyeState = state[sid][eye];
        eyeState.freeText = el.value;
        if (el.value.trim()) {
          eyeState.status = 'abnormal';
          eyeState.expanded = true;
        } else if (!eyeState.findings.length) {
          eyeState.status = 'normal';
        }
        checkConflicts(sid, eye);
        syncToLegacyFields();
      });
      el.addEventListener('blur', () => {
        const [sid, eye] = el.dataset.asbFreetext.split(':');
        setFreeText(sid, eye, el.value);
        render();
      });
    });

    root.querySelectorAll('.asb-lid-input').forEach((input) => {
      input.addEventListener('input', () => {
        const eye = input.dataset.asbLid;
        const box = root.querySelector(`[data-asb-lid-results="${eye}"]`);
        if (!box || typeof global.getAllLidConditionStrings !== 'function') return;
        const q = input.value.trim().toLowerCase();
        if (!q) { box.innerHTML = ''; return; }
        const matches = global.getAllLidConditionStrings().filter((s) => s.toLowerCase().includes(q)).slice(0, 12);
        box.innerHTML = matches.map((m) =>
          `<button type="button" class="asb-lid-item" data-asb-lid-pick="${eye}" data-label="${escapeHtml(m)}">${escapeHtml(m)}</button>`
        ).join('');
        box.querySelectorAll('[data-asb-lid-pick]').forEach((b) => {
          b.addEventListener('click', () => {
            addFinding('lid', eye, 'lid_other', { note: b.dataset.label });
            input.value = '';
            box.innerHTML = '';
          });
        });
      });
    });
  }

  function exportJson() {
    syncToLegacyFields();
    const blob = new Blob([$(JSON_FIELD)?.value || '{}'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `anterior-segment-${$('patientId')?.value || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onKeyDown(e) {
    const root = $(ROOT_ID);
    if (!root || !root.closest('.tab-content')?.classList.contains('active')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key !== 'Escape') return;
    }
    if (e.key === '/') {
      e.preventDefault();
      root.querySelector('#asbSearchInput')?.focus();
    }
  }

  function init() {
    if (initialized) return;
    loadPrefs();
    ensureState();
    const jsonEl = $(JSON_FIELD);
    if (jsonEl?.value && hydrateFromJson(jsonEl.value)) {
      syncToLegacyFields();
    } else {
      hydrateFromLegacyFields();
      syncToLegacyFields();
    }
    render();
    document.addEventListener('keydown', onKeyDown);
    initialized = true;
  }

  function onFormPopulated(data) {
    if (!data) return;
    if (data[JSON_FIELD] && hydrateFromJson(data[JSON_FIELD])) {
      syncToLegacyFields();
    } else {
      hydrateFromLegacyFields();
      T.STRUCTURES.forEach((s) => T.EYES.forEach((e) => migrateLegacyToStructured(s.id, e)));
      syncToLegacyFields();
    }
    render();
  }

  function buildLegacyHiddenFields() {
    const host = $('anteriorSegmentLegacyFields');
    if (!host) return;
    T.STRUCTURES.forEach((struct) => {
      T.EYES.forEach((eye) => {
        const id = T.fieldId(struct.id, eye);
        if (!$(id)) {
          const input = document.createElement('input');
          input.type = 'text';
          input.id = id;
          input.name = id;
          input.className = 'asb-legacy-input';
          input.tabIndex = -1;
          input.setAttribute('aria-hidden', 'true');
          host.appendChild(input);
        }
      });
    });
    if (!$(JSON_FIELD)) {
      const h = document.createElement('input');
      h.type = 'hidden';
      h.id = JSON_FIELD;
      h.name = JSON_FIELD;
      host.appendChild(h);
    }
  }

  global.CorneaAnteriorSegment = {
    init,
    onFormPopulated,
    setAllNormal,
    setNormal,
    setAbnormal,
    addFinding,
    syncToLegacyFields,
    hydrateFromLegacyFields,
    formatProseNotes,
    formatReadOnlyTable,
    getEyeDisplayValue,
    serializeEye,
    buildLegacyHiddenFields,
    pullPreviousVisit
  };
})(typeof window !== 'undefined' ? window : globalThis);
