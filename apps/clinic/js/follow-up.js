/**
 * Cornea Clinic — follow-up scheduling UI
 * Phase 5 extraction from Cornea.html
 */

const FOLLOW_UP_SPECS = {
    '3d':  { days: 3 },
    '5d':  { days: 5 },
    '7d':  { days: 7 },
    '15d': { days: 15 },
    '1m':  { months: 1 },
    '3m':  { months: 3 },
    '4m':  { months: 4 },
    '6m':  { months: 6 },
    '1y':  { years: 1 }
};

const FOLLOW_UP_INTERVAL_LABELS = {
    '3d': '3 Days', '5d': '5 Days', '7d': '7 Days', '15d': '15 Days',
    '1m': '1 Month', '3m': '3 Months', '4m': '4 Months', '6m': '6 Months', '1y': '1 Year',
    'custom': 'Custom Date'
};

function getFollowUpBaseDate() {
    const visit = document.getElementById('visitDate')?.value;
    const d = visit ? new Date(visit + 'T12:00:00') : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
}

function formatFollowUpDisplay(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function computeFollowUpIso(key) {
    const spec = FOLLOW_UP_SPECS[key];
    if (!spec) return '';
    const d = getFollowUpBaseDate();
    if (spec.days) d.setDate(d.getDate() + spec.days);
    if (spec.months) d.setMonth(d.getMonth() + spec.months);
    if (spec.years) d.setFullYear(d.getFullYear() + spec.years);
    return d.toISOString().split('T')[0];
}

window.setFollowUpDateIso = function(iso) {
    const hidden = document.getElementById('followUpDate');
    const display = document.getElementById('followUpDateDisplay');
    if (hidden) hidden.value = iso || '';
    if (display) display.value = iso ? formatFollowUpDisplay(iso) : '';
};

window.selectFollowUpInterval = function(key) {
    const intervalEl = document.getElementById('followUpInterval');
    const customEl = document.getElementById('followUpCustomDate');
    if (!intervalEl) return;
    const iso = computeFollowUpIso(key);
    intervalEl.value = key;
    window.setFollowUpDateIso(iso);
    if (customEl) customEl.value = '';
    document.querySelectorAll('.followup-interval-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.interval === key);
    });
};

window.onFollowUpCustomDateChange = function() {
    const customEl = document.getElementById('followUpCustomDate');
    const intervalEl = document.getElementById('followUpInterval');
    if (!customEl?.value) return;
    if (intervalEl) intervalEl.value = 'custom';
    window.setFollowUpDateIso(customEl.value);
    document.querySelectorAll('.followup-interval-btn').forEach(b => b.classList.remove('active'));
};

window.setFollowUpSeverity = function(severity, updateHidden = true) {
    const hidden = document.getElementById('followUpSeverity');
    if (updateHidden && hidden) hidden.value = severity || '';
    document.querySelectorAll('.severity-btn').forEach(btn => {
        btn.classList.toggle('active', !!severity && btn.dataset.severity === severity);
    });
};

window.restoreFollowUpUI = function() {
    const interval = document.getElementById('followUpInterval')?.value || '';
    const severity = document.getElementById('followUpSeverity')?.value || '';
    const iso = document.getElementById('followUpDate')?.value || '';
    const customEl = document.getElementById('followUpCustomDate');

    window.setFollowUpDateIso(iso);
    document.querySelectorAll('.followup-interval-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.interval === interval && interval !== 'custom');
    });
    if (interval === 'custom' && customEl && iso) customEl.value = iso;
    window.setFollowUpSeverity(severity, false);
};

window.resetFollowUpUI = function() {
    const intervalEl = document.getElementById('followUpInterval');
    const customEl = document.getElementById('followUpCustomDate');
    if (intervalEl) intervalEl.value = '';
    if (customEl) customEl.value = '';
    window.setFollowUpDateIso('');
    document.querySelectorAll('.followup-interval-btn').forEach(b => b.classList.remove('active'));
    window.setFollowUpSeverity('');
};

