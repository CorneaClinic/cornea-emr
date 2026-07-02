/**
 * Cornea Clinic — clinical report and medical advice printing
 * Phase 4 extraction from Cornea.html
 */

// --- Summary & Printing ---
window.generateSummary = function(autoPrint = false) {
    window.syncMedicalAdviceJSON();
    window.CorneaContactLens?.syncToHiddenField?.();
    window.CorneaScleralLens?.syncToHiddenField?.();
    window.CorneaLaserRefractive?.syncToHiddenField?.();
    window.CorneaOpinionReferral?.syncToHiddenField?.();
    window.CorneaOpinionReferral?.syncToHiddenField?.();
    const getValue = id => document.getElementById(id)?.value || '—';
    const gv = id => escapeHtml(getValue(id));
    const sex = escapeHtml(document.querySelector('input[name="sex"]:checked')?.value || '—');

    const getExamRow = (label, reId, leId) => {
        if (getValue(reId) === '—' && getValue(leId) === '—') return '';
        const reVal = gv(reId), leVal = gv(leId);
        return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;width:32%;background:#f7fafd;">${label}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:34%;">${reVal}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:34%;">${leVal}</td>
        </tr>`;
    };

    const sectionHeader = (title, icon) => `
        <div style="background:linear-gradient(135deg,#e8f1fb,#f0f6ff);padding:11px 16px;margin:22px 0 0;border-radius:8px 8px 0 0;border-left:4px solid #1565c0;display:flex;align-items:center;gap:9px;">
            <span style="font-size:15px;">${icon}</span>
            <span style="font-weight:700;color:#0a4d8c;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">${title}</span>
        </div>
        <div style="border:1px solid #d0dae8;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">`;

    const summaryContent = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;color:#0d1b2a;padding:36px;max-width:820px;margin:auto;">
            <!-- HEADER -->
            <div style="text-align:center;margin-bottom:32px;padding-bottom:22px;border-bottom:3px solid #0a4d8c;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#e8f1fb;border-radius:14px;margin-bottom:12px;">
                    <span style="font-size:26px;">👁️</span>
                </div>
                <h1 style="color:#0a4d8c;margin:0;font-size:26px;font-weight:800;letter-spacing:-.01em;">CORNEA CLINIC</h1>
                <p style="margin:6px 0 0;color:#6b7f96;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Clinical Examination Report</p>
                <p style="margin:4px 0 0;color:#9fb0c2;font-size:12px;">Generated: ${new Date().toLocaleString()}</p>
            </div>

            <!-- PATIENT INFO -->
            ${sectionHeader('Patient Information', '🪪')}
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:50%;"><span style="font-weight:600;color:#3d5166;">Patient ID:</span> <code style="background:#eaf1fb;padding:2px 7px;border-radius:4px;font-size:12px;color:#1565c0;">${gv('patientId')}</code></td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Full Name:</span> <strong>${gv('fullName')}</strong></td>
                </tr>
                <tr>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><span style="font-weight:600;color:#3d5166;">Age:</span> ${gv('age')} years</td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><span style="font-weight:600;color:#3d5166;">Sex:</span> ${sex}</td>
                </tr>
                <tr>
                    <td style="padding:9px 12px;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Visit Date:</span> ${gv('visitDate')}</td>
                    <td style="padding:9px 12px;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Phone:</span> ${gv('phone')}</td>
                </tr>
            </table>
            </div>

            <!-- CLINICAL HISTORY -->
            ${sectionHeader('Clinical History', '📋')}
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;width:32%;background:#f7fafd;">Chief Complaint</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('chiefComplaint')}</td></tr>
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Duration</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('durationSymptoms')}</td></tr>
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Previous Treatments</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('previousTreatments')}</td></tr>
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Ocular History</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('ocularHistory')}</td></tr>
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Systemic History</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('systemicHistory')}</td></tr>
                <tr><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Medication</td><td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('currentMedication')}</td></tr>
                <tr><td style="padding:8px 12px;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Family History</td><td style="padding:8px 12px;font-size:13px;">${gv('familyHistory')}</td></tr>
            </table>
            </div>

            <!-- VISION -->
            ${sectionHeader('Vision & Refraction', '👓')}
            <div style="padding:12px 14px;font-size:13px;">${formatRefractionReadOnlySection(collectFormDataObject())}</div>
            </div>

            <!-- VITALS -->
            ${sectionHeader('Investigations & Vitals', '❤️')}
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:9px 12px;font-size:13px;font-weight:600;color:#3d5166;background:#f7fafd;width:32%;">BP</td><td style="padding:9px 12px;font-size:13px;">${gv('bp')}</td></tr>
                <tr><td style="padding:9px 12px;font-size:13px;font-weight:600;color:#3d5166;background:#f7fafd;border-top:1px solid #e8eef6;">Blood Sugar</td><td style="padding:9px 12px;font-size:13px;border-top:1px solid #e8eef6;">${gv('sugar')}</td></tr>
                <tr><td style="padding:9px 12px;font-size:13px;font-weight:600;color:#3d5166;background:#f7fafd;border-top:1px solid #e8eef6;">IOP RE / LE</td><td style="padding:9px 12px;font-size:13px;border-top:1px solid #e8eef6;">${gv('iopRE')} / ${gv('iopLE')}</td></tr>
            </table>
            </div>

            <!-- ANTERIOR SEGMENT -->
            ${sectionHeader('Anterior Segment Examination', '🔬')}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#eaf1fb;"><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Structure</th><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Right Eye (RE)</th><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Left Eye (LE)</th></tr></thead>
                <tbody>
                    ${getExamRow('Lid', 'lidRE', 'lidLE')}
                    ${getExamRow('Conjunctiva', 'conjRE', 'conjLE')}
                    ${getExamRow('Cornea', 'corneaRE', 'corneaLE')}
                    ${getExamRow('Anterior Chamber', 'acRE', 'acLE')}
                    ${getExamRow('Iris', 'irisRE', 'irisLE')}
                    ${getExamRow('Pupil', 'pupilRE', 'pupilLE')}
                    ${getExamRow('Lens', 'lensRE', 'lensLE')}
                    ${getExamRow('Ocular Movements', 'movementRE', 'movementLE')}
                    ${getExamRow('Corneal Reflex', 'reflexRE', 'reflexLE')}
                    ${getExamRow('Globe', 'globeRE', 'globeLE')}
                    ${getExamRow('Undilated Fundus', 'fundusUndRE', 'fundusUndLE')}
                </tbody>
            </table>
            <p style="padding:9px 12px;margin:0;font-size:13px;border-top:1px solid #e8eef6;"><strong>RE Remarks:</strong> ${gv('remarksAntRE')} &nbsp;|&nbsp; <strong>LE Remarks:</strong> ${gv('remarksAntLE')}</p>
            </div>

            <!-- FUNDUS -->
            ${sectionHeader('Fundus Examination', '👁️')}
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#eaf1fb;"><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Structure</th><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Right Eye (RE)</th><th style="padding:9px 12px;text-align:left;font-size:12px;font-weight:700;color:#0a4d8c;text-transform:uppercase;letter-spacing:.06em;">Left Eye (LE)</th></tr></thead>
                <tbody>
                    ${getExamRow('Media', 'mediaRE', 'mediaLE')}
                    ${getExamRow('Disc', 'discRE', 'discLE')}
                    ${getExamRow('Vessels', 'vesselRE', 'vesselLE')}
                    ${getExamRow('Background Retina', 'retinaRE', 'retinaLE')}
                    ${getExamRow('Macula / Foveal Reflex', 'fovealRE', 'fovealLE')}
                </tbody>
            </table>
            <p style="padding:9px 12px;margin:0;font-size:13px;border-top:1px solid #e8eef6;"><strong>RE Remarks:</strong> ${gv('fundusRemarksRE')} &nbsp;|&nbsp; <strong>LE Remarks:</strong> ${gv('fundusRemarksLE')}</p>
            </div>

            <!-- DIAGNOSIS -->
            ${sectionHeader('Diagnosis & Management Plan', '📝')}
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;width:32%;background:#f7fafd;">Diagnosis</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('diagnosis')}</td></tr>
                <tr><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;">Advice</td><td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;">${gv('advise')}</td></tr>
                <tr><td style="padding:9px 12px;font-weight:600;color:#3d5166;font-size:13px;background:#f7fafd;vertical-align:top;">Special Remarks</td><td style="padding:9px 12px;font-size:13px;">${gv('specialRemarks')}</td></tr>
            </table>
            ${window.formatMedicalAdviceSummary()}
            </div>

            ${(() => {
                if (!window.CorneaOpinionReferral) return '';
                const raw = document.getElementById('opinionReferralJSON')?.value;
                try {
                    const st = raw ? JSON.parse(raw) : null;
                    if (!st || !window.CorneaOpinionReferral.getState) return '';
                    const o = st.opinion || {};
                    const r = st.referral || {};
                    if (!o.clinic && !o.doctor && !o.note && !r.hospital && !r.reason) return '';
                    const e = escapeHtml;
                    const nl = (s) => e(s || '—').replace(/\n/g, '<br>');
                    return sectionHeader('Opinion & Referral Notes', '🩺') + `<table style="width:100%;border-collapse:collapse;">
                        <tr><td colspan="2" style="padding:10px 12px;font-weight:700;background:#f7fafd;">Opinion</td></tr>
                        <tr><td style="padding:8px 12px;width:32%;background:#f7fafd;font-weight:600;">Clinic</td><td style="padding:8px 12px;">${e(o.clinic)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Doctor</td><td style="padding:8px 12px;">${e(o.doctor)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Reason</td><td style="padding:8px 12px;">${nl(o.reason)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Note</td><td style="padding:8px 12px;">${nl(o.note)}</td></tr>
                        <tr><td colspan="2" style="padding:10px 12px;font-weight:700;background:#f7fafd;">Referral</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Hospital</td><td style="padding:8px 12px;">${e(r.hospital)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Specialty</td><td style="padding:8px 12px;">${e(r.specialty)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Summary</td><td style="padding:8px 12px;">${nl(r.summary)}</td></tr>
                        <tr><td style="padding:8px 12px;background:#f7fafd;font-weight:600;">Reason</td><td style="padding:8px 12px;">${nl(r.reason)}</td></tr>
                    </table></div>`;
                } catch { return ''; }
            })()}

            ${(() => {
                if (!window.CorneaContactLens) return '';
                const raw = document.getElementById('contactLensJSON')?.value;
                if (!raw || raw === '{}' || raw === '{"version":1,"activeTab":"indication","fit":{},"history":[]}') return '';
                try {
                    const st = JSON.parse(raw);
                    const ind = (st.fit?.indication || []).join(', ');
                    const od = st.fit?.finalRx?.od || {};
                    const os = st.fit?.finalRx?.os || {};
                    if (!ind && !od.lensType) return '';
                    return sectionHeader('Contact Lens', '👁️') + `<div style="border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:8px;">
                        <p><strong>Indication:</strong> ${escapeHtml(ind || '—')}</p>
                        <p><strong>OD:</strong> ${escapeHtml([od.lensType, od.power, od.baseCurve, od.diameter].filter(Boolean).join(' · ') || '—')}</p>
                        <p><strong>OS:</strong> ${escapeHtml([os.lensType, os.power, os.baseCurve, os.diameter].filter(Boolean).join(' · ') || '—')}</p>
                    </div>`;
                } catch { return ''; }
            })()}

            ${(() => {
                if (!window.CorneaScleralLens) return '';
                const raw = document.getElementById('scleralLensJSON')?.value;
                if (!raw || raw === '{}') return '';
                try {
                    const st = JSON.parse(raw);
                    const ind = (st.fit?.indication || []).join(', ');
                    const design = st.fit?.finalDesign?.shared || st.fit?.trialSelection?.shared || {};
                    if (!ind && !design.sagittalDepth) return '';
                    return sectionHeader('Scleral Lens Fitting', '🔬') + `<div style="border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:8px;">
                        <p><strong>Indication:</strong> ${escapeHtml(ind || '—')}</p>
                        <p><strong>Design:</strong> Sag ${escapeHtml(design.sagittalDepth || '—')} · Ø ${escapeHtml(design.diameter || '—')} · Power ${escapeHtml(design.power || '—')}</p>
                        <p><strong>Clearance:</strong> ${escapeHtml(st.fit?.centralClearance?.shared?.estimate || '—')} µm</p>
                        ${window.CorneaScleralLensAdvisor?.formatPrintBlock(st.aiAdvisor?.lastReport, st.aiAdvisor, st.fit?.followUp?.notes) || ''}
                    </div>`;
                } catch { return ''; }
            })()}

            ${(() => {
                if (!window.CorneaLaserRefractive) return '';
                const raw = document.getElementById('laserRefractiveJSON')?.value;
                if (!raw || raw === '{}' || raw.includes('"workup":{}')) return '';
                try {
                    const st = JSON.parse(raw);
                    const w = st.workup || {};
                    const risk = st.computed?.risk || window.CorneaLaserRefractiveTaxonomy?.computeRisk?.(w)?.level;
                    const proc = w.planning?.selectedProcedure || st.computed?.planning?.recommendedProcedure;
                    if (!risk && !proc && !w.refraction?.od?.manifestSph) return '';
                    return sectionHeader('Laser Refractive Work-up', '⚡') + `<div style="border:1px solid #e8eef6;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:8px;">
                        <p><strong>Risk level:</strong> ${escapeHtml(risk || '—')}</p>
                        <p><strong>Planned procedure:</strong> ${escapeHtml(proc || '—')}</p>
                        <p><strong>Refraction:</strong> OD ${escapeHtml(w.refraction?.od?.manifestSph || '—')} D · OS ${escapeHtml(w.refraction?.os?.manifestSph || '—')} D</p>
                        <p><strong>Pachymetry:</strong> ${escapeHtml(w.corneal?.od?.pachymetry || '—')} / ${escapeHtml(w.corneal?.os?.pachymetry || '—')} µm</p>
                        ${window.CorneaLaserRefractiveAdvisor?.formatPrintBlock(w.aiAdvisor?.lastReport, w.aiAdvisor, w.planning?.notes) || ''}
                    </div>`;
                } catch { return ''; }
            })()}

            ${(() => {
                const fu = window.formatFollowUpSummary();
                return fu ? sectionHeader('Follow Up', '📅') + '<div style="border:1px solid #e8eef6;border-radius:8px;overflow:hidden;margin-bottom:8px;">' + fu + '</div>' : '';
            })()}

            <!-- SIGNATURE -->
            <div style="margin-top:64px;display:flex;justify-content:space-between;gap:40px;">
                <div style="text-align:center;flex:1;">
                    <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;color:#0d1b2a;">Clinician Signature</div>
                    <div style="font-size:11px;color:#9fb0c2;margin-top:4px;">Name / Designation</div>
                </div>
                <div style="text-align:center;flex:1;">
                    <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;color:#0d1b2a;">Date &amp; Stamp</div>
                    <div style="font-size:11px;color:#9fb0c2;margin-top:4px;">&nbsp;</div>
                </div>
            </div>
        </div>
    `;

    const win = window.open('', '_blank', 'width=940,height=900');
    if (!win) { alert("Pop-up blocked! Please enable pop-ups for this site."); return; }

    const printScript = autoPrint ? '<script>window.onload = () => setTimeout(() => window.print(), 500);<\/script>' : '';

    win.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Clinical Report — ${gv('fullName')}</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; background: #f0f4f8; font-family: 'Segoe UI', sans-serif; }
                .no-print-bar {
                    background: #0a4d8c;
                    padding: 14px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    box-shadow: 0 2px 12px rgba(0,0,0,.2);
                }
                .no-print-bar h2 { color: rgba(255,255,255,.7); font-size: 14px; margin: 0; font-weight: 500; }
                .bar-btns { display: flex; gap: 10px; }
                .btn { padding: 8px 18px; font-weight: 700; cursor: pointer; border-radius: 6px; border: none; font-size: 13px; display:inline-flex;align-items:center;gap:6px; }
                .btn-print { background: white; color: #0a4d8c; }
                .btn-close { background: rgba(255,255,255,.15); color: white; border: 1px solid rgba(255,255,255,.25); }
                .btn:hover { opacity: .9; }
                .page { background: white; margin: 28px auto; box-shadow: 0 8px 40px rgba(0,0,0,.14); max-width: 820px; border-radius: 10px; overflow: hidden; }
                @media print {
                    .no-print-bar { display: none; }
                    .page { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
                    body { background: white; }
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar">
                <h2>👁️ Cornea Clinic — Clinical Report</h2>
                <div class="bar-btns">
                    <button type="button" class="btn btn-print" onclick="window.print()">🖨 Print Report</button>
                    <button type="button" class="btn btn-close" onclick="window.close()">✕ Close</button>
                </div>
            </div>
            <div class="page">${summaryContent}</div>
            ${printScript}
        </body>
        </html>
    `);
    win.document.close();
};

window.printSummary = function() {
    window.generateSummary(true);
};

window.printMedicalAdviceOnly = function() {
    window.syncMedicalAdviceJSON();

    const getValue = id => document.getElementById(id)?.value?.trim() || '';
    const gv = id => escapeHtml(getValue(id) || '—');
    const sex = escapeHtml(document.querySelector('input[name="sex"]:checked')?.value || '—');

    if (!getValue('fullName') && !getValue('patientId')) {
        alert('Please enter patient name or ID before printing medical advice.');
        return;
    }

    const medTable = window.formatMedicalAdviceSummary(false);
    const medSection = medTable
        ? medTable
        : '<p style="padding:14px 12px;margin:0;color:#6b7f96;font-size:13px;font-style:italic;">No medications recorded.</p>';

    const todayStr = new Date().toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const sectionHeader = (title) => `
        <div style="background:linear-gradient(135deg,#e8f1fb,#f0f6ff);padding:11px 16px;margin:22px 0 0;border-radius:8px 8px 0 0;border-left:4px solid #1565c0;">
            <span style="font-weight:700;color:#0a4d8c;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">${title}</span>
        </div>
        <div style="border:1px solid #d0dae8;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">`;

    const printContent = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;color:#0d1b2a;padding:36px;max-width:820px;margin:auto;">
            <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #0a4d8c;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#e8f1fb;border-radius:14px;margin-bottom:10px;">
                    <span style="font-size:24px;">👁️</span>
                </div>
                <h1 style="color:#0a4d8c;margin:0;font-size:24px;font-weight:800;">CORNEA CLINIC</h1>
                <p style="margin:6px 0 0;color:#6b7f96;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Medical Advice / Prescription</p>
                <p style="margin:4px 0 0;color:#9fb0c2;font-size:12px;">Printed: ${escapeHtml(new Date().toLocaleString())}</p>
            </div>

            ${sectionHeader('Patient Details')}
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;width:50%;"><span style="font-weight:600;color:#3d5166;">Patient ID:</span> <code style="background:#eaf1fb;padding:2px 7px;border-radius:4px;font-size:12px;color:#1565c0;">${gv('patientId')}</code></td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Full Name:</span> <strong>${gv('fullName')}</strong></td>
                </tr>
                <tr>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><span style="font-weight:600;color:#3d5166;">Age:</span> ${gv('age')} years</td>
                    <td style="padding:9px 12px;border-bottom:1px solid #e8eef6;font-size:13px;background:#f7fafd;"><span style="font-weight:600;color:#3d5166;">Sex:</span> ${sex}</td>
                </tr>
                <tr>
                    <td style="padding:9px 12px;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Visit Date:</span> ${gv('visitDate')}</td>
                    <td style="padding:9px 12px;font-size:13px;"><span style="font-weight:600;color:#3d5166;">Phone:</span> ${gv('phone')}</td>
                </tr>
            </table>
            </div>

            ${sectionHeader('Prescription / Medical Advice')}
            ${medSection}
            </div>

            ${sectionHeader('Follow Up')}
            ${window.formatFollowUpPrintSection()}
            </div>

            <div style="margin-top:56px;display:flex;justify-content:space-between;gap:40px;">
                <div style="text-align:center;flex:1;">
                    <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;color:#0d1b2a;">Doctor Signature</div>
                    <div style="font-size:11px;color:#9fb0c2;margin-top:4px;">Name / Designation</div>
                </div>
                <div style="text-align:center;flex:1;">
                    <div style="border-top:2px solid #0d1b2a;padding-top:10px;font-weight:700;font-size:13px;color:#0d1b2a;">Date</div>
                    <div style="font-size:12px;color:#3d5166;margin-top:8px;font-weight:600;">${escapeHtml(todayStr)}</div>
                </div>
            </div>
        </div>
    `;

    const patientName = getValue('fullName') || getValue('patientId') || 'Patient';
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
        alert('Pop-up blocked! Please enable pop-ups for this site.');
        return;
    }

    win.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Medical Advice — ${escapeHtml(patientName)}</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; background: #f0f4f8; font-family: 'Segoe UI', sans-serif; }
                .no-print-bar {
                    background: #0a4d8c;
                    padding: 14px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    box-shadow: 0 2px 12px rgba(0,0,0,.2);
                }
                .no-print-bar h2 { color: rgba(255,255,255,.85); font-size: 14px; margin: 0; font-weight: 600; }
                .bar-btns { display: flex; gap: 10px; }
                .btn { padding: 8px 18px; font-weight: 700; cursor: pointer; border-radius: 6px; border: none; font-size: 13px; }
                .btn-print { background: white; color: #0a4d8c; }
                .btn-close { background: rgba(255,255,255,.15); color: white; border: 1px solid rgba(255,255,255,.25); }
                .page { background: white; margin: 28px auto; box-shadow: 0 8px 40px rgba(0,0,0,.14); max-width: 820px; border-radius: 10px; overflow: hidden; }
                @media print {
                    .no-print-bar { display: none; }
                    .page { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
                    body { background: white; }
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar">
                <h2>Medical Advice — ${escapeHtml(patientName)}</h2>
                <div class="bar-btns">
                    <button type="button" class="btn btn-print" onclick="window.print()">Print</button>
                    <button type="button" class="btn btn-close" onclick="window.close()">Close</button>
                </div>
            </div>
            <div class="page">${printContent}</div>
            <script>window.onload = () => setTimeout(() => window.print(), 500);<\/script>
        </body>
        </html>
    `);
    win.document.close();
};
