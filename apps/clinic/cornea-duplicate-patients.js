/**
 * Cornea Clinic — duplicate patient detection at registration (Project 2)
 * Cloud: POST /api/v1/patients/duplicates/check
 * Offline: scan local IndexedDB visit records
 */
(function duplicatePatientsModule(global) {
  'use strict';

  const REASON_LABELS = {
    existing_patient: 'Registered patient — new visit will be added',
    national_id_cross_mrn: 'National ID registered under a different patient ID',
    national_id_match: 'National ID on file for this patient',
    phone_match: 'Same phone number',
    sex_match: 'Same sex',
    dob_match: 'Same date of birth',
    dob_year_close: 'Similar age / birth year',
    name_very_similar: 'Very similar name',
    name_similar: 'Similar name',
    name_partial: 'Partial name match',
    phone_name_combo: 'Phone + name match',
    dob_name_combo: 'DOB + name match',
    demographics_name_combo: 'Demographics + name match'
  };

  let debounceTimer = null;
  let lastCheckKey = '';
  let lastResult = null;
  let userConfirmedNew = false;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    return digits.length <= 10 ? digits : digits.slice(-10);
  }

  function normalizeName(name) {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|miss|dr|prof)\.?\s+/gi, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function nameSimilarity(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const ta = na.split(' ').filter(Boolean);
    const tb = nb.split(' ').filter(Boolean);
    const setA = new Set(ta);
    let inter = 0;
    for (const t of setA) if (new Set(tb).has(t)) inter += 1;
    const union = new Set([...ta, ...tb]).size;
    return union ? inter / union : 0;
  }

  function ageToApproxDob(age, ageUnit) {
    const num = Number(age);
    if (!Number.isFinite(num) || num < 0) return null;
    const unit = String(ageUnit || 'years').toLowerCase();
    let years = num;
    if (unit === 'months') years = num / 12;
    else if (unit === 'days') years = num / 365.25;
    const d = new Date();
    d.setFullYear(d.getFullYear() - Math.round(years));
    return d.toISOString().slice(0, 10);
  }

  function scoreLocalMatch(candidate, row) {
    const reasons = [];
    let score = 0;
    let severity = 'low';

    const candMrn = String(candidate.mrn || '').trim();
    const rowMrn = String(row.patientId || row.mrn || '').trim();
    if (candMrn && rowMrn && candMrn === rowMrn) {
      return { score: 100, severity: 'info', reasons: ['existing_patient'] };
    }

    const candNational = String(candidate.nationalId || '').trim();
    const rowNational = String(row.nationalId || '').trim();
    if (candNational && rowNational && candNational === rowNational) {
      if (candMrn && rowMrn && candMrn !== rowMrn) {
        return { score: 100, severity: 'block', reasons: ['national_id_cross_mrn'] };
      }
      return { score: 95, severity: 'info', reasons: ['national_id_match'] };
    }

    const cp = normalizePhone(candidate.phone);
    const rp = normalizePhone(row.phone);
    if (cp && rp && cp.length >= 7 && cp === rp) {
      reasons.push('phone_match');
      score += 35;
    }

    const cs = candidate.sex || '';
    const rs = row.sex || '';
    if (cs && rs && cs === rs) {
      reasons.push('sex_match');
      score += 10;
    }

    const candDob = candidate.dob || ageToApproxDob(candidate.age, candidate.ageUnit);
    const rowDob = row.dob || ageToApproxDob(row.age, row.ageUnit);
    if (candDob && rowDob && String(candDob).slice(0, 10) === String(rowDob).slice(0, 10)) {
      reasons.push('dob_match');
      score += 30;
    }

    const sim = nameSimilarity(candidate.fullName, row.fullName);
    if (sim >= 0.85) {
      reasons.push('name_very_similar');
      score += 40;
    } else if (sim >= 0.65) {
      reasons.push('name_similar');
      score += 25;
    } else if (sim >= 0.45) {
      reasons.push('name_partial');
      score += 10;
    }

    if (reasons.includes('phone_match') && sim >= 0.65) score += 15;
    if (reasons.includes('dob_match') && sim >= 0.65) score += 15;

    score = Math.min(99, score);
    if (score >= 75) severity = 'high';
    else if (score >= 50) severity = 'medium';
    else if (score >= 30) severity = 'low';
    else severity = 'none';

    return { score, severity, reasons, nameSimilarity: sim };
  }

  function collectCandidateFromForm() {
    const sexEl = document.querySelector('input[name="sex"]:checked');
    return {
      mrn: document.getElementById('patientId')?.value?.trim() || '',
      fullName: document.getElementById('fullName')?.value?.trim() || '',
      phone: document.getElementById('phone')?.value?.trim() || '',
      nationalId: document.getElementById('nationalId')?.value?.trim() || '',
      sex: sexEl?.value || '',
      age: document.getElementById('ageValue')?.value?.trim() || '',
      ageUnit: document.getElementById('ageUnit')?.value || 'years',
      dob: document.getElementById('dob')?.value?.trim() || ''
    };
  }

  function candidateKey(c) {
    return [c.mrn, c.fullName, c.phone, c.nationalId, c.sex, c.age, c.ageUnit].join('|');
  }

  async function findLocalDuplicates(candidate) {
    if (!global.db || typeof global.STORE_NAME === 'undefined') {
      return { matches: [], hasBlocker: false, highestSeverity: 'none' };
    }

    const rows = await new Promise((resolve, reject) => {
      const req = global.db.transaction([global.STORE_NAME], 'readonly')
        .objectStore(global.STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const currentId = document.getElementById('currentRecordId')?.value;
    const byPatient = new Map();
    for (const row of rows) {
      if (currentId && String(row.id) === String(currentId)) continue;
      const pid = String(row.patientId || '').trim();
      if (!pid) continue;
      const existing = byPatient.get(pid);
      if (!existing || (row.visitDate || '') > (existing.visitDate || '')) {
        byPatient.set(pid, row);
      }
    }

    const matches = [];
    for (const row of byPatient.values()) {
      const match = scoreLocalMatch(candidate, row);
      if (match.severity === 'none') continue;
      matches.push({
        patient: {
          id: row.uuid || row.patientId,
          mrn: row.patientId,
          fullName: row.fullName,
          phone: row.phone,
          sex: row.sex,
          nationalId: row.nationalId
        },
        visitCount: rows.filter((r) => String(r.patientId) === String(row.patientId)).length,
        score: match.score,
        severity: match.severity,
        reasons: match.reasons,
        localRecordId: row.id
      });
    }

    matches.sort((a, b) => b.score - a.score || b.visitCount - a.visitCount);
    return {
      matches,
      hasBlocker: matches.some((m) => m.severity === 'block'),
      highestSeverity: matches[0]?.severity || 'none'
    };
  }

  async function findCloudDuplicates(candidate) {
    if (!global.CorneaApi?.request) {
      return findLocalDuplicates(candidate);
    }
    const res = await global.CorneaApi.request('/api/v1/patients/duplicates/check', {
      method: 'POST',
      body: JSON.stringify(candidate)
    });
    return res?.data || { matches: [], hasBlocker: false, highestSeverity: 'none' };
  }

  function severityClass(sev) {
    if (sev === 'block') return 'dup-severity-block';
    if (sev === 'high') return 'dup-severity-high';
    if (sev === 'info') return 'dup-severity-info';
    if (sev === 'medium') return 'dup-severity-medium';
    return 'dup-severity-low';
  }

  function renderPanel(result) {
    const panel = document.getElementById('duplicatePatientPanel');
    if (!panel) return;

    lastResult = result;
    userConfirmedNew = false;
    const confirmWrap = document.getElementById('duplicateConfirmWrap');
    if (confirmWrap) confirmWrap.hidden = true;

    if (!result?.matches?.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    panel.hidden = false;
    const blocker = result.hasBlocker;
    const high = result.highestSeverity === 'high';

    const items = result.matches.slice(0, 5).map((m) => {
      const p = m.patient || {};
      const reasonText = (m.reasons || [])
        .map((r) => REASON_LABELS[r] || r)
        .join(' · ');
      const openBtn = m.localRecordId
        ? `<button type="button" class="btn-secondary btn-sm dup-open-btn" data-local-id="${m.localRecordId}">Open record</button>`
        : (p.mrn
          ? `<button type="button" class="btn-secondary btn-sm dup-open-btn" data-mrn="${escapeHtml(p.mrn)}">View patient</button>`
          : '');
      return `
        <li class="duplicate-match-item ${severityClass(m.severity)}">
          <div class="duplicate-match-head">
            <strong>${escapeHtml(p.fullName || 'Unknown')}</strong>
            <span class="duplicate-score">${m.score}% match</span>
          </div>
          <div class="duplicate-match-meta">
            ID: ${escapeHtml(p.mrn || '—')}
            ${p.phone ? ` · ${escapeHtml(p.phone)}` : ''}
            ${m.visitCount ? ` · ${m.visitCount} visit(s)` : ''}
          </div>
          <div class="duplicate-match-reasons">${escapeHtml(reasonText)}</div>
          <div class="duplicate-match-actions">${openBtn}</div>
        </li>`;
    }).join('');

    panel.innerHTML = `
      <div class="duplicate-panel-header ${blocker ? 'is-blocker' : high ? 'is-high' : result.matches.every((m) => m.severity === 'info') ? 'is-info' : ''}">
        <i class="fa-solid ${blocker ? 'fa-triangle-exclamation' : 'fa-circle-info'}" aria-hidden="true"></i>
        <div>
          <strong>${blocker
            ? 'Duplicate national ID under different patient ID'
            : result.matches.every((m) => m.severity === 'info')
              ? 'Existing patient on file'
              : `Possible duplicate patient${result.matches.length > 1 ? 's' : ''} found`}</strong>
          <p>${blocker
            ? 'This national ID belongs to another patient record. Open that record or correct the ID before saving.'
            : result.matches.every((m) => m.severity === 'info')
              ? 'This patient is already registered. Saving will add a new visit to their chart.'
              : high
                ? 'Strong match on name and demographics. Review before creating a new record.'
                : 'Review similar records before registering.'}</p>
        </div>
      </div>
      <ul class="duplicate-match-list">${items}</ul>
      ${(blocker || high) ? `
        <label class="duplicate-confirm-label" id="duplicateConfirmWrap">
          <input type="checkbox" id="duplicateConfirmCheckbox" />
          I confirm this is a distinct patient (not a duplicate)
        </label>` : ''}
    `;

    panel.querySelectorAll('.dup-open-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.localId) {
          global.closeEmrModal?.('emrPatientModal');
          global.editRecord?.(parseInt(btn.dataset.localId, 10));
          return;
        }
        const mrn = btn.dataset.mrn;
        if (mrn && global.loadPatientVisits) {
          document.getElementById('patientId').value = mrn;
          global.refreshPatientVisitHistory?.();
        }
      });
    });

    const cb = document.getElementById('duplicateConfirmCheckbox');
    cb?.addEventListener('change', () => {
      userConfirmedNew = cb.checked;
    });
  }

  async function runCheck() {
    const candidate = collectCandidateFromForm();
    if (!candidate.mrn && !candidate.fullName && !candidate.phone && !candidate.nationalId) {
      renderPanel({ matches: [], hasBlocker: false, highestSeverity: 'none' });
      return;
    }

    const key = candidateKey(candidate);
    if (key === lastCheckKey && lastResult) {
      renderPanel(lastResult);
      return;
    }
    lastCheckKey = key;

    try {
      const result = global.CorneaApi?.request
        ? await findCloudDuplicates(candidate)
        : await findLocalDuplicates(candidate);
      renderPanel(result);
    } catch (err) {
      const panel = document.getElementById('duplicatePatientPanel');
      if (panel) {
        panel.hidden = false;
        panel.innerHTML = `<p class="duplicate-panel-error">Duplicate check unavailable: ${escapeHtml(err.message || err)}</p>`;
      }
    }
  }

  function scheduleCheck() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runCheck, 500);
  }

  function bindFormListeners() {
    const ids = ['patientId', 'fullName', 'phone', 'nationalId', 'ageValue', 'ageUnit'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || el.dataset.dupBound) continue;
      el.dataset.dupBound = '1';
      el.addEventListener('input', scheduleCheck);
      el.addEventListener('change', scheduleCheck);
    }
    document.querySelectorAll('input[name="sex"]').forEach((el) => {
      if (el.dataset.dupBound) return;
      el.dataset.dupBound = '1';
      el.addEventListener('change', scheduleCheck);
    });
  }

  function resetPanel() {
    lastCheckKey = '';
    lastResult = null;
    userConfirmedNew = false;
    renderPanel({ matches: [], hasBlocker: false, highestSeverity: 'none' });
  }

  /**
   * Call before save on new patient visits. Returns true if save may proceed.
   */
  async function checkBeforeSave() {
    const currentId = document.getElementById('currentRecordId')?.value;
    if (currentId) return true;

    await runCheck();
    if (!lastResult?.matches?.length) return true;

    if (lastResult.hasBlocker && !userConfirmedNew) {
      alert('This national ID is already registered under a different patient ID. Open the existing record or correct the national ID.');
      document.getElementById('duplicatePatientPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return false;
    }

    if (lastResult.highestSeverity === 'high' && !userConfirmedNew) {
      const ok = confirm(
        'Possible duplicate patient detected (strong name/demographics match).\n\n' +
        'Click OK only if you are sure this is a new distinct patient.'
      );
      if (!ok) return false;
      userConfirmedNew = true;
    }

    return true;
  }

  async function mergePatients(targetPatientId, sourcePatientId, keepMrn) {
    if (!global.CorneaApi?.request) {
      throw new Error('Patient merge requires cloud sign-in');
    }
    const body = { targetPatientId, sourcePatientId, confirm: true };
    if (keepMrn) body.keepMrn = keepMrn;
    const res = await global.CorneaApi.request('/api/v1/patients/merge', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    resetPanel();
    return res?.data;
  }

  function init() {
    bindFormListeners();
    const modal = document.getElementById('emrPatientModal');
    if (modal && !modal.dataset.dupInit) {
      modal.dataset.dupInit = '1';
      const observer = new MutationObserver(() => {
        if (modal.getAttribute('aria-hidden') === 'false') {
          bindFormListeners();
          scheduleCheck();
        } else {
          resetPanel();
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
  }

  global.CorneaDuplicatePatients = {
    init,
    resetPanel,
    scheduleCheck,
    checkBeforeSave,
    mergePatients,
    findLocalDuplicates,
    scoreLocalMatch
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
