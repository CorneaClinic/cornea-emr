/**
 * Cornea Clinic — keratoplasty register, tissue inventory & matching
 * Phase 1 extraction from Cornea.html
 */
const STORE_KP_PATIENTS = 'kpPatients';
const STORE_KP_TISSUES = 'kpTissues';

function renderKpPatientReadOnly(p) {
    const panel = document.getElementById('kpPatientReadOnlyDetail');
    const title = document.getElementById('kpPatientReadOnlyTitle');
    if (!p || !panel) return;
    window._kpSelectedPatientId = p.id;
    panel.hidden = false;
    if (title) title.textContent = (p.kpFullName || 'Patient') + ' · ' + (p.kpPatientId || '');
    renderEmrReadOnlyGrid('kpPatientReadOnlyContent', [
        { label: 'Patient ID', value: p.kpPatientId }, { label: 'Full Name', value: p.kpFullName },
        { label: 'Age', value: p.kpAge }, { label: 'Gender', value: p.kpGender }, { label: 'Phone', value: p.kpPhone },
        { label: 'Address', value: p.kpAddress, full: true }, { label: 'Eye', value: p.kpEye },
        { label: 'Diagnosis', value: p.kpDiagnosis }, { label: 'Procedure', value: p.kpProcedure },
        { label: 'Prognosis', value: p.kpPrognosis }, { label: 'Urgency', value: p.kpUrgency },
        { label: 'Status', value: p.kpStatus }, { label: 'Corneal size (mm)', value: p.kpCornealSize },
        { label: 'Donor age pref.', value: p.kpDonorAgePref }, { label: 'Endothelial req.', value: p.kpEndothelialReq },
        { label: 'Infection', value: p.kpInfection }, { label: 'Visual axis', value: p.kpVisualAxis },
        { label: 'Registration', value: p.kpRegDate }, { label: 'Surgery date', value: p.kpSurgeryDate },
        { label: 'Match score', value: p._matchScore ? p._matchScore + '%' : '—' },
        { label: 'Recommended tissue', value: p._recommendedTissue },
        { label: 'Notes', value: p.kpNotes, full: true }
    ]);
}

function renderKpTissueReadOnly(t) {
    const panel = document.getElementById('kpTissueReadOnlyDetail');
    const title = document.getElementById('kpTissueReadOnlyTitle');
    if (!t || !panel) return;
    window._kpSelectedTissueId = t.id;
    panel.hidden = false;
    if (title) title.textContent = t.kpTissueId || 'Tissue';
    const day = kpProcessingDays(t.kpPreservationDate);
    renderEmrReadOnlyGrid('kpTissueReadOnlyContent', [
        { label: 'Tissue ID', value: t.kpTissueId }, { label: 'Donor age', value: t.kpDonorAge },
        { label: 'Donor gender', value: t.kpDonorGender }, { label: 'Death-to-preservation (hrs)', value: t.kpDeathToPreservation },
        { label: 'Preservation date', value: t.kpPreservationDate }, { label: 'Processing day', value: day != null ? 'Day ' + day : '' },
        { label: 'Expiry', value: t.kpExpiryDate }, { label: 'Specular count', value: t.kpSpecular },
        { label: 'Optical grade', value: t.kpOpticalGrade }, { label: 'Therapeutic grade', value: t.kpTherapeuticGrade },
        { label: 'Edema', value: t.kpEdema }, { label: 'Clarity', value: t.kpClarity },
        { label: 'Infection risk', value: t.kpInfectionRisk }, { label: 'Status', value: t.kpTissueStatus },
        { label: 'Storage medium', value: t.kpStorageMedium }, { label: 'Location', value: t.kpStorageLocation },
        { label: 'Eye bank', value: t.kpEyeBank }
    ]);
}

window.openKpPatientModal = function(mode) {
    const title = document.getElementById('kpPatientModalTitle');
    if (mode === 'new') {
        resetKpPatientForm();
        if (title) title.textContent = 'Register Keratoplasty Patient';
    } else {
        const p = _kpPatientsCache.find(x => x.id === window._kpSelectedPatientId);
        if (!p) { alert('Select a patient from the table first.'); return; }
        document.getElementById('kpRecordId').value = p.id;
        Object.keys(p).forEach(k => {
            if (k === 'id' || k.startsWith('_')) return;
            const el = document.getElementById(k);
            if (el && p[k] != null) el.value = p[k];
        });
        if (title) title.textContent = 'Edit Keratoplasty Patient';
    }
    openEmrModal('kpPatientModal');
};

window.openKpTissueModal = function(mode) {
    const title = document.getElementById('kpTissueModalTitle');
    if (mode === 'new') {
        resetKpTissueForm();
        if (title) title.textContent = 'Register Corneal Tissue';
    } else {
        const t = _kpTissuesCache.find(x => x.id === window._kpSelectedTissueId);
        if (!t) { alert('Select tissue from the table first.'); return; }
        document.getElementById('kpTissueRecordId').value = t.id;
        Object.keys(t).forEach(k => {
            if (k === 'id' || k.startsWith('_')) return;
            const el = document.getElementById(k);
            if (el && t[k] != null) el.value = t[k];
        });
        if (title) title.textContent = 'Edit Corneal Tissue';
    }
    openEmrModal('kpTissueModal');
};

window.viewKpPatientReadOnly = function(id) {
    const p = _kpPatientsCache.find(x => x.id === id);
    if (p) { switchKpPanel('kpPatientsPanel'); renderKpPatientReadOnly(p); }
};

window.viewKpTissueReadOnly = function(id) {
    const t = _kpTissuesCache.find(x => x.id === id);
    if (t) { switchKpPanel('kpTissuePanel'); renderKpTissueReadOnly(t); }
};
let _kpPatientsCache = [];
let _kpTissuesCache = [];

function kpDbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!window.db) { resolve([]); return; }
        const tx = window.db.transaction([storeName], 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function kpDbPut(storeName, data) {
    // Editing an existing record: carry over sync metadata so offline edits
    // keep their server identity and sync correctly later.
    if (data.id != null) {
        const existing = await new Promise((resolve) => {
            const req = window.db.transaction([storeName], 'readonly')
                .objectStore(storeName).get(data.id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (existing) {
            if (existing.uuid && !data.uuid) data.uuid = existing.uuid;
            if (existing.revision != null && data.revision == null) data.revision = existing.revision;
            if (existing.client_mutation_id && !data.client_mutation_id) data.client_mutation_id = existing.client_mutation_id;
        }
    }

    if (window.CorneaSync) {
        // Queue the change so it syncs when (or whenever) cloud is connected.
        const entityType = storeName === STORE_KP_PATIENTS ? 'kp_patient' : 'kp_tissue';
        const saved = await CorneaSync.saveKpLocal(storeName, data, entityType);
        return saved.id;
    }

    return new Promise((resolve, reject) => {
        const tx = window.db.transaction([storeName], 'readwrite');
        const req = tx.objectStore(storeName).put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function kpDbDelete(storeName, id) {
    if (window.CorneaSync) {
        const entityType = storeName === STORE_KP_PATIENTS ? 'kp_patient' : 'kp_tissue';
        await CorneaSync.deleteKpLocal(storeName, id, entityType);
        return;
    }
    return new Promise((resolve, reject) => {
        const tx = window.db.transaction([storeName], 'readwrite');
        const req = tx.objectStore(storeName).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function kpBadgeUrgency(u) {
    const m = { Emergency: 'badge-emergency', Urgent: 'badge-urgent', Elective: 'badge-elective' };
    return `<span class="badge ${m[u] || ''}">${escapeHtml(u || '—')}</span>`;
}

function kpBadgeStatus(s, type) {
    const map = type === 'tissue'
        ? { Available: 'badge-available', Reserved: 'badge-reserved', Expired: 'badge-expired', Used: 'badge-waiting', Discarded: 'badge-cancelled' }
        : { Waiting: 'badge-waiting', Matched: 'badge-matched', Scheduled: 'badge-scheduled', Completed: 'badge-completed', Cancelled: 'badge-cancelled' };
    return `<span class="badge ${map[s] || ''}">${escapeHtml(s || '—')}</span>`;
}

function kpBadgeMatch(score) {
    if (score >= 85) return `<span class="badge badge-match-excellent">${score}% Excellent</span>`;
    if (score >= 70) return `<span class="badge badge-match-good">${score}% Good</span>`;
    if (score >= 50) return `<span class="badge badge-match-fair">${score}% Fair</span>`;
    return `<span class="badge badge-match-poor">${score}% Poor</span>`;
}

function kpProcessingDays(preservationDate) {
    if (!preservationDate) return null;
    const d = new Date(preservationDate);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000) + 1;
}

/** Corneal tissue protocol — source: Corneal tissue protocol.docx */
const KP_OPTICAL_GRADE_RULES = [
    { grade: 'I', label: 'PKP Quality I', test: (age, spec) => age < 40 && spec > 3000 },
    { grade: 'II', label: 'PKP Quality II', test: (age, spec) => age >= 41 && age <= 60 && spec > 2000 },
    { grade: 'III', label: 'PKP Quality III', test: (age, spec) => age >= 61 && age <= 75 && spec > 2500 },
    { grade: 'IV', label: 'PKP Quality IV', test: (age, spec) => age >= 61 && age <= 80 && spec >= 2000 && spec <= 2500 }
];

window.calcOpticalGrade = function(donorAge, specular) {
    const age = parseInt(donorAge, 10);
    const spec = parseInt(specular, 10);
    if (isNaN(age) || isNaN(spec) || spec <= 0) return '';
    for (const r of KP_OPTICAL_GRADE_RULES) {
        if (r.test(age, spec)) return r.grade;
    }
    return '';
};

function kpSpecularObtainable(specular) {
    const spec = parseInt(specular, 10);
    return !isNaN(spec) && spec > 0;
}

window.calcTherapeuticGrade = function(donorAge, edema, processingDay, specular) {
    const age = parseInt(donorAge, 10);
    const day = parseInt(processingDay, 10);
    const ed = (edema || '').toLowerCase();
    const spec = specular !== undefined ? specular : null;
    const optical = calcOpticalGrade(donorAge, specular);

    if (!isNaN(day) && day >= 8 && day <= 14 && optical) return 'I';
    if (!isNaN(age) && age < 60 && !kpSpecularObtainable(spec) && (ed === 'mild' || ed === 'moderate')) return 'II';
    if (ed === 'severe' || ed === 'completely edematous') return 'III';
    if (!kpSpecularObtainable(spec) && (ed === 'mild' || ed === 'moderate')) return 'II';
    return '';
};

window.updateKpTissueGrades = function() {
    const age = document.getElementById('kpDonorAge')?.value;
    const spec = document.getElementById('kpSpecular')?.value;
    const edema = document.getElementById('kpEdema')?.value;
    const pres = document.getElementById('kpPreservationDate')?.value;
    const procDay = kpProcessingDays(pres);
    const og = document.getElementById('kpOpticalGrade');
    const tg = document.getElementById('kpTherapeuticGrade');
    if (og) og.value = calcOpticalGrade(age, spec) ? 'Grade ' + calcOpticalGrade(age, spec) : '';
    if (tg) {
        const g = calcTherapeuticGrade(age, edema, procDay, spec);
        tg.value = g ? 'Grade ' + g : '';
    }
};

function kpParseGradeNum(val) {
    if (!val) return 0;
    const s = String(val).toUpperCase();
    if (/\bIV\b|GRADE\s*IV/.test(s)) return 4;
    if (/\bIII\b|GRADE\s*III/.test(s)) return 3;
    if (/\bII\b|GRADE\s*II/.test(s)) return 2;
    if (/\bI\b|GRADE\s*I\b/.test(s)) return 1;
    const d = parseInt(s.replace(/\D/g, ''), 10);
    return (d >= 1 && d <= 4) ? d : 0;
}

function kpGetTissueGrades(tissue) {
    const day = kpProcessingDays(tissue.kpPreservationDate);
    const opt = kpParseGradeNum(tissue.kpOpticalGrade) || kpParseGradeNum(calcOpticalGrade(tissue.kpDonorAge, tissue.kpSpecular));
    const ther = kpParseGradeNum(tissue.kpTherapeuticGrade) ||
        kpParseGradeNum(calcTherapeuticGrade(tissue.kpDonorAge, tissue.kpEdema, day, tissue.kpSpecular));
    return { optical: opt, therapeutic: ther, processingDay: day };
}

function kpParseAgeRange(pref) {
    if (!pref || !String(pref).trim()) return null;
    const m = String(pref).match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
    const single = parseInt(pref, 10);
    if (!isNaN(single)) return { min: single - 10, max: single + 10 };
    return null;
}

function kpCheckAgeMatch(patient, tissue) {
    const donorAge = parseInt(tissue.kpDonorAge, 10);
    const patientAge = parseInt(patient.kpAge, 10);
    if (isNaN(donorAge)) return { pass: false, detail: 'Donor age not recorded' };
    const range = kpParseAgeRange(patient.kpDonorAgePref);
    if (range) {
        const pass = donorAge >= range.min && donorAge <= range.max;
        return { pass, detail: pass
            ? `Donor age ${donorAge} within preferred ${range.min}–${range.max}`
            : `Donor age ${donorAge} outside preferred ${range.min}–${range.max}` };
    }
    if (!isNaN(patientAge)) {
        const diff = Math.abs(patientAge - donorAge);
        const pass = diff <= 15;
        return { pass, detail: pass
            ? `Age matched (patient ${patientAge} y, donor ${donorAge} y, Δ${diff})`
            : `Age mismatch (patient ${patientAge} y, donor ${donorAge} y, Δ${diff} > 15)` };
    }
    return { pass: true, detail: 'Age match not verified — enter patient age or preferred donor range' };
}

function kpGetProcedureProtocol(patient) {
    const proc = patient.kpProcedure;
    const prog = patient.kpPrognosis || '';
    const visualAxis = patient.kpVisualAxis === 'Yes';
    const protocols = {
        'PKP': {
            summary: 'Age matched; optical grade I–IV; within 6th day of processing',
            maxDay: 6, opticalMin: 1, opticalMax: 4, therapeuticRequired: null, requiresAgeMatch: true,
            gradeRule: (o, t) => o >= 1 && o <= 4
        },
        'DSAEK': {
            summary: 'Optical grade I–III; by 6th day of processing',
            maxDay: 6, opticalMin: 1, opticalMax: 3, therapeuticRequired: null, requiresAgeMatch: false,
            gradeRule: (o) => o >= 1 && o <= 3
        },
        'DMEK': {
            summary: 'Optical grade I–III; within 3rd day of processing',
            maxDay: 3, opticalMin: 1, opticalMax: 3, therapeuticRequired: null, requiresAgeMatch: false,
            gradeRule: (o) => o >= 1 && o <= 3
        },
        'DALK': {
            summary: 'Therapeutic grade III; within 14 days',
            maxDay: 14, opticalMin: 0, opticalMax: 0, therapeuticRequired: 3, requiresAgeMatch: false,
            gradeRule: (o, t) => t === 3
        },
        'TPK': {
            summary: prog === 'Poor'
                ? 'Therapeutic grade III; within 14 days (poor prognosis)'
                : 'Optical III–IV or therapeutic I; within 10 days (good/fair prognosis)',
            maxDay: prog === 'Poor' ? 14 : 10,
            opticalMin: 0, opticalMax: 4, therapeuticRequired: prog === 'Poor' ? 3 : null,
            requiresAgeMatch: false,
            gradeRule: (o, t) => prog === 'Poor' ? t === 3 : ((o >= 3 && o <= 4) || t === 1)
        },
        'Tectonic KP': {
            summary: prog === 'Nil'
                ? 'Therapeutic grade III; within 14 days (nil prognosis)'
                : 'Optical I–IV or therapeutic I; within 7 days (good prognosis)',
            maxDay: prog === 'Nil' ? 14 : 7,
            requiresAgeMatch: false,
            gradeRule: (o, t) => prog === 'Nil' ? t === 3 : ((o >= 1 && o <= 4) || t === 1)
        },
        'Patch graft (partial thickness)': {
            summary: 'TPK grade I–III; within 14 days',
            maxDay: 14, requiresAgeMatch: false,
            gradeRule: (o, t) => t >= 1 && t <= 3
        },
        'Patch graft (full thickness)': {
            summary: visualAxis
                ? 'Visual axis involved: PKP criteria (optical I–IV); within 6th day'
                : 'Peripheral: TPK grade; within 14th day',
            maxDay: visualAxis ? 6 : 14, requiresAgeMatch: visualAxis,
            gradeRule: (o, t) => visualAxis ? (o >= 1 && o <= 4) : (t >= 1 && t <= 3)
        }
    };
    return protocols[proc] || null;
}

function kpEvaluateProtocol(patient, tissue) {
    const checklist = [];
    const warnings = [];
    const proc = patient.kpProcedure;
    const protocol = kpGetProcedureProtocol(patient);
    const { optical, therapeutic, processingDay } = kpGetTissueGrades(tissue);
    const day = processingDay;

    if (!proc) {
        return { compatible: false, checklist: [{ pass: false, text: 'Set keratoplasty type on patient' }], warnings, protocol: null };
    }
    if (!protocol) {
        return { compatible: false, checklist: [{ pass: false, text: 'Unknown procedure: ' + proc }], warnings, protocol: null };
    }

    if (tissue.kpTissueStatus === 'Expired' || (tissue.kpExpiryDate && new Date(tissue.kpExpiryDate) < new Date())) {
        warnings.push('Expired tissue — do not use');
        return { compatible: false, checklist: [{ pass: false, text: 'Tissue expired' }], warnings, protocol, optical, therapeutic, processingDay: day };
    }

    const gradeOk = protocol.gradeRule(optical, therapeutic);
    checklist.push({
        pass: gradeOk,
        text: gradeOk
            ? `Button grade OK (optical ${optical || '—'}, therapeutic ${therapeutic || '—'})`
            : `Button grade fails protocol (optical ${optical || '—'}, therapeutic ${therapeutic || '—'})`
    });

    if (protocol.requiresAgeMatch) {
        const ageChk = kpCheckAgeMatch(patient, tissue);
        checklist.push({ pass: ageChk.pass, text: ageChk.detail });
        if (!ageChk.pass) warnings.push('Donor age not matched for PKP');
    }

    const dayOk = day != null && day <= protocol.maxDay;
    checklist.push({
        pass: dayOk,
        text: dayOk
            ? `Processing day ${day} within ${protocol.maxDay}-day window`
            : (day != null ? `Processing day ${day} exceeds ${protocol.maxDay}-day limit` : 'Processing date not set')
    });
    if (!dayOk && day != null) warnings.push('Processing age exceeds protocol window');

    if (patient.kpInfection === 'Yes' && tissue.kpInfectionRisk === 'High') {
        checklist.push({ pass: false, text: 'Infection present with high-risk tissue' });
        warnings.push('Infection-risk mismatch');
    } else if (patient.kpInfection === 'Yes' && tissue.kpInfectionRisk === 'Moderate') {
        checklist.push({ pass: false, text: 'Caution: infection with moderate-risk tissue' });
        warnings.push('Moderate infection risk');
    }

    const spec = parseInt(tissue.kpSpecular, 10) || 0;
    const req = parseInt(patient.kpEndothelialReq, 10) || 0;
    if (req > 0 && spec > 0 && spec < req) {
        checklist.push({ pass: false, text: `Specular ${spec} below required ${req}` });
        warnings.push('Endothelial count below requirement');
    } else if (spec > 0 && spec < 2000 && ['DSAEK', 'DMEK'].includes(proc)) {
        checklist.push({ pass: false, text: `Low specular (${spec}) for ${proc}` });
        warnings.push('Low specular for endothelial keratoplasty');
    }

    const compatible = checklist.every(c => c.pass);
    return { compatible, checklist, warnings, protocol, optical, therapeutic, processingDay: day };
}

function kpRecommendedProcedures(tissue) {
    const { optical, therapeutic, processingDay: day } = kpGetTissueGrades(tissue);
    if (!day) return [];
    const proc = [];
    if (optical >= 1 && optical <= 4 && day <= 6) proc.push('PKP');
    if (optical >= 1 && optical <= 3 && day <= 6) proc.push('DSAEK');
    if (optical >= 1 && optical <= 3 && day <= 3) proc.push('DMEK');
    if (therapeutic === 3 && day <= 14) proc.push('DALK');
    if (((optical >= 3 && optical <= 4) || therapeutic === 1) && day <= 10) proc.push('TPK');
    if (therapeutic === 3 && day <= 14) proc.push('TPK (poor prognosis)');
    if (((optical >= 1 && optical <= 4) || therapeutic === 1) && day <= 7) proc.push('Tectonic KP');
    if (therapeutic === 3 && day <= 14) proc.push('Tectonic KP (nil)');
    if (therapeutic >= 1 && therapeutic <= 3 && day <= 14) proc.push('Patch graft (partial thickness)');
    return [...new Set(proc)];
}

function kpComputeMatchScore(patient, tissue) {
    const eval_ = kpEvaluateProtocol(patient, tissue);
    const reasons = [];
    const warnings = [...eval_.warnings];

    if (tissue.kpTissueStatus !== 'Available' && tissue.kpTissueStatus !== 'Reserved') {
        return {
            score: 0, label: 'Poor', reasons: ['Tissue status: ' + tissue.kpTissueStatus],
            warnings, recommended: false, compatible: false, checklist: eval_.checklist, eval: eval_
        };
    }

    eval_.checklist.forEach(c => reasons.push((c.pass ? '✓ ' : '✗ ') + c.text));

    let score = 0;
    if (eval_.compatible) score += 40;
    else score += 5;

    const opt = eval_.optical || 0;
    const ther = eval_.therapeutic || 0;
    if (opt === 1 || opt === 2) score += 25;
    else if (opt === 3) score += 18;
    else if (opt === 4 || ther >= 1) score += 12;

    const spec = parseInt(tissue.kpSpecular, 10) || 0;
    const req = parseInt(patient.kpEndothelialReq, 10) || 0;
    if (req > 0 && spec > 0) {
        if (spec >= req) score += 15;
        else if (spec >= req * 0.85) score += 8;
    } else if (spec >= 2500) score += 15;
    else if (spec >= 2000) score += 10;
    else if (spec > 0) score += 5;

    const day = eval_.processingDay;
    const maxDay = eval_.protocol?.maxDay || 14;
    if (day != null && day <= maxDay) score += 10;
    else if (day != null && day <= maxDay + 2) score += 5;

    const prog = patient.kpPrognosis;
    if (prog === 'Good') score += 10;
    else if (prog === 'Fair') score += 7;
    else if (prog === 'Poor' || prog === 'Nil') score += 4;
    else score += 5;

    if (patient.kpInfection === 'Yes' && tissue.kpInfectionRisk === 'High') score -= 20;

    const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
    const recommended = eval_.compatible && score >= 70 &&
        tissue.kpTissueStatus !== 'Expired' &&
        !(tissue.kpExpiryDate && new Date(tissue.kpExpiryDate) < new Date());

    return {
        score: Math.min(100, Math.max(0, Math.round(score))),
        label, reasons, warnings, recommended,
        compatible: eval_.compatible, checklist: eval_.checklist, eval: eval_
    };
}

function renderKpMatchProtocolSummary(patient) {
    const box = document.getElementById('kpMatchProtocolSummary');
    if (!box) return;
    if (!patient || !patient.kpProcedure) {
        box.innerHTML = '';
        return;
    }
    const protocol = kpGetProcedureProtocol(patient);
    if (!protocol) {
        box.innerHTML = '<div class="kp-warning">Unknown procedure type.</div>';
        return;
    }
    box.innerHTML = `
        <div class="kp-protocol-box">
            <h4><i class="fa-solid fa-file-medical"></i> Protocol for ${escapeHtml(patient.kpProcedure)}</h4>
            <p class="kp-protocol-criteria">${escapeHtml(protocol.summary)}</p>
            <ul class="kp-protocol-criteria" style="margin-top:8px;">
                <li><strong>Patient:</strong> ${escapeHtml(patient.kpFullName)} · ${escapeHtml(patient.kpEye || '—')} · Prognosis ${escapeHtml(patient.kpPrognosis || '—')} · ${kpBadgeUrgency(patient.kpUrgency)}</li>
                ${patient.kpVisualAxis === 'Yes' ? '<li><strong>Visual axis involved</strong> — patch/full-thickness uses PKP window</li>' : ''}
                ${patient.kpEndothelialReq ? '<li>Required endothelial count: <strong>' + escapeHtml(patient.kpEndothelialReq) + '</strong></li>' : ''}
                ${patient.kpDonorAgePref ? '<li>Preferred donor age: <strong>' + escapeHtml(patient.kpDonorAgePref) + '</strong></li>' : ''}
            </ul>
        </div>`;
}

function renderKpMatchChecklist(checklist) {
    if (!checklist || !checklist.length) return '';
    return '<ul class="kp-checklist">' + checklist.map(c => {
        const cls = c.pass ? 'ok' : 'fail';
        const icon = c.pass ? 'fa-circle-check' : 'fa-circle-xmark';
        return `<li class="${cls}"><i class="fa-solid ${icon}"></i><span>${escapeHtml(c.text)}</span></li>`;
    }).join('') + '</ul>';
}

async function kpNextId(storeName, prefix) {
    const all = await kpDbGetAll(storeName);
    let max = 0;
    all.forEach(r => {
        const id = r.kpPatientId || r.kpTissueId || '';
        const n = parseInt(String(id).replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
}

window.switchKpPanel = function(panelId) {
    document.querySelectorAll('.kp-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.kp-subnav-btn').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.kp-subnav-btn[data-kp-panel="${panelId}"]`);
    if (btn) btn.classList.add('active');
    if (panelId === 'kpMatchPanel') populateKpMatchPatientSelect();
};

window.initKeratoplastyTab = async function() {
    if (!window.db) return;
    try {
        _kpPatientsCache = await kpDbGetAll(STORE_KP_PATIENTS);
        _kpTissuesCache = await kpDbGetAll(STORE_KP_TISSUES);
        await refreshKpPatientMatches();
        renderKpPatientsTable();
        renderKpTissuesTable();
        updateKpStats();
        renderKpCharts();
        renderKpAlerts();
        populateKpProcedureFilter();
        populateKpMatchPatientSelect();
        const reg = document.getElementById('kpRegDate');
        if (reg && !reg.value) reg.value = new Date().toISOString().split('T')[0];
    } catch (e) {
        console.error('Keratoplasty init:', e);
    }
};

async function refreshKpPatientMatches() {
    for (const p of _kpPatientsCache) {
        let best = null;
        for (const t of _kpTissuesCache) {
            if (t.kpTissueStatus !== 'Available' && t.kpTissueStatus !== 'Reserved') continue;
            const m = kpComputeMatchScore(p, t);
            if (!best) { best = { tissue: t, ...m }; continue; }
            if (m.recommended && !best.recommended) { best = { tissue: t, ...m }; continue; }
            if (m.compatible && !best.compatible) { best = { tissue: t, ...m }; continue; }
            if (m.score > best.score) best = { tissue: t, ...m };
        }
        p._matchScore = best ? best.score : 0;
        p._matchLabel = best ? best.label : '—';
        p._recommendedTissue = best && best.recommended ? (best.tissue.kpTissueId || '') : '';
    }
}

function collectKpPatientForm() {
    const ids = ['kpPatientId','kpFullName','kpAge','kpGender','kpPhone','kpAddress','kpEye','kpDiagnosis',
        'kpProcedure','kpPrognosis','kpUrgency','kpCornealSize','kpDonorAgePref','kpEndothelialReq',
        'kpInfection','kpVisualAxis','kpNotes','kpStatus','kpRegDate','kpSurgeryDate'];
    const data = { lastModified: new Date().toISOString() };
    ids.forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
    const rid = document.getElementById('kpRecordId')?.value;
    if (rid) data.id = parseInt(rid, 10);
    return data;
}

function collectKpTissueForm() {
    const ids = ['kpTissueId','kpDonorAge','kpDonorGender','kpDeathToPreservation','kpPreservationDate','kpExpiryDate',
        'kpSpecular','kpEdema','kpClarity','kpInfectionRisk','kpOpticalGrade','kpTherapeuticGrade',
        'kpTissueStatus','kpStorageMedium','kpStorageLocation','kpEyeBank'];
    const data = { lastModified: new Date().toISOString() };
    ids.forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
    const rid = document.getElementById('kpTissueRecordId')?.value;
    if (rid) data.id = parseInt(rid, 10);
    const og = calcOpticalGrade(data.kpDonorAge, data.kpSpecular);
    const tgNum = calcTherapeuticGrade(data.kpDonorAge, data.kpEdema, kpProcessingDays(data.kpPreservationDate), data.kpSpecular);
    data.kpOpticalGrade = og ? 'Grade ' + og : data.kpOpticalGrade;
    data.kpTherapeuticGrade = tgNum ? 'Grade ' + tgNum : data.kpTherapeuticGrade;
    return data;
}

window.saveKpPatient = async function() {
    if (!window.db) { alert('Database not ready.'); return; }
    const name = document.getElementById('kpFullName')?.value?.trim();
    if (!name) { alert('Full name is required.'); return; }
    const data = collectKpPatientForm();
    if (!data.kpPatientId) data.kpPatientId = await kpNextId(STORE_KP_PATIENTS, 'KP-P-');
    const all = await kpDbGetAll(STORE_KP_PATIENTS);
    const dup = all.find(r => r.kpPatientId === data.kpPatientId && r.id !== data.id);
    if (dup) { alert('Patient ID already exists.'); return; }
    if (!data.kpRegDate) data.kpRegDate = new Date().toISOString().split('T')[0];
    try {
        const savedId = await kpDbPut(STORE_KP_PATIENTS, data);
        data.id = savedId;
        alert('Keratoplasty patient saved.');
        closeEmrModal('kpPatientModal');
        resetKpPatientForm();
        await initKeratoplastyTab();
        const saved = _kpPatientsCache.find(x => x.id === savedId);
        if (saved) renderKpPatientReadOnly(saved);
    } catch (e) {
        alert('Error saving patient.');
        console.error(e);
    }
};

window.saveKpTissue = async function() {
    if (!window.db) { alert('Database not ready.'); return; }
    const data = collectKpTissueForm();
    if (!data.kpTissueId) data.kpTissueId = await kpNextId(STORE_KP_TISSUES, 'KP-T-');
    const all = await kpDbGetAll(STORE_KP_TISSUES);
    const dup = all.find(r => r.kpTissueId === data.kpTissueId && r.id !== data.id);
    if (dup) { alert('Tissue ID already exists.'); return; }
    try {
        const savedId = await kpDbPut(STORE_KP_TISSUES, data);
        data.id = savedId;
        alert('Tissue record saved.');
        closeEmrModal('kpTissueModal');
        resetKpTissueForm();
        await initKeratoplastyTab();
        const saved = _kpTissuesCache.find(x => x.id === savedId);
        if (saved) renderKpTissueReadOnly(saved);
    } catch (e) {
        alert('Error saving tissue.');
        console.error(e);
    }
};

window.resetKpPatientForm = function() {
    document.getElementById('kpRecordId').value = '';
    ['kpPatientId','kpFullName','kpAge','kpGender','kpPhone','kpAddress','kpEye','kpDiagnosis',
        'kpProcedure','kpPrognosis','kpUrgency','kpCornealSize','kpDonorAgePref','kpEndothelialReq',
        'kpInfection','kpVisualAxis','kpNotes','kpSurgeryDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const st = document.getElementById('kpStatus');
    if (st) st.value = 'Waiting';
    const rd = document.getElementById('kpRegDate');
    if (rd) rd.value = new Date().toISOString().split('T')[0];
};

window.resetKpTissueForm = function() {
    document.getElementById('kpTissueRecordId').value = '';
    ['kpTissueId','kpDonorAge','kpDonorGender','kpDeathToPreservation','kpPreservationDate','kpExpiryDate',
        'kpSpecular','kpEdema','kpClarity','kpInfectionRisk','kpOpticalGrade','kpTherapeuticGrade',
        'kpStorageMedium','kpStorageLocation','kpEyeBank'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const st = document.getElementById('kpTissueStatus');
    if (st) st.value = 'Available';
};

window.editKpPatient = function(id) {
    viewKpPatientReadOnly(id);
    openKpPatientModal('edit');
};

window.editKpTissue = function(id) {
    viewKpTissueReadOnly(id);
    openKpTissueModal('edit');
};

window.deleteKpPatient = async function(id) {
    if (!confirm('Delete this keratoplasty patient record?')) return;
    await kpDbDelete(STORE_KP_PATIENTS, id);
    await initKeratoplastyTab();
};

window.deleteKpTissue = async function(id) {
    if (!confirm('Delete this tissue record?')) return;
    await kpDbDelete(STORE_KP_TISSUES, id);
    await initKeratoplastyTab();
};

window.matchKpPatient = function(id) {
    switchTab('keratoplastyTab');
    switchKpPanel('kpMatchPanel');
    const sel = document.getElementById('kpMatchPatientSelect');
    if (sel) { sel.value = String(id); runKpMatching(); }
};

function renderKpPatientsTable() {
    const body = document.getElementById('kpPatientsBody');
    if (!body) return;
    if (!_kpPatientsCache.length) {
        body.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="fa-solid fa-user-injured"></i><p>No keratoplasty patients registered.</p></div></td></tr>';
        return;
    }
    body.innerHTML = _kpPatientsCache.map(p => `
        <tr data-kp-procedure="${escapeHtml(p.kpProcedure||'')}" data-kp-urgency="${escapeHtml(p.kpUrgency||'')}"
            data-kp-status="${escapeHtml(p.kpStatus||'')}" data-kp-prognosis="${escapeHtml(p.kpPrognosis||'')}"
            data-kp-search="${escapeHtml((p.kpPatientId+' '+p.kpFullName+' '+p.kpDiagnosis).toLowerCase())}">
            <td><span class="patient-id-badge">${escapeHtml(p.kpPatientId||'—')}</span></td>
            <td>${escapeHtml(p.kpFullName||'—')}</td>
            <td>${escapeHtml(p.kpDiagnosis||'—')}</td>
            <td>${escapeHtml(p.kpProcedure||'—')}</td>
            <td>${escapeHtml(p.kpPrognosis||'—')}</td>
            <td>${kpBadgeUrgency(p.kpUrgency)}</td>
            <td>${kpBadgeStatus(p.kpStatus)}</td>
            <td>${p._matchScore ? kpBadgeMatch(p._matchScore) : '—'}</td>
            <td>${escapeHtml(p._recommendedTissue||'—')}</td>
            <td class="no-print records-actions">
                <button type="button" class="btn-info btn-sm" onclick="viewKpPatientReadOnly(${p.id})"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="btn-secondary btn-sm" onclick="editKpPatient(${p.id})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-secondary btn-sm" onclick="matchKpPatient(${p.id})"><i class="fa-solid fa-link"></i></button>
                <button type="button" class="btn-danger btn-sm" onclick="deleteKpPatient(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
    filterKpPatientsTable();
}

function renderKpTissuesTable() {
    const body = document.getElementById('kpTissuesBody');
    if (!body) return;
    const today = new Date();
    if (!_kpTissuesCache.length) {
        body.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="fa-solid fa-eye-dropper"></i><p>No tissue in inventory.</p></div></td></tr>';
        return;
    }
    body.innerHTML = _kpTissuesCache.map(t => {
        const day = kpProcessingDays(t.kpPreservationDate);
        const spec = parseInt(t.kpSpecular, 10) || 0;
        const expired = t.kpExpiryDate && new Date(t.kpExpiryDate) < today;
        const lowQ = spec > 0 && spec < 2000;
        let rowClass = '';
        if (expired || t.kpTissueStatus === 'Expired') rowClass = 'row-expired';
        else if (lowQ) rowClass = 'row-low-quality';
        const procs = kpRecommendedProcedures(t).join(', ') || '—';
        return `
        <tr class="${rowClass}" data-kp-tstatus="${escapeHtml(t.kpTissueStatus||'')}"
            data-kp-tsearch="${escapeHtml((t.kpTissueId+' '+t.kpEyeBank).toLowerCase())}">
            <td><span class="patient-id-badge">${escapeHtml(t.kpTissueId||'—')}</span></td>
            <td>${escapeHtml(t.kpDonorAge||'—')}</td>
            <td>${escapeHtml(t.kpSpecular||'—')}</td>
            <td>${escapeHtml(t.kpOpticalGrade||'—')}</td>
            <td>${escapeHtml(t.kpTherapeuticGrade||'—')}</td>
            <td>${day != null ? 'Day ' + day : '—'}</td>
            <td>${escapeHtml(t.kpExpiryDate||'—')}</td>
            <td>${kpBadgeStatus(t.kpTissueStatus, 'tissue')}</td>
            <td style="font-size:0.78rem;">${escapeHtml(procs)}</td>
            <td class="no-print records-actions">
                <button type="button" class="btn-info btn-sm" onclick="viewKpTissueReadOnly(${t.id})"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="btn-secondary btn-sm" onclick="editKpTissue(${t.id})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-danger btn-sm" onclick="deleteKpTissue(${t.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
    filterKpTissuesTable();
}

window.filterKpPatientsTable = function() {
    const q = (document.getElementById('kpPatientSearch')?.value || '').toLowerCase();
    const proc = document.getElementById('kpFilterProcedure')?.value || '';
    const urg = document.getElementById('kpFilterUrgency')?.value || '';
    const st = document.getElementById('kpFilterStatus')?.value || '';
    const prog = document.getElementById('kpFilterPrognosis')?.value || '';
    document.querySelectorAll('#kpPatientsBody tr[data-kp-search]').forEach(row => {
        const show = (!q || row.dataset.kpSearch.includes(q))
            && (!proc || row.dataset.kpProcedure === proc)
            && (!urg || row.dataset.kpUrgency === urg)
            && (!st || row.dataset.kpStatus === st)
            && (!prog || row.dataset.kpPrognosis === prog);
        row.style.display = show ? '' : 'none';
    });
};

window.filterKpTissuesTable = function() {
    const q = (document.getElementById('kpTissueSearch')?.value || '').toLowerCase();
    const st = document.getElementById('kpTissueFilterStatus')?.value || '';
    document.querySelectorAll('#kpTissuesBody tr[data-kp-tsearch]').forEach(row => {
        const show = (!q || row.dataset.kpTsearch.includes(q)) && (!st || row.dataset.kpTstatus === st);
        row.style.display = show ? '' : 'none';
    });
};

function populateKpProcedureFilter() {
    const sel = document.getElementById('kpFilterProcedure');
    if (!sel) return;
    const procs = [...new Set(_kpPatientsCache.map(p => p.kpProcedure).filter(Boolean))];
    const cur = sel.value;
    sel.innerHTML = '<option value="">All</option>' + procs.map(p => `<option>${escapeHtml(p)}</option>`).join('');
    if (procs.includes(cur)) sel.value = cur;
}

function populateKpMatchPatientSelect() {
    const sel = document.getElementById('kpMatchPatientSelect');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Choose patient —</option>' +
        _kpPatientsCache.map(p => `<option value="${p.id}">${escapeHtml(p.kpPatientId)} — ${escapeHtml(p.kpFullName)} (${escapeHtml(p.kpProcedure||'no proc')})</option>`).join('');
    if (cur) sel.value = cur;
}

window.runKpMatching = function() {
    const el = document.getElementById('kpMatchPatientSelect');
    const out = document.getElementById('kpMatchResults');
    const banner = document.getElementById('kpMatchBestBanner');
    const toolbar = document.getElementById('kpMatchToolbar');
    const summary = document.getElementById('kpMatchProtocolSummary');
    if (!el || !out) return;

    const pid = parseInt(el.value, 10);
    const patient = _kpPatientsCache.find(p => p.id === pid);

    if (!patient) {
        if (summary) summary.innerHTML = '';
        if (toolbar) toolbar.hidden = true;
        if (banner) banner.innerHTML = '';
        out.innerHTML = '<p class="text-muted">Select a patient to run tissue matching against the corneal tissue protocol.</p>';
        return;
    }

    renderKpMatchProtocolSummary(patient);
    if (toolbar) toolbar.hidden = false;

    if (!patient.kpProcedure) {
        if (banner) banner.innerHTML = '';
        out.innerHTML = '<div class="kp-warning"><i class="fa-solid fa-triangle-exclamation"></i> Set keratoplasty type on the patient record first.</div>';
        return;
    }

    const compatibleOnly = document.getElementById('kpMatchCompatibleOnly')?.checked;
    const availableOnly = document.getElementById('kpMatchAvailableOnly')?.checked;

    let matches = _kpTissuesCache.map(t => ({ tissue: t, ...kpComputeMatchScore(patient, t) }));
    if (availableOnly) {
        matches = matches.filter(m => m.tissue.kpTissueStatus === 'Available' || m.tissue.kpTissueStatus === 'Reserved');
    }
    if (compatibleOnly) {
        matches = matches.filter(m => m.compatible);
    }
    matches.sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        return b.score - a.score;
    });

    if (!_kpTissuesCache.length) {
        if (banner) banner.innerHTML = '';
        out.innerHTML = '<div class="kp-warning">No tissue in inventory. Register corneal tissue first.</div>';
        return;
    }
    if (!matches.length) {
        if (banner) banner.innerHTML = '';
        out.innerHTML = '<div class="kp-warning"><i class="fa-solid fa-triangle-exclamation"></i> No tissue matches current filters. Try clearing &quot;protocol-compatible only&quot; or register more tissue.</div>';
        return;
    }

    const bestCompat = matches.find(m => m.recommended);
    const best = bestCompat || matches[0];

    if (banner) {
        if (bestCompat) {
            banner.innerHTML = `<div class="kp-best-banner">
                <div><strong>Recommended tissue:</strong> ${escapeHtml(bestCompat.tissue.kpTissueId)}
                ${kpBadgeMatch(bestCompat.score)} <span class="badge badge-compatible">Protocol compatible</span></div>
                <button type="button" class="btn-primary btn-sm no-print" onclick="kpReserveTissueForPatient(${patient.id}, ${bestCompat.tissue.id})">
                    <i class="fa-solid fa-bookmark"></i> Reserve for patient
                </button>
            </div>`;
        } else {
            banner.innerHTML = '<div class="kp-warning"><i class="fa-solid fa-triangle-exclamation"></i> No tissue fully meets protocol requirements. Review matches below for closest options.</div>';
        }
    }

    let html = '';
    matches.forEach((m, idx) => {
        const cls = m.compatible ? m.label.toLowerCase() : 'contraindicated';
        const isBest = bestCompat && m.tissue.id === bestCompat.tissue.id;
        const compatBadge = m.compatible
            ? '<span class="badge badge-compatible">Compatible</span>'
            : '<span class="badge badge-incompatible">Not compatible</span>';
        const grades = kpGetTissueGrades(m.tissue);
        html += `<div class="kp-match-card ${cls}${isBest ? ' best-match' : ''}" id="kp-match-${m.tissue.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                <div>
                    <strong>${escapeHtml(m.tissue.kpTissueId)}</strong>
                    ${isBest ? ' <span class="badge badge-matched">Best match</span>' : ''}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">${compatBadge} ${kpBadgeMatch(m.score)}</div>
            </div>
            <p style="font-size:0.82rem;margin:8px 0 4px;color:var(--text-secondary);">
                Donor ${escapeHtml(m.tissue.kpDonorAge||'—')} y · Specular ${escapeHtml(m.tissue.kpSpecular||'—')}
                · Optical ${grades.optical ? 'Grade '+grades.optical : '—'}
                · Therapeutic ${grades.therapeutic ? 'Grade '+grades.therapeutic : '—'}
                · Day ${grades.processingDay ?? '—'} · ${kpBadgeStatus(m.tissue.kpTissueStatus, 'tissue')}
            </p>
            ${renderKpMatchChecklist(m.checklist)}
            ${m.warnings.length ? '<p style="font-size:0.78rem;color:var(--warning);margin-top:8px;"><i class="fa-solid fa-triangle-exclamation"></i> ' + m.warnings.map(escapeHtml).join(' · ') + '</p>' : ''}
            <div class="no-print" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                ${m.compatible ? `<button type="button" class="btn-primary btn-sm" onclick="kpReserveTissueForPatient(${patient.id}, ${m.tissue.id})"><i class="fa-solid fa-bookmark"></i> Reserve</button>` : ''}
                <button type="button" class="btn-secondary btn-sm" onclick="editKpTissue(${m.tissue.id})"><i class="fa-solid fa-pen"></i> View tissue</button>
            </div>
        </div>`;
    });
    out.innerHTML = html;

    if (bestCompat && patient.kpStatus === 'Waiting') {
        patient._recommendedTissue = bestCompat.tissue.kpTissueId;
        patient._matchScore = bestCompat.score;
    }
    renderKpPatientsTable();
};

window.kpReserveTissueForPatient = async function(patientId, tissueId) {
    const patient = _kpPatientsCache.find(p => p.id === patientId);
    const tissue = _kpTissuesCache.find(t => t.id === tissueId);
    if (!patient || !tissue) return;
    if (!confirm(`Reserve tissue ${tissue.kpTissueId} for ${patient.kpFullName}?`)) return;
    tissue.kpTissueStatus = 'Reserved';
    tissue.kpReservedFor = patient.kpPatientId;
    tissue.lastModified = new Date().toISOString();
    patient.kpStatus = 'Matched';
    patient._recommendedTissue = tissue.kpTissueId;
    patient.lastModified = new Date().toISOString();
    try {
        await kpDbPut(STORE_KP_TISSUES, tissue);
        await kpDbPut(STORE_KP_PATIENTS, patient);
        alert('Tissue reserved and patient marked as Matched.');
        await initKeratoplastyTab();
        const sel = document.getElementById('kpMatchPatientSelect');
        if (sel) { sel.value = String(patientId); runKpMatching(); }
    } catch (e) {
        alert('Could not save reservation.');
        console.error(e);
    }
};

window.printKpMatchReport = function() {
    const pid = parseInt(document.getElementById('kpMatchPatientSelect')?.value, 10);
    const patient = _kpPatientsCache.find(p => p.id === pid);
    if (!patient) { alert('Select a patient first.'); return; }
    runKpMatching();
    const content = document.getElementById('kpMatchPanel')?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Match Report — ${escapeHtml(patient.kpFullName)}</title>
        <style>body{font-family:Segoe UI,sans-serif;padding:24px;font-size:12px;}
        .kp-match-card{border:1px solid #ccc;padding:12px;margin:12px 0;page-break-inside:avoid;}
        .no-print{display:none!important;}</style></head><body>
        <h1>Cornea Clinic — Tissue Match Report</h1>
        <p><strong>${escapeHtml(patient.kpFullName)}</strong> · ${escapeHtml(patient.kpProcedure)} · ${new Date().toLocaleString()}</p>
        ${document.getElementById('kpMatchProtocolSummary')?.innerHTML || ''}
        ${document.getElementById('kpMatchBestBanner')?.innerHTML || ''}
        ${document.getElementById('kpMatchResults')?.innerHTML || ''}
        </body></html>`);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 400);
};

function updateKpStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const waiting = _kpPatientsCache.filter(p => p.kpStatus === 'Waiting').length;
    const avail = _kpTissuesCache.filter(t => t.kpTissueStatus === 'Available').length;
    const emerg = _kpPatientsCache.filter(p => p.kpUrgency === 'Emergency').length;
    const done = _kpPatientsCache.filter(p => p.kpStatus === 'Completed').length;
    const soon = new Date(); soon.setDate(soon.getDate() + 7);
    const expiring = _kpTissuesCache.filter(t => {
        if (!t.kpExpiryDate || t.kpTissueStatus !== 'Available') return false;
        const ex = new Date(t.kpExpiryDate);
        return ex >= new Date() && ex <= soon;
    }).length;
    set('kpStatPatients', _kpPatientsCache.length);
    set('kpStatWaiting', waiting);
    set('kpStatTissue', avail);
    set('kpStatExpiring', expiring);
    set('kpStatEmergency', emerg);
    set('kpStatCompleted', done);
}

function renderKpAlerts() {
    const box = document.getElementById('kpAlertsList');
    if (!box) return;
    const alerts = [];
    const today = new Date();
    _kpTissuesCache.forEach(t => {
        if (t.kpExpiryDate && new Date(t.kpExpiryDate) < today && t.kpTissueStatus === 'Available')
            alerts.push('Expired tissue: ' + t.kpTissueId);
        else if (t.kpExpiryDate && t.kpTissueStatus === 'Available') {
            const ex = new Date(t.kpExpiryDate);
            const d = Math.ceil((ex - today) / 86400000);
            if (d >= 0 && d <= 7) alerts.push('Expiring in ' + d + 'd: ' + t.kpTissueId);
        }
        if (parseInt(t.kpSpecular, 10) > 0 && parseInt(t.kpSpecular, 10) < 2000)
            alerts.push('Low specular: ' + t.kpTissueId);
    });
    _kpPatientsCache.filter(p => p.kpUrgency === 'Emergency' && p.kpStatus === 'Waiting')
        .forEach(p => alerts.push('Emergency waiting: ' + p.kpFullName));
    _kpPatientsCache.filter(p => p.kpStatus === 'Waiting' && !p._recommendedTissue && p.kpProcedure)
        .forEach(p => alerts.push('No suitable tissue: ' + p.kpFullName));
    box.innerHTML = alerts.length
        ? alerts.map(a => '<div class="kp-warning" style="margin-bottom:6px;">' + escapeHtml(a) + '</div>').join('')
        : '<p class="text-muted">No alerts.</p>';
}

function kpDrawBarChart(canvasId, labels, values, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(...values, 1);
    const barW = Math.max(12, (w - 40) / values.length - 8);
    const baseY = h - 24;
    values.forEach((v, i) => {
        const barH = (v / max) * (h - 40);
        const x = 20 + i * (barW + 8);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, baseY - barH, barW, barH);
        ctx.fillStyle = '#3d5166';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(labels[i]).slice(0, 8), x + barW / 2, h - 6);
        if (v > 0) { ctx.fillText(String(v), x + barW / 2, baseY - barH - 4); }
    });
}

function renderKpCharts() {
    const procCounts = {};
    _kpPatientsCache.forEach(p => { const k = p.kpProcedure || 'Unset'; procCounts[k] = (procCounts[k] || 0) + 1; });
    const procLabels = Object.keys(procCounts);
    kpDrawBarChart('kpChartProcedure', procLabels, procLabels.map(k => procCounts[k]),
        ['#1565c0','#00838f','#e65100','#6a1b9a','#c62828','#2e7d32']);

    const stCounts = {};
    _kpTissuesCache.forEach(t => { const k = t.kpTissueStatus || 'Unknown'; stCounts[k] = (stCounts[k] || 0) + 1; });
    const stLabels = Object.keys(stCounts);
    kpDrawBarChart('kpChartTissue', stLabels, stLabels.map(k => stCounts[k]),
        ['#2e7d32','#f9a825','#1565c0','#9e9e9e','#c62828','#6a1b9a']);

    const urgCounts = { Emergency: 0, Urgent: 0, Elective: 0 };
    _kpPatientsCache.filter(p => p.kpStatus === 'Waiting').forEach(p => {
        if (urgCounts[p.kpUrgency] !== undefined) urgCounts[p.kpUrgency]++;
    });
    const uLabels = Object.keys(urgCounts);
    kpDrawBarChart('kpChartUrgency', uLabels, uLabels.map(k => urgCounts[k]),
        ['#c62828','#e65100','#1565c0']);
}

function kpDownloadCsv(filename, headers, rows) {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

window.exportKpPatientsCsv = function() {
    const headers = ['Patient ID','Name','Diagnosis','Procedure','Prognosis','Urgency','Status','Match %','Recommended Tissue'];
    const rows = _kpPatientsCache.map(p => [
        p.kpPatientId, p.kpFullName, p.kpDiagnosis, p.kpProcedure, p.kpPrognosis,
        p.kpUrgency, p.kpStatus, p._matchScore || '', p._recommendedTissue || ''
    ]);
    kpDownloadCsv('Keratoplasty_Patients_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
};

window.exportKpTissuesCsv = function() {
    const headers = ['Tissue ID','Donor Age','Specular','Optical Grade','Therapeutic Grade','Processing Day','Expiry','Status'];
    const rows = _kpTissuesCache.map(t => [
        t.kpTissueId, t.kpDonorAge, t.kpSpecular, t.kpOpticalGrade, t.kpTherapeuticGrade,
        kpProcessingDays(t.kpPreservationDate), t.kpExpiryDate, t.kpTissueStatus
    ]);
    kpDownloadCsv('Corneal_Tissue_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
};