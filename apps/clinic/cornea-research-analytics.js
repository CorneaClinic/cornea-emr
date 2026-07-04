/**
 * Research analytics dashboard — registry summaries, cohort export, graft survival (Project 6)
 * P2: offline summaries from IndexedDB + last cloud cache when API unavailable.
 */
(function (global) {
  'use strict';

  const COHORTS = [
    { id: 'kc', label: 'KC registry patients' },
    { id: 'cxl', label: 'CXL procedures' },
    { id: 'keratitis', label: 'Keratitis / ulcer cases' },
    { id: 'kp', label: 'Keratoplasty patients' },
    { id: 'kp-graft', label: 'Post-graft outcomes' },
    { id: 'contact-lens', label: 'Contact lens fitting outcomes' }
  ];

  const CACHE_KEY = 'corneaEmr_researchCache';
  const STORE_KC = 'kcPatients';
  const STORE_CXL = 'kcCxlProcedures';
  const STORE_UK = 'keratitisCases';
  const STORE_KP = 'kpPatients';
  const STORE_EXAMS = 'kpGraftExams';
  const STORE_REJECTIONS = 'kpRejections';
  const STORE_PATIENTS = 'patients';

  let _lastSource = 'empty';
  let _lastCohortRows = [];

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

  function idbGetAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeCache(patch) {
    try {
      const prev = readCache() || { cohorts: {} };
      const next = {
        overview: patch.overview != null ? patch.overview : prev.overview,
        graftSurvival: patch.graftSurvival != null ? patch.graftSurvival : prev.graftSurvival,
        cohorts: { ...prev.cohorts, ...(patch.cohorts || {}) }
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('[Research] Cache write failed:', err);
    }
  }

  function formatAsOf(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function setSourceBadge(source, asOf) {
    _lastSource = source;
    const badge = document.getElementById('raSourceBadge');
    const hint = document.getElementById('raCloudHint');
    if (!badge) return;

    const labels = {
      live: 'Live institute data from cloud',
      cached: `Offline — last cloud sync ${formatAsOf(asOf)}`,
      local: 'Local device — summaries from registry data on this browser',
      empty: ''
    };

    if (source === 'empty') {
      badge.setAttribute('hidden', 'hidden');
      badge.textContent = '';
      if (hint && !apiOn()) hint.hidden = false;
      return;
    }

    badge.textContent = labels[source] || labels.local;
    badge.removeAttribute('hidden');
    if (hint) hint.hidden = true;
  }

  function monthsBetween(start, end) {
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  function buildGraftSurvivalCurve(patients) {
    const checkpoints = [1, 3, 6, 12, 24, 36];
    const today = new Date();
    return checkpoints.map((month) => {
      const eligible = patients.filter((p) => p.followUpMonths >= month || p.failed);
      const atRisk = eligible.length;
      const survived = eligible.filter((p) => !p.failed || p.followUpMonths >= month).length;
      const survivalRate = atRisk ? Math.round((survived / atRisk) * 1000) / 10 : null;
      return { monthsPostOp: month, atRisk, survived, survivalRate };
    });
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

  function summarizeLocalContactLens(raw) {
    let p;
    try {
      p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    const fit = p?.fit || {};
    const sharedSel = fit.lensSelection?.shared || {};
    const sharedRx = fit.finalRx?.shared || {};
    const rxParts = (eye) => ['baseCurve', 'power', 'diameter', 'brand']
      .map((k) => eye?.[k])
      .filter((v) => String(v ?? '').trim())
      .join(' / ');
    const checklist = fit.dispensing?.checklist || [];
    const solutions = fit.dispensing?.solutions || [];
    return {
      indications: (fit.indication || []).join('; ') || '—',
      lensType: sharedRx.lensType || sharedSel.lensType || '—',
      finalRxOd: rxParts(fit.finalRx?.od) || '—',
      finalRxOs: rxParts(fit.finalRx?.os) || '—',
      complications: (fit.complications || []).join('; ') || '—',
      dispensingDocumented: checklist.length > 0 || solutions.length > 0 ? 'Yes' : 'No'
    };
  }

  function renderCohortTable(rows) {
    const body = document.getElementById('raCohortBody');
    const head = document.getElementById('raCohortHead');
    if (!body) return;
    _lastCohortRows = rows || [];
    if (!rows?.length) {
      if (head) head.innerHTML = '';
      body.innerHTML = '<tr><td colspan="8" class="text-muted">No records in this cohort yet.</td></tr>';
      return;
    }
    const keys = Object.keys(rows[0]).slice(0, 8);
    if (head) head.innerHTML = `<tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr>`;
    body.innerHTML = rows.slice(0, 100).map((r) => `<tr>${keys.map((k) => `<td>${r[k] ?? '—'}</td>`).join('')}</tr>`).join('');
  }

  function renderOverviewFromData(d) {
    setText('raKcTotal', d.registries?.kc?.patients?.total ?? 0);
    setText('raKcProgression', d.registries?.kc?.patients?.progression_confirmed ?? 0);
    setText('raCxlTotal', d.registries?.kc?.cxl?.total ?? 0);
    setText('raUkTotal', d.registries?.keratitis?.total ?? 0);
    setText('raUkResolved', d.registries?.keratitis?.resolved ?? 0);
    setText('raKpCompleted', d.registries?.keratoplasty?.completed ?? 0);
    setText('raClFits', d.registries?.contactLens?.visitCount ?? 0);
    setText('raClPatients', d.registries?.contactLens?.uniquePatients ?? 0);
    setText('raGraftExams', d.registries?.graft?.postGraftExams ?? 0);
    setText('raRejections', d.registries?.graft?.rejectionEpisodes ?? 0);
  }

  function renderGraftSurvivalFromData(s) {
    setText('raGraftSurvival', s.survivalRateOverall != null ? `${s.survivalRateOverall}%` : '—');
    setText('raGraftFailed', s.failedGrafts ?? 0);
    renderSurvivalCurve(s.curve);
  }

  async function buildLocalOverview() {
    const [kc, cxl, uk, kp, exams, rejections, patients] = await Promise.all([
      idbGetAll(STORE_KC),
      idbGetAll(STORE_CXL),
      idbGetAll(STORE_UK),
      idbGetAll(STORE_KP),
      idbGetAll(STORE_EXAMS),
      idbGetAll(STORE_REJECTIONS),
      idbGetAll(STORE_PATIENTS)
    ]);

    const clVisits = patients.filter((p) => hasContactLensData(p.contactLensJSON));
    const clPatientKeys = new Set(clVisits.map((p) => p.patientId || p.mrn || p.id));

    return {
      generatedAt: new Date().toISOString(),
      registries: {
        kc: {
          patients: {
            total: kc.length,
            progression_confirmed: kc.filter((p) => /Confirmed/i.test(p.kcProgressionStatus || '')).length
          },
          cxl: { total: cxl.length }
        },
        keratitis: {
          total: uk.length,
          resolved: uk.filter((c) => c.ukStatus === 'Resolved').length
        },
        keratoplasty: {
          completed: kp.filter((p) => p.kpStatus === 'Completed').length
        },
        graft: {
          postGraftExams: exams.length,
          rejectionEpisodes: rejections.length
        },
        contactLens: {
          visitCount: clVisits.length,
          uniquePatients: clPatientKeys.size
        }
      }
    };
  }

  async function buildLocalGraftSurvival() {
    const [kp, exams, rejections] = await Promise.all([
      idbGetAll(STORE_KP),
      idbGetAll(STORE_EXAMS),
      idbGetAll(STORE_REJECTIONS)
    ]);

    const today = new Date();
    const completed = kp.filter((p) => p.kpStatus === 'Completed' && p.kpSurgeryDate);

    const patients = completed.map((p) => {
      const patientRejs = rejections.filter((r) => r.kpPatientId === p.id);
      const failed = patientRejs.some((r) => /fail|graft loss|failed/i.test(String(r.kpRejOutcome || '')));
      const patientExams = exams.filter((e) => e.kpPatientId === p.id);
      const lastExam = patientExams
        .map((e) => e.kpExamDate)
        .filter(Boolean)
        .sort()
        .pop();
      const endDate = failed ? (lastExam || p.lastModified || today) : today;
      return {
        failed,
        followUpMonths: monthsBetween(p.kpSurgeryDate, endDate) ?? 0
      };
    });

    const total = patients.length;
    const failed = patients.filter((p) => p.failed).length;
    const curve = buildGraftSurvivalCurve(patients);

    return {
      totalGrafts: total,
      failedGrafts: failed,
      survivalRateOverall: total ? Math.round(((total - failed) / total) * 1000) / 10 : null,
      curve
    };
  }

  async function buildLocalCohort(type) {
    const [kc, cxl, uk, kp, exams, rejections] = await Promise.all([
      idbGetAll(STORE_KC),
      idbGetAll(STORE_CXL),
      idbGetAll(STORE_UK),
      idbGetAll(STORE_KP),
      idbGetAll(STORE_EXAMS),
      idbGetAll(STORE_REJECTIONS)
    ]);

    if (type === 'kc') {
      return kc.map((r) => ({
        id: r.kcRegistryId,
        fullName: r.kcFullName,
        eye: r.kcEyeInvolvement,
        status: r.kcStatus,
        progressionStatus: r.kcProgressionStatus,
        indexDate: r.kcIndexDate,
        emrMrn: r.kcEmrPatientMrn
      }));
    }

    if (type === 'cxl') {
      return cxl.map((c) => {
        const p = kc.find((x) => x.id === c.kcPatientId);
        return {
          id: c.id,
          kcPatientId: p?.kcRegistryId,
          fullName: p?.kcFullName,
          eye: c.kcCxlEye,
          procedureDate: c.kcCxlProcedureDate,
          epiType: c.kcCxlEpiType,
          energyJcm2: c.kcCxlUvEnergy,
          outcome: c.kcCxlOutcome
        };
      });
    }

    if (type === 'keratitis') {
      return uk.map((r) => ({
        caseId: r.ukCaseId,
        fullName: r.ukFullName,
        eye: r.ukEye,
        etiology: r.ukEtiology,
        status: r.ukStatus,
        presentationDate: r.ukPresentationDate,
        contactLens: r.ukContactLens,
        emrMrn: r.ukEmrMrn
      }));
    }

    if (type === 'kp') {
      return kp.map((r) => ({
        kpPatientId: r.kpPatientId,
        fullName: r.kpFullName,
        eye: r.kpEye,
        procedure: r.kpProcedure,
        status: r.kpStatus,
        surgeryDate: r.kpSurgeryDate,
        graftOutcome: r.kpGraftOutcome || '—'
      }));
    }

    if (type === 'contact-lens') {
      const patients = await idbGetAll(STORE_PATIENTS);
      return patients
        .filter((p) => hasContactLensData(p.contactLensJSON))
        .map((p) => {
          const summary = summarizeLocalContactLens(p.contactLensJSON) || {};
          return {
            visitDate: p.visitDate || p.date || '—',
            mrn: p.mrn || p.patientId || '—',
            fullName: p.fullName || p.name || '—',
            ...summary
          };
        })
        .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    }

    return kp
      .filter((p) => p.kpStatus === 'Completed')
      .map((p) => {
        const patientExams = exams.filter((e) => e.kpPatientId === p.id);
        const latestEcd = patientExams
          .map((e) => Number(e.kpExamEcd))
          .filter((n) => !Number.isNaN(n))
          .sort((a, b) => b - a)[0];
        return {
          kpPatientId: p.kpPatientId,
          fullName: p.kpFullName,
          eye: p.kpEye,
          procedure: p.kpProcedure,
          surgeryDate: p.kpSurgeryDate,
          graftOutcome: p.kpGraftOutcome || '—',
          examCount: patientExams.length,
          latestEcd: latestEcd ?? '—',
          rejectionCount: rejections.filter((r) => r.kpPatientId === p.id).length
        };
      });
  }

  function hasLocalRegistryData(overview) {
    const r = overview?.registries;
    if (!r) return false;
    return (
      (r.kc?.patients?.total || 0) > 0
      || (r.keratitis?.total || 0) > 0
      || (r.keratoplasty?.completed || 0) > 0
      || (r.graft?.postGraftExams || 0) > 0
    );
  }

  async function loadOverview() {
    const cache = readCache();
    const online = global.navigator.onLine !== false;

    if (apiOn() && online) {
      try {
        const res = await api('/api/v1/research-analytics/overview');
        const d = res?.data || {};
        const survRes = await api('/api/v1/research-analytics/graft-survival');
        const s = survRes?.data || {};
        const cachedAt = new Date().toISOString();

        writeCache({
          overview: { data: d, cachedAt },
          graftSurvival: { data: s, cachedAt }
        });

        renderOverviewFromData(d);
        renderGraftSurvivalFromData(s);
        setSourceBadge('live', d.generatedAt || cachedAt);
        return;
      } catch (err) {
        console.warn('[Research] Cloud overview failed:', err);
      }
    }

    if (cache?.overview?.data) {
      renderOverviewFromData(cache.overview.data);
      if (cache.graftSurvival?.data) {
        renderGraftSurvivalFromData(cache.graftSurvival.data);
      } else {
        renderGraftSurvivalFromData({ failedGrafts: 0, survivalRateOverall: null, curve: [] });
      }
      setSourceBadge('cached', cache.overview.cachedAt);
      return;
    }

    const localOverview = await buildLocalOverview();
    const localSurvival = await buildLocalGraftSurvival();
    renderOverviewFromData(localOverview);
    renderGraftSurvivalFromData(localSurvival);

    if (hasLocalRegistryData(localOverview)) {
      setSourceBadge('local', localOverview.generatedAt);
    } else {
      setSourceBadge('empty');
      setText('raKcTotal', '—');
      setText('raKcProgression', '—');
      setText('raCxlTotal', '—');
      setText('raUkTotal', '—');
      setText('raUkResolved', '—');
      setText('raKpCompleted', '—');
      setText('raClFits', '—');
      setText('raClPatients', '—');
      setText('raGraftExams', '—');
      setText('raRejections', '—');
      setText('raGraftSurvival', '—');
      setText('raGraftFailed', '—');
      renderSurvivalCurve([]);
    }
  }

  async function loadCohort(type) {
    const select = document.getElementById('raCohortSelect');
    if (select) select.value = type;

    const cache = readCache();
    const online = global.navigator.onLine !== false;

    if (apiOn() && online) {
      try {
        const res = await api(`/api/v1/research-analytics/cohort/${encodeURIComponent(type)}?limit=200`);
        const rows = res?.data || [];
        writeCache({ cohorts: { [type]: { rows, cachedAt: new Date().toISOString() } } });
        renderCohortTable(rows);
        return;
      } catch (err) {
        console.warn('[Research] Cohort load failed:', err);
      }
    }

    if (cache?.cohorts?.[type]?.rows) {
      renderCohortTable(cache.cohorts[type].rows);
      return;
    }

    const rows = await buildLocalCohort(type);
    renderCohortTable(rows);
  }

  function csvEscape(val) {
    if (val == null) return '';
    const s = String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function rowsToCsv(rows) {
    if (!rows?.length) return 'message\r\nNo records in this cohort';
    const headers = Object.keys(rows[0]);
    const lines = [headers.map(csvEscape).join(',')];
    rows.forEach((row) => {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    });
    return lines.join('\r\n');
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
      const type = document.getElementById('raCohortSelect')?.value || 'kc';
      const online = global.navigator.onLine !== false;

      if (apiOn() && online) {
        try {
          const blob = await global.CorneaApi.downloadBlob(
            `/api/v1/research-analytics/cohort/${encodeURIComponent(type)}/export.csv`
          );
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `cornea-cohort-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
          return;
        } catch (err) {
          console.warn('[Research] Cloud export failed, trying offline:', err);
        }
      }

      let rows = _lastCohortRows;
      if (!rows?.length) {
        const cache = readCache();
        rows = cache?.cohorts?.[type]?.rows;
      }
      if (!rows?.length) {
        rows = await buildLocalCohort(type);
      }
      if (!rows?.length) {
        alert('No cohort data to export. Sign in to cloud or add registry records locally.');
        return;
      }

      const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cornea-cohort-${type}-${_lastSource === 'cached' ? 'cached-' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    async exportCohortFhir() {
      if (!apiOn()) {
        alert('Cloud sign-in required to export FHIR bundles from the server.');
        return;
      }
      if (global.navigator.onLine === false) {
        alert('FHIR export requires an internet connection.');
        return;
      }
      const type = document.getElementById('raCohortSelect')?.value || 'kc';
      try {
        const blob = await global.CorneaApi.downloadBlob(
          `/api/v1/fhir-export/cohort/${encodeURIComponent(type)}/bundle?anonymize=true`
        );
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cornea-fhir-cohort-${type}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        alert(err.message || 'FHIR export failed');
      }
    }
  };

  global.initResearchTab = () => global.CorneaResearchAnalytics.init();
})(typeof window !== 'undefined' ? window : globalThis);
