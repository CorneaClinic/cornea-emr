/**
 * Cornea Clinic — medical advice / prescription rows
 * Phase 5 extraction from Cornea.html
 */

const MED_ADVICE_EYES = ['', 'RE', 'LE', 'BE', 'OU'];
const MED_ADVICE_ROUTES = ['', 'Topical', 'Oral', 'IM', 'IV', 'SC', 'Periocular', 'Other'];
const MED_ADVICE_FORMS = ['', 'Drops', 'Ointment', 'Gel', 'Tablet', 'Capsule', 'Injection', 'Other'];

function medAdviceSelectOptions(options, selected) {
    return options.map(o => {
        const label = o || '—';
        const sel = o === selected ? ' selected' : '';
        return `<option value="${o}"${sel}>${label}</option>`;
    }).join('');
}

function bindMedicalAdviceRow(tr) {
    tr.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', window.syncMedicalAdviceJSON);
        el.addEventListener('change', window.syncMedicalAdviceJSON);
    });
}

window.createMedicalAdviceRow = function(data = {}) {
    const tr = document.createElement('tr');
    tr.className = 'med-advice-row';
    tr.innerHTML = `
        <td class="col-eye">
            <select data-field="eye" aria-label="Eye">${medAdviceSelectOptions(MED_ADVICE_EYES, data.eye || '')}</select>
        </td>
        <td>
            <input type="text" data-field="drugName" aria-label="Drug name" placeholder="e.g. Moxifloxacin" value="">
        </td>
        <td class="col-route">
            <select data-field="route" aria-label="Route">${medAdviceSelectOptions(MED_ADVICE_ROUTES, data.route || '')}</select>
        </td>
        <td class="col-duration">
            <input type="text" data-field="duration" aria-label="Duration" placeholder="e.g. 7 days" value="">
        </td>
        <td class="col-frequency">
            <input type="text" data-field="frequency" aria-label="Frequency" placeholder="e.g. BD" value="">
        </td>
        <td class="col-form">
            <select data-field="form" aria-label="Form">${medAdviceSelectOptions(MED_ADVICE_FORMS, data.form || '')}</select>
        </td>
        <td>
            <textarea data-field="instruction" aria-label="Instruction" placeholder="e.g. 1 drop in affected eye"></textarea>
        </td>
        <td class="col-actions no-print">
            <button type="button" class="btn-danger btn-sm btn-icon" onclick="removeMedicalAdviceRow(this)" title="Remove row" aria-label="Remove medication row">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
        </td>
    `;
    const setVal = (field, val) => {
        const el = tr.querySelector(`[data-field="${field}"]`);
        if (el) el.value = val ?? '';
    };
    setVal('drugName', data.drugName);
    setVal('duration', data.duration);
    setVal('frequency', data.frequency);
    setVal('instruction', data.instruction);
    bindMedicalAdviceRow(tr);
    return tr;
};

window.syncMedicalAdviceJSON = function() {
    const hidden = document.getElementById('medicalAdviceJSON');
    const tbody = document.getElementById('medicalAdviceList');
    if (!hidden || !tbody) return;
    const rows = [];
    tbody.querySelectorAll('tr.med-advice-row').forEach(tr => {
        const row = {};
        tr.querySelectorAll('[data-field]').forEach(el => {
            row[el.getAttribute('data-field')] = el.value.trim();
        });
        rows.push(row);
    });
    hidden.value = JSON.stringify(rows);
};

window.addMedicalAdviceRow = function(data = {}) {
    const tbody = document.getElementById('medicalAdviceList');
    if (!tbody) return;
    tbody.appendChild(window.createMedicalAdviceRow(data));
    window.syncMedicalAdviceJSON();
};

window.removeMedicalAdviceRow = function(btn) {
    const tbody = document.getElementById('medicalAdviceList');
    if (!tbody) return;
    const row = btn.closest('tr');
    if (!row) return;
    if (tbody.querySelectorAll('tr.med-advice-row').length <= 1) {
        row.querySelectorAll('[data-field]').forEach(el => { el.value = el.tagName === 'SELECT' ? '' : ''; });
    } else {
        row.remove();
    }
    window.syncMedicalAdviceJSON();
};

window.loadMedicalAdviceFromJSON = function(jsonStr) {
    const tbody = document.getElementById('medicalAdviceList');
    if (!tbody) return;
    tbody.innerHTML = '';
    let rows = [];
    try {
        const parsed = JSON.parse(jsonStr || '[]');
        if (Array.isArray(parsed)) rows = parsed;
    } catch (_) { /* ignore invalid JSON */ }
    if (!rows.length) {
        window.addMedicalAdviceRow();
    } else {
        rows.forEach(r => window.addMedicalAdviceRow(r));
    }
};

window.getMedicalAdviceRows = function() {
    const hidden = document.getElementById('medicalAdviceJSON');
    if (!hidden) return [];
    try {
        const parsed = JSON.parse(hidden.value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
};

window.formatMedicalAdviceSummary = function(includeTitle = true) {
    const rows = window.getMedicalAdviceRows().filter(r =>
        r.eye || r.drugName || r.route || r.duration || r.frequency || r.form || r.instruction
    );
    if (!rows.length) return '';
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const titleHtml = includeTitle
        ? '<p style="padding:9px 12px 6px;margin:0;font-size:13px;font-weight:600;color:#3d5166;">Medical Advice</p>'
        : '';
    const body = rows.map((r, i) => `
        <tr>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;text-align:center;font-size:12px;">${i + 1}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.eye) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.drugName) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.route) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.duration) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.frequency) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.form) || '—'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e8eef6;font-size:12px;">${esc(r.instruction) || '—'}</td>
        </tr>
    `).join('');
    return `
        ${titleHtml}
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <thead>
                <tr style="background:#eaf1fb;">
                    <th style="padding:7px 10px;text-align:center;font-size:11px;font-weight:700;color:#0a4d8c;">#</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Eye</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Drug</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Route</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Duration</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Frequency</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Form</th>
                    <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:#0a4d8c;">Instruction</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
};

function initMedicalAdvice() {
    const tbody = document.getElementById('medicalAdviceList');
    if (tbody && !tbody.children.length) window.addMedicalAdviceRow();
}
