/**
 * Opinion & Referral — second opinion notes with replies and referral letters
 */
(function (global) {
  'use strict';

  const DEFAULT_STATE = {
    version: 1,
    activeTab: 'opinion',
    opinion: { clinic: '', doctor: '', reason: '', note: '', replies: [] },
    referral: { summary: '', hospital: '', specialty: '', reason: '' },
  };

  let state = cloneDefault();

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseState(raw) {
    if (!raw) return cloneDefault();
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const base = cloneDefault();
      return {
        version: p.version || 1,
        activeTab: p.activeTab || 'opinion',
        opinion: { ...base.opinion, ...(p.opinion || {}), replies: Array.isArray(p.opinion?.replies) ? p.opinion.replies : [] },
        referral: { ...base.referral, ...(p.referral || {}) },
      };
    } catch (_) {
      return cloneDefault();
    }
  }

  function syncHiddenField() {
    const el = document.getElementById('opinionReferralJSON');
    if (el) el.value = JSON.stringify(state);
  }

  function collectFromDom() {
    state.opinion.clinic = document.getElementById('opinionClinic')?.value?.trim() || '';
    state.opinion.doctor = document.getElementById('opinionDoctor')?.value?.trim() || '';
    state.opinion.reason = document.getElementById('opinionReason')?.value?.trim() || '';
    state.opinion.note = document.getElementById('opinionNote')?.value?.trim() || '';
    state.referral.summary = document.getElementById('referralSummary')?.value?.trim() || '';
    state.referral.hospital = document.getElementById('referralHospital')?.value?.trim() || '';
    state.referral.specialty = document.getElementById('referralSpecialty')?.value?.trim() || '';
    state.referral.reason = document.getElementById('referralReason')?.value?.trim() || '';
    syncHiddenField();
  }

  function fillDomFromState() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    set('opinionClinic', state.opinion.clinic);
    set('opinionDoctor', state.opinion.doctor);
    set('opinionReason', state.opinion.reason);
    set('opinionNote', state.opinion.note);
    set('referralSummary', state.referral.summary);
    set('referralHospital', state.referral.hospital);
    set('referralSpecialty', state.referral.specialty);
    set('referralReason', state.referral.reason);
    renderReplies();
    switchTab(state.activeTab || 'opinion', false);
    syncHiddenField();
  }

  function currentActorName() {
    if (global.__corneaCloudMode && global.__corneaUser) {
      return global.__corneaUser.fullName || global.__corneaUser.email || 'Cloud user';
    }
    const u = global.CorneaOfflineAuth?.getCurrentUser?.();
    return u?.fullName || u?.username || 'Clinician';
  }

  function formatStamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderReplies() {
    const wrap = document.getElementById('opinionRepliesList');
    if (!wrap) return;
    const replies = state.opinion.replies || [];
    if (!replies.length) {
      wrap.innerHTML = '<p class="form-hint">No replies yet.</p>';
      return;
    }
    wrap.innerHTML = replies.map((r) => `
      <div class="opinion-reply-card">
        <div class="opinion-reply-meta"><strong>${escapeHtml(r.authorName || 'Doctor')}</strong> · ${escapeHtml(formatStamp(r.at))}</div>
        <div class="opinion-reply-body">${escapeHtml(r.text || '').replace(/\n/g, '<br>')}</div>
      </div>`).join('');
  }

  function switchTab(tab, persist = true) {
    state.activeTab = tab;
    document.querySelectorAll('.or-subnav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.orPanel === tab);
    });
    document.querySelectorAll('.or-panel').forEach((panel) => {
      const isOpinion = panel.id === 'orPanelOpinion';
      const active = (tab === 'opinion' && isOpinion) || (tab === 'referral' && !isOpinion);
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    if (persist) syncHiddenField();
  }

  function buildSummaryFromRecord(d) {
    const lines = [];
    const add = (label, val) => {
      const v = String(val ?? '').trim();
      if (v) lines.push(`${label}: ${v}`);
    };
    add('Patient', d.fullName);
    add('Age / Sex', [global.formatAgeDisplay?.(d) || d.age, d.sex].filter(Boolean).join(', '));
    add('Visit date', d.visitDate);
    add('Chief complaint', d.chiefComplaint);
    add('Duration', d.durationSymptoms);
    add('Ocular history', d.ocularHistory);
    add('Systemic history', d.systemicHistory);
    add('Visual acuity RE', d.visionREBCVA || d.visionREUCVA);
    add('Visual acuity LE', d.visionLEBCVA || d.visionLEUCVA);
    if (d.iopRE || d.iopLE) add('IOP RE / LE', `${d.iopRE || '—'} / ${d.iopLE || '—'} mmHg`);
    add('Diagnosis', d.diagnosis);
    add('Advice', d.advise);
    add('Special remarks', d.specialRemarks);
    return lines.join('\n');
  }

  function buildVisitSummary() {
    if (typeof global.collectFormDataObject === 'function') {
      const d = global.collectFormDataObject();
      return buildSummaryFromRecord(d);
    }
    return '';
  }

  function hasData(st, legacyText) {
    if (legacyText?.trim()) return true;
    const o = st.opinion || {};
    const r = st.referral || {};
    return !!(o.clinic || o.doctor || o.reason || o.note || (o.replies?.length) || r.summary || r.hospital || r.specialty || r.reason);
  }

  function bindEvents() {
    const root = document.getElementById('opinionReferralRoot');
    if (!root || root.dataset.orInit === '1') return;
    root.dataset.orInit = '1';

    root.querySelectorAll('.or-subnav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        collectFromDom();
        switchTab(btn.dataset.orPanel);
      });
    });

    ['opinionClinic', 'opinionDoctor', 'opinionReason', 'opinionNote', 'referralSummary', 'referralHospital', 'referralSpecialty', 'referralReason'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', collectFromDom);
    });

    document.getElementById('btnOpinionReplyToggle')?.addEventListener('click', () => {
      const box = document.getElementById('opinionReplyCompose');
      if (box) box.hidden = !box.hidden;
    });

    document.getElementById('btnOpinionReplyCancel')?.addEventListener('click', () => {
      const box = document.getElementById('opinionReplyCompose');
      const text = document.getElementById('opinionReplyText');
      if (text) text.value = '';
      if (box) box.hidden = true;
    });

    document.getElementById('btnOpinionReplySave')?.addEventListener('click', () => {
      collectFromDom();
      const text = document.getElementById('opinionReplyText')?.value?.trim();
      if (!text) {
        alert('Enter a reply before saving.');
        return;
      }
      state.opinion.replies = state.opinion.replies || [];
      state.opinion.replies.push({
        text,
        authorName: currentActorName(),
        at: new Date().toISOString(),
      });
      const replyEl = document.getElementById('opinionReplyText');
      if (replyEl) replyEl.value = '';
      const compose = document.getElementById('opinionReplyCompose');
      if (compose) compose.hidden = true;
      syncHiddenField();
      renderReplies();
    });

    document.getElementById('btnGenerateReferralSummary')?.addEventListener('click', () => {
      const summary = buildVisitSummary();
      const el = document.getElementById('referralSummary');
      if (el) el.value = summary;
      state.referral.summary = summary;
      syncHiddenField();
    });

    document.getElementById('btnPrintReferralLetter')?.addEventListener('click', () => {
      collectFromDom();
      global.printReferralLetter?.();
    });
  }

  function buildRoField(label, value, full) {
    if (global.buildEmrRoField) return global.buildEmrRoField(label, value, full);
    const v = String(value ?? '').trim();
    if (!v) return '';
    return `<div class="emr-ro-field${full ? ' span-full' : ''}"><div class="emr-ro-label">${escapeHtml(label)}</div><div class="emr-ro-value">${escapeHtml(v)}</div></div>`;
  }

  function formatReadOnly(data) {
    const st = parseState(data?.opinionReferralJSON);
    if (data?.opinionReferral?.trim() && !st.opinion.note) st.opinion.note = data.opinionReferral.trim();
    if (!hasData(st, '')) return '';

    let opinionHtml = `<div class="emr-ro-grid">
      ${buildRoField('Clinic', st.opinion.clinic)}
      ${buildRoField('Doctor', st.opinion.doctor)}
      ${buildRoField('Reason for opinion', st.opinion.reason, true)}
      ${buildRoField('Note', st.opinion.note, true)}
    </div>`;
    if (st.opinion.replies?.length) {
      opinionHtml += `<div class="opinion-replies-readonly mt-4"><h5>Replies</h5>${st.opinion.replies.map((r) => `
        <div class="opinion-reply-card">
          <div class="opinion-reply-meta"><strong>${escapeHtml(r.authorName || 'Doctor')}</strong> · ${escapeHtml(formatStamp(r.at))}</div>
          <div class="opinion-reply-body">${escapeHtml(r.text || '').replace(/\n/g, '<br>')}</div>
        </div>`).join('')}</div>`;
    }

    const referralHtml = `<div class="emr-ro-grid">
      ${buildRoField('Finding summary', st.referral.summary, true)}
      ${buildRoField('Hospital', st.referral.hospital)}
      ${buildRoField('Specialty', st.referral.specialty)}
      ${buildRoField('Reason for referral', st.referral.reason, true)}
    </div>`;

    const body = `<div class="or-readonly-tabs">
      <h5>Opinion</h5>${opinionHtml}
      <h5 class="mt-4">Referral</h5>${referralHtml}
    </div>`;

    return global.buildEmrRoSection
      ? global.buildEmrRoSection('Opinion & Referral Notes', 'fa-user-doctor', body, '', 'section-theme-opinion')
      : `<div class="emr-ro-section">${body}</div>`;
  }

  function printReferralLetter() {
    collectFromDom();
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';
    const gv = (id) => escapeHtml(getValue(id) || '—');
    const sex = escapeHtml(document.querySelector('input[name="sex"]:checked')?.value || '—');

    if (!getValue('fullName') && !getValue('patientId')) {
      alert('Please enter patient name or ID before printing the referral letter.');
      return;
    }

    const summary = escapeHtml(state.referral.summary || '—').replace(/\n/g, '<br>');
    const sectionHeader = (title) => `
      <div style="background:linear-gradient(135deg,#ede7f6,#f3e5f5);padding:11px 16px;margin:22px 0 0;border-radius:8px 8px 0 0;border-left:4px solid #5e35b1;">
        <span style="font-weight:700;color:#4527a0;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">${title}</span>
      </div>
      <div style="border:1px solid #d0dae8;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">`;

    const printContent = `
      <div style="font-family:'Segoe UI',system-ui,sans-serif;color:#0d1b2a;padding:36px;max-width:820px;margin:auto;">
        <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #5e35b1;">
          <h1 style="color:#4527a0;margin:0;font-size:24px;font-weight:800;">CORNEA CLINIC</h1>
          <p style="margin:6px 0 0;color:#6b7f96;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Referral Letter</p>
          <p style="margin:4px 0 0;color:#9fb0c2;font-size:12px;">Printed: ${escapeHtml(new Date().toLocaleString())}</p>
        </div>

        ${sectionHeader('Patient Details')}
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:50%;"><strong>Patient ID:</strong> ${gv('patientId')}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;"><strong>Name:</strong> ${gv('fullName')}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><strong>Age:</strong> ${gv('age')} years</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><strong>Sex:</strong> ${sex}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px;font-size:13px;" colspan="2"><strong>Visit Date:</strong> ${gv('visitDate')}</td>
          </tr>
        </table></div>

        ${sectionHeader('Referral To')}
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:32%;background:#f7fafd;"><strong>Hospital</strong></td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('referralHospital')}</td></tr>
          <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><strong>Specialty</strong></td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('referralSpecialty')}</td></tr>
          <tr><td style="padding:9px 12px;font-size:13px;background:#f7fafd;vertical-align:top;"><strong>Reason</strong></td><td style="padding:9px 12px;font-size:13px;">${gv('referralReason')}</td></tr>
        </table></div>

        ${sectionHeader('Clinical Summary')}
        <div style="padding:14px 16px;font-size:13px;line-height:1.55;">${summary}</div></div>

        <div style="margin-top:56px;display:flex;justify-content:space-between;gap:40px;">
          <div style="text-align:center;flex:1;">
            <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;">Referring Doctor</div>
          </div>
          <div style="text-align:center;flex:1;">
            <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;">Date</div>
            <div style="font-size:12px;margin-top:4px;">${escapeHtml(new Date().toLocaleDateString())}</div>
          </div>
        </div>
      </div>`;

    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) {
      alert('Pop-up blocked. Allow pop-ups to print the referral letter.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Referral Letter</title></head><body>${printContent}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const CorneaOpinionReferral = {
    init() {
      state = parseState(document.getElementById('opinionReferralJSON')?.value || '{}');
      bindEvents();
      fillDomFromState();
    },
    reset() {
      state = cloneDefault();
      const replyText = document.getElementById('opinionReplyText');
      if (replyText) replyText.value = '';
      const compose = document.getElementById('opinionReplyCompose');
      if (compose) compose.hidden = true;
      fillDomFromState();
    },
    syncToHiddenField() { collectFromDom(); },
    onFormPopulated(data) {
      state = parseState(data?.opinionReferralJSON || '{}');
      if (data?.opinionReferral?.trim() && !state.opinion.note) state.opinion.note = data.opinionReferral.trim();
      if (!state.referral.summary?.trim() && data) state.referral.summary = buildSummaryFromRecord(data);
      fillDomFromState();
    },
    buildSummaryFromRecord,
    formatReadOnly,
    getState: () => state,
  };

  global.CorneaOpinionReferral = CorneaOpinionReferral;
  global.printReferralLetter = printReferralLetter;
})(typeof window !== 'undefined' ? window : globalThis);
