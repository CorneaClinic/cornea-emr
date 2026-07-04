/**
 * Mobile-optimized visit summary — bottom sheet + compact print (backlog B2)
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function trimVal(v) {
    const t = String(v ?? '').trim();
    return t || '';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).includes('T') ? iso : `${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function parseMedRows(jsonStr) {
    try {
      const arr = JSON.parse(jsonStr || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.filter((r) => r.drugName || r.eye || r.instruction);
    } catch {
      return [];
    }
  }

  function vaForEye(data, side) {
    const bcva = trimVal(data[`vision${side}BCVA`]);
    const ucva = trimVal(data[`vision${side}UCVA`]);
    if (bcva && ucva) return `${bcva} (BCVA) / ${ucva} (UCVA)`;
    return bcva || ucva || '';
  }

  function contactLensSnippet(raw) {
    if (!raw || raw === '{}') return null;
    try {
      const st = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const ind = (st.fit?.indication || []).join(', ');
      const od = st.fit?.finalRx?.od || {};
      const os = st.fit?.finalRx?.os || {};
      const fmt = (eye) => [eye.lensType, eye.power, eye.baseCurve].filter(Boolean).join(' · ');
      if (!ind && !fmt(od) && !fmt(os)) return null;
      return { indication: ind, od: fmt(od), os: fmt(os) };
    } catch {
      return null;
    }
  }

  function buildSummaryModel(data) {
    if (!data) return null;
    const age = trimVal(data.age ?? data.ageValue);
    const sex = trimVal(data.sex);
    const ageSex = [age ? `${age}y` : '', sex].filter(Boolean).join(' · ') || '—';

    return {
      patientId: trimVal(data.patientId) || '—',
      fullName: trimVal(data.fullName) || '—',
      visitDate: formatDate(data.visitDate),
      ageSex,
      phone: trimVal(data.phone),
      chiefComplaint: trimVal(data.chiefComplaint),
      durationSymptoms: trimVal(data.durationSymptoms),
      diagnosis: trimVal(data.diagnosis),
      vaRe: vaForEye(data, 'RE') || '—',
      vaLe: vaForEye(data, 'LE') || '—',
      iopRe: trimVal(data.iopRE),
      iopLe: trimVal(data.iopLE),
      corneaRe: trimVal(data.corneaRE),
      corneaLe: trimVal(data.corneaLE),
      lensRe: trimVal(data.lensRE),
      lensLe: trimVal(data.lensLE),
      advise: trimVal(data.advise),
      specialRemarks: trimVal(data.specialRemarks),
      followUpDate: data.followUpDate ? formatDate(data.followUpDate) : '',
      followUpPlace: trimVal(data.followUpPlace),
      followUpPurpose: trimVal(data.followUpPurpose),
      medications: parseMedRows(data.medicalAdviceJSON),
      contactLens: contactLensSnippet(data.contactLensJSON)
    };
  }

  function collectFromForm() {
    if (typeof global.collectFormDataObject === 'function') {
      global.syncMedicalAdviceJSON?.();
      global.CorneaContactLens?.syncToHiddenField?.();
      return buildSummaryModel(global.collectFormDataObject());
    }
    return null;
  }

  function card(title, icon, bodyHtml) {
    if (!bodyHtml) return '';
    return `
      <section class="mvs-card">
        <header class="mvs-card-head"><span class="mvs-card-icon">${icon}</span><h3>${esc(title)}</h3></header>
        <div class="mvs-card-body">${bodyHtml}</div>
      </section>`;
  }

  function row(label, value) {
    const v = trimVal(value);
    if (!v || v === '—') return '';
    return `<div class="mvs-row"><span class="mvs-label">${esc(label)}</span><span class="mvs-value">${esc(v)}</span></div>`;
  }

  function buildSheetHtml(model) {
    if (!model) {
      return '<p class="mvs-empty">No visit data to summarize. Open a patient visit first.</p>';
    }

    const vitals = `
      <div class="mvs-vitals">
        <div class="mvs-vital"><span class="mvs-vital-lbl">VA RE</span><span class="mvs-vital-val">${esc(model.vaRe)}</span></div>
        <div class="mvs-vital"><span class="mvs-vital-lbl">VA LE</span><span class="mvs-vital-val">${esc(model.vaLe)}</span></div>
        <div class="mvs-vital"><span class="mvs-vital-lbl">IOP RE</span><span class="mvs-vital-val">${esc(model.iopRe || '—')}${model.iopRe ? ' mmHg' : ''}</span></div>
        <div class="mvs-vital"><span class="mvs-vital-lbl">IOP LE</span><span class="mvs-vital-val">${esc(model.iopLe || '—')}${model.iopLe ? ' mmHg' : ''}</span></div>
      </div>`;

    const exam = [
      model.corneaRe || model.corneaLe
        ? row('Cornea RE', model.corneaRe || '—') + row('Cornea LE', model.corneaLe || '—')
        : '',
      model.lensRe || model.lensLe
        ? row('Lens RE', model.lensRe || '—') + row('Lens LE', model.lensLe || '—')
        : ''
    ].join('');

    const meds = model.medications.length
      ? model.medications.map((m, i) => `
          <div class="mvs-med">
            <span class="mvs-med-num">${i + 1}</span>
            <div>
              <strong>${esc(m.drugName || 'Medication')}</strong>
              ${m.eye ? `<span class="mvs-med-eye">${esc(m.eye)}</span>` : ''}
              <p class="mvs-med-detail">${esc([m.frequency, m.duration, m.route].filter(Boolean).join(' · '))}</p>
              ${m.instruction ? `<p class="mvs-med-inst">${esc(m.instruction)}</p>` : ''}
            </div>
          </div>`).join('')
      : '';

    const follow = [
      model.followUpDate ? row('Follow-up date', model.followUpDate + (model.followUpPlace ? ` @ ${model.followUpPlace}` : '')) : '',
      row('Purpose', model.followUpPurpose)
    ].join('');

    const cl = model.contactLens
      ? row('Indication', model.contactLens.indication)
        + row('CL OD', model.contactLens.od || '—')
        + row('CL OS', model.contactLens.os || '—')
      : '';

    return `
      <header class="mvs-header">
        <p class="mvs-clinic">Cornea Clinic</p>
        <h2 class="mvs-patient">${esc(model.fullName)}</h2>
        <p class="mvs-meta">${esc(model.patientId)} · ${esc(model.visitDate)} · ${esc(model.ageSex)}</p>
        ${model.phone ? `<p class="mvs-meta">${esc(model.phone)}</p>` : ''}
      </header>
      ${model.diagnosis ? `<div class="mvs-diagnosis"><span>Diagnosis</span><strong>${esc(model.diagnosis)}</strong></div>` : ''}
      ${card('Presenting complaint', '📋', row('Chief complaint', model.chiefComplaint) + row('Duration', model.durationSymptoms))}
      ${card('Key findings', '👁️', vitals + exam)}
      ${card('Management', '💊', row('Advice', model.advise) + (meds ? `<div class="mvs-med-list">${meds}</div>` : ''))}
      ${cl ? card('Contact lens', '🔵', cl) : ''}
      ${card('Follow-up', '📅', follow + row('Remarks', model.specialRemarks))}
    `;
  }

  function buildPrintDocument(model) {
    const body = buildSheetHtml(model);
    return `<!DOCTYPE html><html lang="en"><head>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Visit Summary — ${esc(model?.fullName || 'Patient')}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,-apple-system,sans-serif;color:#0d1b2a;background:#fff;padding:16px;font-size:15px;line-height:1.45}
        .mvs-header{margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0a4d8c}
        .mvs-clinic{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7f96}
        .mvs-patient{font-size:22px;margin:4px 0;color:#0a4d8c}
        .mvs-meta{font-size:13px;color:#6b7f96}
        .mvs-diagnosis{background:#e8f1fb;border-radius:8px;padding:12px;margin-bottom:14px}
        .mvs-diagnosis span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#3d5166}
        .mvs-card{border:1px solid #d0dae8;border-radius:10px;margin-bottom:12px;overflow:hidden;break-inside:avoid}
        .mvs-card-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f7fafd;border-bottom:1px solid #e8eef6}
        .mvs-card-head h3{font-size:13px;font-weight:700;color:#0a4d8c}
        .mvs-card-body{padding:10px 12px 12px}
        .mvs-row{margin-bottom:8px}
        .mvs-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:#9fb0c2}
        .mvs-value{display:block;font-size:14px;color:#0d1b2a;margin-top:2px}
        .mvs-vitals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}
        .mvs-vital{background:#f7fafd;border-radius:8px;padding:8px 10px}
        .mvs-vital-lbl{display:block;font-size:10px;font-weight:700;color:#6b7f96;text-transform:uppercase}
        .mvs-vital-val{display:block;font-size:14px;font-weight:600;margin-top:2px}
        .mvs-med{display:flex;gap:10px;padding:8px 0;border-top:1px solid #e8eef6}
        .mvs-med:first-child{border-top:none;padding-top:0}
        .mvs-med-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#0a4d8c;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .mvs-med-eye{margin-left:6px;font-size:11px;font-weight:700;color:#1565c0}
        .mvs-med-detail,.mvs-med-inst{font-size:13px;color:#3d5166;margin-top:2px}
        @media print{body{padding:0}}
      </style>
    </head><body>${body}
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
    </body></html>`;
  }

  let overlayEl = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'mobileVisitSummaryOverlay';
    overlayEl.className = 'mvs-overlay';
    overlayEl.hidden = true;
    overlayEl.innerHTML = `
      <div class="mvs-backdrop" data-mvs-close></div>
      <div class="mvs-sheet" role="dialog" aria-modal="true" aria-labelledby="mvsSheetTitle">
        <div class="mvs-toolbar no-print">
          <button type="button" class="mvs-btn-icon" data-mvs-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
          <h2 id="mvsSheetTitle">Visit summary</h2>
          <button type="button" class="mvs-btn-icon" data-mvs-print aria-label="Print"><i class="fa-solid fa-print"></i></button>
        </div>
        <div class="mvs-scroll" id="mvsSheetBody"></div>
        <div class="mvs-footer no-print">
          <button type="button" class="btn-teal" data-mvs-print><i class="fa-solid fa-print"></i> Print</button>
          <button type="button" class="btn-secondary" data-mvs-close>Close</button>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);

    overlayEl.querySelectorAll('[data-mvs-close]').forEach((el) => {
      el.addEventListener('click', close);
    });
    overlayEl.querySelectorAll('[data-mvs-print]').forEach((el) => {
      el.addEventListener('click', () => printCurrent());
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl && !overlayEl.hidden) close();
    });

    return overlayEl;
  }

  let _currentModel = null;

  function openWithModel(model) {
    _currentModel = model;
    const root = ensureOverlay();
    const body = root.querySelector('#mvsSheetBody');
    if (body) body.innerHTML = buildSheetHtml(model);
    root.hidden = false;
    document.body.classList.add('mvs-open');
    root.querySelector('.mvs-sheet')?.focus?.();
  }

  function close() {
    if (!overlayEl) return;
    overlayEl.hidden = true;
    document.body.classList.remove('mvs-open');
  }

  function printCurrent() {
    const model = _currentModel || collectFromForm();
    if (!model) {
      global.alert?.('Open a patient visit before printing.');
      return;
    }
    const win = global.open('', '_blank');
    if (!win) {
      global.alert?.('Pop-up blocked. Allow pop-ups to print the summary.');
      return;
    }
    win.document.write(buildPrintDocument(model));
    win.document.close();
  }

  function updateFabVisibility() {
    const fab = document.getElementById('mvsFab');
    const form = document.getElementById('patientForm');
    if (!fab) return;
    const mobile = global.matchMedia('(max-width: 768px)').matches;
    const formOpen = form && !form.hidden;
    const hasPatient = trimVal(document.getElementById('fullName')?.value)
      || trimVal(document.getElementById('patientId')?.value);
    fab.hidden = !(mobile && formOpen && hasPatient);
  }

  function ensureFab() {
    if (document.getElementById('mvsFab')) return;
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'mvsFab';
    fab.className = 'mvs-fab no-print';
    fab.hidden = true;
    fab.setAttribute('aria-label', 'Open visit summary');
    fab.innerHTML = '<i class="fa-solid fa-file-medical"></i>';
    fab.addEventListener('click', () => openFromForm());
    document.body.appendChild(fab);
    global.matchMedia('(max-width: 768px)').addEventListener('change', updateFabVisibility);
  }

  function openFromForm() {
    const model = collectFromForm();
    if (!model || (model.fullName === '—' && model.patientId === '—')) {
      global.alert?.('Enter patient details before opening the summary.');
      return;
    }
    openWithModel(model);
  }

  function openFromRecord(record) {
    openWithModel(buildSummaryModel(record));
  }

  function init() {
    ensureFab();
    updateFabVisibility();
    const form = document.getElementById('patientForm');
    if (form && !form.dataset.mvsBound) {
      form.dataset.mvsBound = '1';
      form.addEventListener('input', updateFabVisibility);
      new MutationObserver(updateFabVisibility).observe(form, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  global.CorneaMobileVisitSummary = {
    buildSummaryModel,
    buildSheetHtml,
    openFromForm,
    openFromRecord,
    close,
    print: printCurrent,
    refreshFab: updateFabVisibility,
    init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