window.formatFollowUpPrintSection = function() {
    const iso = document.getElementById('followUpDate')?.value || '';
    const interval = document.getElementById('followUpInterval')?.value || '';
    const place = document.getElementById('followUpPlace')?.value?.trim() || '';
    const purpose = document.getElementById('followUpPurpose')?.value?.trim() || '';
    const severity = document.getElementById('followUpSeverity')?.value || '';
    const remarks = document.getElementById('followUpRemarks')?.value?.trim() || '';

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const intervalLabel = FOLLOW_UP_INTERVAL_LABELS[interval] || (interval ? esc(interval) : '');
    const severityStyles = {
        severe: 'background:#c62828;color:#fff;',
        moderate: 'background:#ef5350;color:#fff;',
        mild: 'background:#43a047;color:#fff;'
    };
    const severityLabels = { severe: 'Severe', moderate: 'Moderate', mild: 'Mild' };
    const severityCell = severity
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;${severityStyles[severity] || ''}">${severityLabels[severity] || esc(severity)}</span>`
        : '—';
    const dateCell = iso
        ? `${esc(formatFollowUpDisplay(iso))}${intervalLabel ? ` <span style="color:#6b7f96;font-size:12px;">(${esc(intervalLabel)})</span>` : ''}`
        : '—';

    return `
        <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;width:32%;background:#f7fafd;">Follow-up Date</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${dateCell}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Place</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${esc(place) || '—'}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Purpose</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${esc(purpose) || '—'}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Severity</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${severityCell}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;vertical-align:top;">Remarks</td><td style="padding:9px 12px;font-size:13px;">${esc(remarks) || '—'}</td></tr>
        </table>
    `;
};

window.formatFollowUpSummary = function() {
    const iso = document.getElementById('followUpDate')?.value || '';
    const interval = document.getElementById('followUpInterval')?.value || '';
    const place = document.getElementById('followUpPlace')?.value?.trim() || '';
    const purpose = document.getElementById('followUpPurpose')?.value?.trim() || '';
    const severity = document.getElementById('followUpSeverity')?.value || '';
    const remarks = document.getElementById('followUpRemarks')?.value?.trim() || '';
    if (!iso && !place && !purpose && !severity && !remarks) return '';

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const intervalLabel = FOLLOW_UP_INTERVAL_LABELS[interval] || (interval ? esc(interval) : '—');
    const severityStyles = {
        severe: 'background:#c62828;color:#fff;',
        moderate: 'background:#ef5350;color:#fff;',
        mild: 'background:#43a047;color:#fff;'
    };
    const severityLabels = { severe: 'Severe', moderate: 'Moderate', mild: 'Mild' };
    const severityCell = severity
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;${severityStyles[severity] || ''}">${severityLabels[severity] || esc(severity)}</span>`
        : '—';

    return `
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;width:32%;background:#f7fafd;">Follow-up Date</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${iso ? esc(formatFollowUpDisplay(iso)) : '—'}${interval ? ` <span style="color:#6b7f96;font-size:12px;">(${esc(intervalLabel)})</span>` : ''}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Place</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${esc(place) || '—'}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Purpose</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${esc(purpose) || '—'}</td></tr>
            <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Severity</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${severityCell}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;vertical-align:top;">Remarks</td><td style="padding:9px 12px;font-size:13px;">${esc(remarks) || '—'}</td></tr>
        </table>
    `;
};

function initFollowUp() {
    document.querySelectorAll('.followup-interval-btn').forEach(btn => {
        btn.addEventListener('click', () => window.selectFollowUpInterval(btn.dataset.interval));
    });
    document.getElementById('followUpCustomDate')?.addEventListener('change', window.onFollowUpCustomDateChange);
    document.querySelectorAll('.severity-btn').forEach(btn => {
        btn.addEventListener('click', () => window.setFollowUpSeverity(btn.dataset.severity));
    });
    const visitEl = document.getElementById('visitDate');
    if (visitEl) {
        visitEl.addEventListener('change', () => {
            const key = document.getElementById('followUpInterval')?.value;
            if (key && key !== 'custom') window.selectFollowUpInterval(key);
        });
    }
}
