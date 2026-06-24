/**
 * Research analytics dashboard — registry summaries, cohort export, graft survival (Project 6)
 */
(function (global) {
  'use strict';

  const COHORTS = [
    { id: 'kc', label: 'KC registry patients' },
    { id: 'cxl', label: 'CXL procedures' },
    { id: 'keratitis', label: 'Keratitis / ulcer cases' },
    { id: 'kp', label: 'Keratoplasty patients' },
    { id: 'kp-graft', label: 'Post-graft outcomes' }
  ];

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function api(path, options) {
    return global.CorneaApi.request(path, options);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val == null ? '—' : String(val);
  }

  function renderSurvivalCurve(curve) {
    const el = document.getElementById('raGraftSurvivalChart');
    if (!el || !curve?.length) {
      if (el) el.innerHTML = '<p class="text-muted">No completed grafts with surgery dates yet.</p>';
      return;
    }
    el.innerHTML = `<div class="kp-ecd-chart">${curve.map((pt) => {
      const h = pt.survivalRate != null ? Math.round(pt.survivalRate * 0.8) + 10 : 10;
      return `<div class="kp-ecd-bar" title="${pt.monthsPostOp} mo: ${pt.survivalRate ?? '—'}%"><span style="height:${h}px"></span><small>${pt.monthsPostOp}m</small></div>`;
    }).join('')}</div>`;
  }

  function renderCohortTable(rows) {
    const body = document.getElementById('raCohortBody');
    const head = document.getElementById('raCohortHead');
    if (!body) return;
    if (!rows?.length) {
      if (head) head.innerHTML = '';
      body.innerHTML = '<tr><td colspan="8" class="text-muted">No records. Sign in to cloud or add registry data.</td></tr>';
      return;
    }
    const keys = Object.keys(rows[0]).slice(0, 8);
    if (head) head.innerHTML = `<tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr>`;
    body.innerHTML = rows.slice(0, 100).map((r) => `<tr>${keys.map((k) => `<td>${r[k] ?? '—'}</td>`).join('')}</tr>`).join('');
  }

  async function loadOverview() {
    if (!apiOn()) {
      setText('raKcTotal', '—');
      setText('raUkTotal', '—');
      setText('raGraftSurvival', '—');
      document.getElementById('raCloudHint')?.removeAttribute('hidden');
      return;
    }
    document.getElementById('raCloudHint')?.setAttribute('hidden', 'hidden');
    try {
      const res = await api('/api/v1/research-analytics/overview');
      const d = res?.data || {};
      setText('raKcTotal', d.registries?.kc?.patients?.total ?? 0);
      setText('raKcProgression', d.registries?.kc?.patients?.progression_confirmed ?? 0);
      setText('raCxlTotal', d.registries?.kc?.cxl?.total ?? 0);
      setText('raUkTotal', d.registries?.keratitis?.total ?? 0);
      setText('raUkResolved', d.registries?.keratitis?.resolved ?? 0);
      setText('raKpCompleted', d.registries?.keratoplasty?.completed ?? 0);
      setText('raGraftExams', d.registries?.graft?.postGraftExams ?? 0);
      setText('raRejections', d.registries?.graft?.rejectionEpisodes ?? 0);

      const surv = await api('/api/v1/research-analytics/graft-survival');
      const s = surv?.data || {};
      setText('raGraftSurvival', s.survivalRateOverall != null ? `${s.survivalRateOverall}%` : '—');
      setText('raGraftFailed', s.failedGrafts ?? 0);
      renderSurvivalCurve(s.curve);
    } catch (err) {
      console.warn('[Research] Overview load failed:', err);
    }
  }

  async function loadCohort(type) {
    const select = document.getElementById('raCohortSelect');
    if (select) select.value = type;
    if (!apiOn()) {
      renderCohortTable([]);
      return;
    }
    try {
      const res = await api(`/api/v1/research-analytics/cohort/${encodeURIComponent(type)}?limit=200`);
      renderCohortTable(res?.data || []);
    } catch (err) {
      console.warn('[Research] Cohort load failed:', err);
      renderCohortTable([]);
    }
  }

  global.CorneaResearchAnalytics = {
    COHORTS,
    async init() {
      const select = document.getElementById('raCohortSelect');
      if (select && !select.options.length) {
        COHORTS.forEach((c) => {
          const o = document.createElement('option');
          o.value = c.id;
          o.textContent = c.label;
          select.appendChild(o);
        });
      }
      await loadOverview();
      const cohort = select?.value || 'kc';
      await loadCohort(cohort);
    },
    async refreshCohort() {
      const type = document.getElementById('raCohortSelect')?.value || 'kc';
      await loadCohort(type);
    },
    async exportCohort() {
      if (!apiOn()) { alert('Cloud sign-in required to export cohorts.'); return; }
      const type = document.getElementById('raCohortSelect')?.value || 'kc';
      try {
        const blob = await global.CorneaApi.downloadBlob(
          `/api/v1/research-analytics/cohort/${encodeURIComponent(type)}/export.csv`
        );
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cornea-cohort-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        alert(err.message || 'Export failed');
      }
    }
  };

  global.initResearchTab = () => global.CorneaResearchAnalytics.init();
})(typeof window !== 'undefined' ? window : globalThis);
