/**
 * Cornea Clinic — patient form, read-only views, visit history sidebar
 * Phase 3 extraction from Cornea.html
 */
window._lastAutofillPatientId = '';
window._ageManuallyEdited = false;

/** JSON.stringify that skips circular refs, Files, and DOM nodes (prevents save failures). */
window.safeJsonStringify = function safeJsonStringify(value) {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
        if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) return undefined;
            seen.add(val);
            if (typeof Blob !== 'undefined' && val instanceof Blob) return undefined;
            if (typeof File !== 'undefined' && val instanceof File) return undefined;
            if (typeof Node !== 'undefined' && val instanceof Node) return undefined;
        }
        return val;
    });
};

window.normalizePatientAgeFields = function normalizePatientAgeFields() {
    const valueEl = document.getElementById('ageValue');
    const unitEl = document.getElementById('ageUnit');
    const ageEl = document.getElementById('age');
    if (!valueEl || !unitEl || !ageEl) return;
    const raw = String(valueEl.value || '').trim().replace(/,/g, '.');
    const num = raw === '' ? NaN : Number(raw);
    const unit = unitEl.value || 'years';
    if (!Number.isFinite(num) || num < 0) {
        ageEl.value = '';
        return;
    }
    let years = num;
    if (unit === 'months') years = num / 12;
    else if (unit === 'days') years = num / 365.25;
    ageEl.value = String(Math.round(years * 100) / 100);
};

window.validatePatientAgeFields = function validatePatientAgeFields() {
    const valueEl = document.getElementById('ageValue');
    const unitEl = document.getElementById('ageUnit');
    if (!valueEl || !unitEl) return true;
    const raw = String(valueEl.value || '').trim().replace(/,/g, '.');
    if (!raw) {
        valueEl.setCustomValidity('Please enter age as a number.');
        return false;
    }
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
        valueEl.setCustomValidity('Age must be a valid number (0 or greater).');
        return false;
    }
    const unit = unitEl.value || 'years';
    let years = num;
    if (unit === 'months') years = num / 12;
    else if (unit === 'days') years = num / 365.25;
    if (years > 150) {
        valueEl.setCustomValidity('Age cannot exceed 150 years.');
        return false;
    }
    valueEl.setCustomValidity('');
    return true;
};

window.formatAgeDisplay = function formatAgeDisplay(record) {
    if (!record) return '';
    if (record.ageValue != null && record.ageValue !== '' && record.ageUnit) {
        const n = Number(record.ageValue);
        if (Number.isFinite(n)) {
            const label = record.ageUnit === 'months' ? 'mo' : record.ageUnit === 'days' ? 'days' : 'yrs';
            return `${n} ${label}`;
        }
    }
    if (record.age != null && record.age !== '') return `${record.age} yrs`;
    return '';
};

function applyPatientAgeToForm(data) {
    const valueEl = document.getElementById('ageValue');
    const unitEl = document.getElementById('ageUnit');
    const ageEl = document.getElementById('age');
    if (!valueEl || !unitEl || !ageEl) return;
    if (data.ageValue != null && data.ageValue !== '') {
        valueEl.value = data.ageValue;
        unitEl.value = data.ageUnit || 'years';
    } else if (data.age != null && data.age !== '') {
        valueEl.value = data.age;
        unitEl.value = 'years';
    } else {
        valueEl.value = '';
        unitEl.value = 'years';
        ageEl.value = '';
        return;
    }
    window.normalizePatientAgeFields();
}

function emrRoValue(val) {
    const s = val != null ? String(val).trim() : '';
    if (!s) return '<span class="emr-ro-value empty">—</span>';
    return `<span class="emr-ro-value">${escapeHtml(s)}</span>`;
}

const SECTION_THEME_BY_TITLE = {
    'Medical Advice': 'section-theme-diagnosis',
    'Follow Up': 'section-theme-followup',
    'Documents & Clinical Images': 'section-theme-documents',
    'Contact Lens': 'section-theme-contactlens',
    'Laser Refractive Work-up': 'section-theme-refractive',
};

function getSectionThemeClass(source) {
    if (typeof source === 'string') return SECTION_THEME_BY_TITLE[source] || '';
    if (source?.classList) {
        return [...source.classList].find((c) => c.startsWith('section-theme-')) || '';
    }
    return '';
}

function buildEmrRoSection(title, icon, content, attributionHtml, themeClass) {
    const attr = attributionHtml ? `<div>${attributionHtml}</div>` : '';
    const theme = themeClass || getSectionThemeClass(title);
    const cls = theme ? `emr-ro-section ${theme}` : 'emr-ro-section';
    return `<div class="${cls}">
        <div class="emr-ro-section-header"><h4><i class="fa-solid ${icon || 'fa-file-lines'}"></i> ${escapeHtml(title)}${attr}</h4></div>
        <div class="emr-ro-section-body" style="padding:12px 16px">${content}</div>
    </div>`;
}

window.buildEmrRoSection = buildEmrRoSection;
window.getSectionThemeClass = getSectionThemeClass;

function buildEmrRoField(label, value, fullWidth) {
    return `<div class="emr-ro-field${fullWidth ? ' span-full' : ''}">
        <div class="emr-ro-label">${escapeHtml(label)}</div>
        ${emrRoValue(value)}
    </div>`;
}

function getFindingStatus(fieldId, value) {
    const v = (value != null ? String(value) : '').trim();
    if (!v) return { status: 'empty', text: '—' };
    const baseKey = fieldId.replace(/RE$|LE$/, '');
    const normal = NORMAL_ANT_SEGMENT[baseKey] || NORMAL_FUNDUS[baseKey];
    if (normal) {
        if (v.toLowerCase() === normal.toLowerCase()) return { status: 'normal', text: v };
        return { status: 'abnormal', text: v };
    }
    return { status: 'documented', text: v };
}

function formatFindingCell(fieldId, data) {
    const val = data && fieldId ? data[fieldId] : '';
    const f = getFindingStatus(fieldId, val);
    if (f.status === 'empty') return '<span class="emr-ro-value empty">—</span>';
    const badgeCls = f.status === 'normal' ? 'normal' : f.status === 'abnormal' ? 'abnormal' : 'documented';
    const badgeLabel = f.status === 'normal' ? 'Normal' : f.status === 'abnormal' ? 'Abnormal' : 'Recorded';
    return `<div class="emr-finding-cell finding-${f.status}">
        <span class="finding-badge ${badgeCls}">${badgeLabel}</span>
        <span class="finding-text">${escapeHtml(f.text)}</span>
    </div>`;
}

function isExamFindingAbnormal(fieldId, value) {
    return getFindingStatus(fieldId, value).status === 'abnormal';
}

function formatFindingCellPlain(fieldId, data) {
    const v = (data && fieldId && data[fieldId] != null ? String(data[fieldId]) : '').trim();
    if (!v) return '<span class="emr-ro-value empty">—</span>';
    const abnormal = isExamFindingAbnormal(fieldId, v);
    const cls = abnormal ? 'emr-ro-value finding-abnormal' : 'emr-ro-value';
    return `<span class="${cls}">${escapeHtml(v)}</span>`;
}

function formatRefractionReadOnlySection(data) {
    if (window.CorneaVisualAcuity?.formatReadOnly) {
        return window.CorneaVisualAcuity.formatReadOnly(data);
    }
    return '<p class="emr-ro-value empty">No refraction data recorded.</p>';
}

function buildReadOnlyClinicTable(table, data, plainFindings) {
    if (!table) return { html: '' };
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const cellFn = plainFindings ? formatFindingCellPlain : formatFindingCell;
    let bodyRows = '';
    table.querySelectorAll('tbody tr').forEach(tr => {
        const label = tr.querySelector('td:first-child')?.textContent?.trim() || '';
        const inputs = tr.querySelectorAll('input[id], textarea[id]');
        if (inputs.length >= 2) {
            const reId = inputs[0].id;
            const leId = inputs[1].id;
            const reTdCls = plainFindings && isExamFindingAbnormal(reId, data[reId]) ? ' class="td-finding-abnormal"' : '';
            const leTdCls = plainFindings && isExamFindingAbnormal(leId, data[leId]) ? ' class="td-finding-abnormal"' : '';
            bodyRows += `<tr>
                <td><strong>${escapeHtml(label)}</strong></td>
                <td${reTdCls}>${cellFn(reId, data)}</td>
                <td${leTdCls}>${cellFn(leId, data)}</td>
            </tr>`;
        } else if (inputs.length === 1) {
            const id = inputs[0].id;
            const v = (data[id] || '').trim();
            bodyRows += `<tr>
                <td><strong>${escapeHtml(label)}</strong></td>
                <td colspan="2">${v ? escapeHtml(v) : '<span class="emr-ro-value empty">—</span>'}</td>
            </tr>`;
        }
    });
    if (!bodyRows) return { html: '' };
    const headHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    return {
        html: `<div class="table-scroll"><table class="records-table emr-findings-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
    };
}

function collectFormDataObject() {
    window.CorneaAnteriorSegment?.syncToLegacyFields?.();
    window.CorneaPosteriorSegment?.syncToLegacyFields?.();
    window.CorneaContactLens?.syncToHiddenField?.();
    window.CorneaScleralLens?.syncToHiddenField?.();
    window.CorneaLaserRefractive?.syncToHiddenField?.();
    window.CorneaVisitMedia?.syncToHiddenField?.();
    window.CorneaOpinionReferral?.syncToHiddenField?.();
    window.normalizePatientAgeFields?.();
    const form = document.getElementById('patientForm');
    if (!form) return {};
    const data = {};
    const skipIds = new Set(['visitMediaFileInput', 'currentRecordId', 'currentRecordUuid']);
    form.querySelectorAll('input, textarea, select').forEach(input => {
        if (skipIds.has(input.id)) return;
        if (input.closest('#opinionReferralRoot') && input.id !== 'opinionReferralJSON') return;
        if (input.type === 'radio') {
            if (input.checked) data[input.name] = input.value;
        } else if (input.type === 'checkbox' && input.id) {
            data[input.id] = input.checked;
        } else if (input.type === 'file') {
            return;
        } else if (input.id) {
            data[input.id] = input.value;
        }
    });
    // Hidden identity fields live outside the scanned value map (skipIds); read from DOM.
    const rawId = document.getElementById('currentRecordId')?.value
        || (window._currentViewRecordId != null ? String(window._currentViewRecordId) : '');
    if (rawId && data.id == null) {
        const parsed = parseInt(String(rawId), 10);
        if (!Number.isNaN(parsed)) data.id = parsed;
    }
    const rawUuid = document.getElementById('currentRecordUuid')?.value?.trim() || '';
    if (rawUuid && !data.uuid) data.uuid = rawUuid;
    return data;
}

function populateFormFromData(data) {
    const form = document.getElementById('patientForm');
    if (!form || !data) return;
    if (data.dob && (data.age == null || data.age === '')) {
        const d = new Date(data.dob);
        if (!isNaN(d.getTime())) {
            const today = new Date();
            let derivedAge = today.getFullYear() - d.getFullYear();
            const m = today.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) derivedAge--;
            data.age = derivedAge;
            data.ageValue = derivedAge;
            data.ageUnit = 'years';
        }
    }
    applyPatientAgeToForm(data);
    window._ageManuallyEdited = false;
    Object.keys(data).forEach(key => {
        if (key === 'currentRecordId' || key === 'currentRecordUuid' || key === 'id') return;
        if (key === 'age' || key === 'ageValue' || key === 'ageUnit') return;
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = data[key] === true || data[key] === 'true' || data[key] === 'on';
            } else {
                el.value = data[key] ?? '';
            }
            if ([...ANT_SEGMENT_FIELDS, ...FUNDUS_FIELDS].includes(key)) {
                window.checkNormalModification(key);
            }
        } else {
            const radio = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
            if (radio) radio.checked = true;
        }
    });
    window.loadMedicalAdviceFromJSON(data.medicalAdviceJSON || '[]');
    window.restoreFollowUpUI();
    window.refreshExamFindingHighlights();
    renderAnteriorDrawingPreview();
    if (data.distantRemarks && !data.refractionAdvise) {
        const adviseEl = document.getElementById('refractionAdvise');
        if (adviseEl) adviseEl.value = data.distantRemarks;
    }
    if (window.CorneaVisitMedia) {
        window.CorneaVisitMedia.loadFromRecord(data);
    }
    if (window.CorneaSectionAttribution) {
        window.CorneaSectionAttribution.renderForm(data.sectionAttribution);
    }
    if (window.CorneaVisualAcuity) {
        window.CorneaVisualAcuity.onFormPopulated(data);
    }
    if (window.CorneaAnteriorSegment) {
        window.CorneaAnteriorSegment.onFormPopulated(data);
    }
    if (window.CorneaPosteriorSegment) {
        window.CorneaPosteriorSegment.onFormPopulated(data);
    }
    if (window.CorneaContactLens) {
        window.CorneaContactLens.onFormPopulated(data);
    }
    if (window.CorneaScleralLens) {
        window.CorneaScleralLens.onFormPopulated(data);
    }
    if (window.CorneaLaserRefractive) {
        window.CorneaLaserRefractive.onFormPopulated(data);
    }
    if (window.CorneaOpinionReferral) {
        window.CorneaOpinionReferral.onFormPopulated(data);
    }
    window.CorneaMobileVisitSummary?.refreshFab?.(); // B2 FAB visibility
}

window.renderPatientReadOnly = function(data, containerId) {
    const container = document.getElementById(containerId || 'patientReadOnlyContent');
    if (!container) return;
    if (!data || (!data.fullName && !data.patientId)) {
        container.innerHTML = `<div class="emr-empty-state">
            <i class="fa-solid fa-file-medical"></i>
            <p>No visit selected. Register a new patient visit or open a record from Patient Records.</p>
            <button type="button" class="btn-primary" onclick="openPatientFormModal('new')"><i class="fa-solid fa-user-plus"></i> New Patient Visit</button>
        </div>`;
        return;
    }
    const form = document.getElementById('patientForm');
    let html = '';
    if (form) {
        form.querySelectorAll('.form-card').forEach(card => {
            const title = card.querySelector('.form-card-header h3')?.textContent?.trim() || 'Section';
            const iconEl = card.querySelector('.section-icon i');
            const icon = iconEl ? iconEl.className.replace('fa-solid ', '') : 'fa-file-lines';
            const sectionKey = window.CorneaSectionAttribution?.keyForTitle?.(title);
            const attrHtml = sectionKey && window.CorneaSectionAttribution
                ? window.CorneaSectionAttribution.formatHeaderHtml(data.sectionAttribution?.[sectionKey])
                : '';
            const themeClass = getSectionThemeClass(card);
            let sectionHtml = '';
            let fieldsHtml = '';

            if (title === 'Vision & Refraction') {
                sectionHtml += formatRefractionReadOnlySection(data);
                if (sectionHtml) html += buildEmrRoSection(title, icon, sectionHtml, attrHtml, themeClass);
                return;
            }

            if (title === 'Anterior Segment Examination') {
                const tableHtml = window.CorneaAnteriorSegment?.formatReadOnlyTable?.(data);
                if (tableHtml) {
                    sectionHtml += tableHtml;
                }
                const remRe = data.remarksAntRE?.trim();
                const remLe = data.remarksAntLE?.trim();
                if (remRe || remLe) {
                    sectionHtml += `<div class="asb-ro-remarks table-wrapper mt-2">
                        <table class="clinic-table asb-ro-table">
                            <thead><tr><th scope="col">Remarks</th><th scope="col">OD (Right)</th><th scope="col">OS (Left)</th></tr></thead>
                            <tbody><tr>
                                <th scope="row">Additional notes</th>
                                <td>${remRe ? escapeHtml(remRe) : '<span class="emr-ro-value empty">—</span>'}</td>
                                <td>${remLe ? escapeHtml(remLe) : '<span class="emr-ro-value empty">—</span>'}</td>
                            </tr></tbody>
                        </table>
                    </div>`;
                }
                if (sectionHtml) html += buildEmrRoSection(title, icon, sectionHtml, attrHtml, themeClass);
                return;
            }

            if (title === 'Fundus Examination') {
                const tableHtml = window.CorneaPosteriorSegment?.formatReadOnlyTable?.(data);
                if (tableHtml) sectionHtml += tableHtml;
                const remRe = data.fundusRemarksRE?.trim();
                const remLe = data.fundusRemarksLE?.trim();
                if (remRe || remLe) {
                    sectionHtml += `<div class="asb-ro-remarks table-wrapper mt-2">
                        <table class="clinic-table asb-ro-table">
                            <thead><tr><th scope="col">Remarks</th><th scope="col">OD (Right)</th><th scope="col">OS (Left)</th></tr></thead>
                            <tbody><tr>
                                <th scope="row">Additional notes</th>
                                <td>${remRe ? escapeHtml(remRe) : '<span class="emr-ro-value empty">—</span>'}</td>
                                <td>${remLe ? escapeHtml(remLe) : '<span class="emr-ro-value empty">—</span>'}</td>
                            </tr></tbody>
                        </table>
                    </div>`;
                }
                if (sectionHtml) html += buildEmrRoSection(title, icon, sectionHtml, attrHtml, themeClass);
                return;
            }

            if (title === 'Documents & Clinical Images') {
                return;
            }

            if (title === 'Contact Lens') {
                if (window.CorneaContactLens) {
                    const clHtml = window.CorneaContactLens.formatReadOnly(data);
                    if (clHtml) html += clHtml;
                }
                if (window.CorneaScleralLens) {
                    const slHtml = window.CorneaScleralLens.formatReadOnly(data);
                    if (slHtml) html += slHtml;
                }
                return;
            }

            if (title === 'Laser Refractive Work-up') {
                if (window.CorneaLaserRefractive) {
                    const lrHtml = window.CorneaLaserRefractive.formatReadOnly(data);
                    if (lrHtml) html += lrHtml;
                }
                return;
            }

            if (title === 'Opinion & Referral Notes') {
                if (window.CorneaOpinionReferral) {
                    const orHtml = window.CorneaOpinionReferral.formatReadOnly(data);
                    if (orHtml) html += orHtml;
                }
                return;
            }

            if (title === 'Diagnosis & Management Plan') {
                if (data.diagnosis?.trim()) fieldsHtml += buildEmrRoField('Diagnosis', data.diagnosis, true);
                if (data.specialRemarks?.trim()) fieldsHtml += buildEmrRoField('Special Remarks', data.specialRemarks, true);
                if (data.advise?.trim()) fieldsHtml += buildEmrRoField('Advice & Instructions to Patient', data.advise, true);
                if (fieldsHtml) sectionHtml += `<div class="emr-ro-grid">${fieldsHtml}</div>`;
                if (sectionHtml) html += buildEmrRoSection(title, icon, sectionHtml, attrHtml, themeClass);
                return;
            }

            const clinicTable = card.querySelector('table.clinic-table');
            if (clinicTable) {
                const isExam = title.includes('Anterior') || title.includes('Fundus');
                const tbl = buildReadOnlyClinicTable(clinicTable, data, isExam);
                if (tbl.html) sectionHtml += tbl.html;
            }
            if (title === 'Anterior Segment Drawing') {
                const img = data.anteriorDrawingImage || '';
                sectionHtml += img
                    ? `<div class="drawing-inline-preview drawing-inline-preview-fill"><img src="${img}" alt="Anterior segment drawing"></div>`
                    : `<div class="drawing-inline-preview drawing-inline-preview-fill empty">No drawing saved.</div>`;
            }

            card.querySelectorAll('.form-group').forEach(fg => {
                if (fg.closest('.medical-advice-block')) return;
                if (fg.closest('.visit-media-upload-row')) return;
                if (fg.closest('#opinionReferralRoot')) return;
                const labelEl = fg.querySelector('label, .followup-label');
                const label = labelEl ? labelEl.textContent.replace(/\*/g, '').trim() : '';
                const input = fg.querySelector('[id]');
                if (input && input.id === 'diagnosisIcdStatus') return;
                if (input && input.id === 'medicalAdviceJSON') return;
                if (input && input.id) {
                    const full = input.tagName === 'TEXTAREA';
                    const val = data[input.id];
                    if (full || (val && String(val).trim())) {
                        fieldsHtml += buildEmrRoField(label || input.id, val, full);
                    }
                } else {
                    const rname = fg.querySelector('input[type="radio"]')?.name;
                    if (rname && data[rname]) fieldsHtml += buildEmrRoField(label || rname, data[rname]);
                }
            });

            if (fieldsHtml) sectionHtml += `<div class="emr-ro-grid">${fieldsHtml}</div>`;
            if (sectionHtml) html += buildEmrRoSection(title, icon, sectionHtml, attrHtml, themeClass);
        });
    }

    let medSummary = '';
    if (data.medicalAdviceJSON) {
        try {
            const rows = JSON.parse(data.medicalAdviceJSON);
            if (Array.isArray(rows) && rows.length) {
                medSummary = window.formatMedicalAdviceSummary(false);
            }
        } catch (_) {}
    }
    if (!medSummary) medSummary = window.formatMedicalAdviceSummary(false);
    if (medSummary) {
        html += buildEmrRoSection('Medical Advice', 'fa-pills', `<div style="overflow-x:auto;">${medSummary}</div>`, '', 'section-theme-diagnosis');
    }

    if (window.CorneaVisitMedia) {
        const mediaHtml = window.CorneaVisitMedia.formatReadOnly(data);
        if (mediaHtml) html += mediaHtml;
    }

    const fu = window.formatFollowUpPrintSection ? window.formatFollowUpPrintSection() : '';
    if (fu && (data.followUpDate || data.followUpCustomDate)) {
        html += buildEmrRoSection('Follow Up', 'fa-calendar-check', fu, '', 'section-theme-followup');
    } else if (data.followUpDate || data.followUpPlace || data.followUpRemarks) {
        html += buildEmrRoSection('Follow Up', 'fa-calendar-check', `<div class="emr-ro-grid">
            ${buildEmrRoField('Follow-up date', data.followUpDate || data.followUpCustomDate)}
            ${buildEmrRoField('Place', data.followUpPlace)}
            ${buildEmrRoField('Purpose', data.followUpPurpose)}
            ${buildEmrRoField('Severity', data.followUpSeverity)}
            ${buildEmrRoField('Remarks', data.followUpRemarks, true)}
        </div>`, '', 'section-theme-followup');
    }

    container.innerHTML = html;
    if (window.CorneaVisitMedia?.initReadOnlyBrowser) {
        window.CorneaVisitMedia.initReadOnlyBrowser(container, data);
    }
    const titleEl = document.getElementById('patientReadOnlyTitle');
    if (titleEl) titleEl.textContent = (data.fullName || 'Patient') + ' · ' + (data.visitDate || '');
};

function updatePatientReadOnlyToolbar(hasRecord) {
    ['btnEditPatientVisit', 'btnPreviewPatient', 'btnPrintPatient'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = !hasRecord;
    });
}

function stripRecordForNewVisit(record) {
    if (!record || typeof record !== 'object') return {};
    const copy = JSON.parse(JSON.stringify(record));
    delete copy.id;
    delete copy.uuid;
    delete copy.sectionAttribution;
    copy.visitDate = new Date().toISOString().split('T')[0];
    copy.visitMediaJSON = '{"items":[]}';
    [
        'followUpDate', 'followUpCustomDate', 'followUpInterval', 'followUpDateDisplay',
        'followUpSeverity', 'followUpPlace', 'followUpPurpose', 'followUpRemarks',
    ].forEach((key) => { copy[key] = ''; });
    return copy;
}

function prepareNewVisitFromRecord(record) {
    if (!record) return;
    populateFormFromData(stripRecordForNewVisit(record));
    const idField = document.getElementById('currentRecordId');
    const uuidField = document.getElementById('currentRecordUuid');
    if (idField) idField.value = '';
    if (uuidField) uuidField.value = '';
    window._currentViewRecordId = null;
    window._ageManuallyEdited = false;
    window._lastAutofillPatientId = record.patientId || '';
    setPatientIdAutofillHint(
        `New visit — pre-filled from last visit (${formatVisitDisplayDate(record.visitDate)}). Update only what changed.`,
        true
    );
}

window.openPatientFormModal = function(mode) {
    if (!window.CorneaOfflineAuth?.hasPermission?.('visits:write')) {
        alert('You do not have permission to edit patient records.');
        return;
    }
    const title = document.getElementById('emrPatientModalTitle');
    if (mode === 'new') {
        const priorRecordId = window._currentViewRecordId
            || document.getElementById('currentRecordId')?.value
            || null;
        const priorPatientId = document.getElementById('patientId')?.value?.trim() || '';

        if (title) title.innerHTML = '<i class="fa-solid fa-user-plus"></i> New Patient Visit';
        openEmrModal('emrPatientModal');
        try {
            window.clearForm(false);
        } catch (err) {
            console.error('[PatientForm] clearForm failed while opening new visit:', err);
        }

        const afterOpen = () => {
            repositionOpenLidAutocompleteLists();
            repositionOpenDiagnosisAutocomplete();
            window.refreshExamFindingHighlights();
            window.CorneaMobileVisitSummary?.refreshFab?.();
        };

        const seedNewVisit = (record) => {
            if (record) prepareNewVisitFromRecord(record);
            window.refreshPatientVisitHistory();
            afterOpen();
        };

        if (priorPatientId && window.db) {
            loadPatientVisits(priorPatientId, (visits) => {
                seedNewVisit(visits.length ? visits[visits.length - 1] : null);
            });
            return;
        }

        if (priorRecordId && window.db) {
            window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME)
                .get(Number(priorRecordId)).onsuccess = (e) => seedNewVisit(e.target.result || null);
            return;
        }

        requestAnimationFrame(async () => {
            const pidEl = document.getElementById('patientId');
            if (pidEl && !pidEl.value.trim() && window.CorneaPatientId?.nextLocalMrn) {
                pidEl.value = await window.CorneaPatientId.nextLocalMrn();
                setPatientIdAutofillHint('Suggested Patient ID — use the same ID in all registries and patient records.', false);
            }
            window.refreshPatientVisitHistory();
            afterOpen();
        });
        return;
    } else {
        if (!document.getElementById('currentRecordId')?.value && !window._currentViewRecordId) {
            alert('Select or open a record to edit.');
            return;
        }
        if (title) title.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Patient Visit';
    }
    openEmrModal('emrPatientModal');
    requestAnimationFrame(() => {
        repositionOpenLidAutocompleteLists();
        repositionOpenDiagnosisAutocomplete();
        window.refreshPatientVisitHistory();
        window.refreshExamFindingHighlights();
        window.CorneaMobileVisitSummary?.refreshFab?.();
    });
};

window.viewRecordReadOnly = async function(id, target) {
    if (!window.db) return;
    const data = window.CorneaSecurePatients?.get
        ? await window.CorneaSecurePatients.get(id)
        : await new Promise((resolve) => {
            window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id).onsuccess = (e) => resolve(e.target.result);
        });
    if (!data) return;
    window._currentViewRecordId = data.id;
    document.getElementById('currentRecordId').value = data.id;
    const uuidEl = document.getElementById('currentRecordUuid');
    if (uuidEl) uuidEl.value = data.uuid || '';
    populateFormFromData(data);
    window.refreshPatientVisitHistory();
    if (target === 'records') {
        const panel = document.getElementById('recordReadOnlyPanel');
        const title = document.getElementById('recordReadOnlyTitle');
        if (panel) panel.hidden = false;
        if (title) title.textContent = (data.fullName || 'Patient') + ' · ' + (data.visitDate || '');
        renderPatientReadOnly(data, 'recordReadOnlyContent');
        switchTab('recordsTab');
    } else {
        renderPatientReadOnly(data, 'patientReadOnlyContent');
        updatePatientReadOnlyToolbar(true);
        switchTab('formTab');
    }
};

function renderEmrReadOnlyGrid(containerId, fields) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="emr-ro-grid">${fields.map(f => buildEmrRoField(f.label, f.value, f.full)).join('')}</div>`;
}

// --- Visit History Sidebar ---
window._patientVisitsCache = [];

const PATIENT_INFO_AUTOFILL_FIELDS = ['fullName', 'age', 'phone', 'address'];

function sortVisitsChronological(visits) {
    return visits.slice().sort((a, b) => {
        const da = a.visitDate || '';
        const db = b.visitDate || '';
        if (da !== db) return da.localeCompare(db);
        return (a.id || 0) - (b.id || 0);
    });
}

function setPatientIdAutofillHint(message, visible = true) {
    const el = document.getElementById('patientIdAutofillHint');
    if (!el) return;
    if (!visible || !message) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.textContent = message;
}

function applyPatientInfoFromVisit(record) {
    if (!record) return;
    ['fullName', 'phone', 'address'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && record[id] != null) el.value = record[id];
    });
    if (!window._ageManuallyEdited) {
        applyPatientAgeToForm(record);
    }
    if (record.sex) {
        document.querySelectorAll('input[name="sex"]').forEach((r) => {
            r.checked = r.value === record.sex;
        });
    }
    const visitDateEl = document.getElementById('visitDate');
    if (visitDateEl) visitDateEl.value = new Date().toISOString().split('T')[0];
}

function loadPatientVisits(patientId, callback) {
    if (!window.db || !patientId) {
        callback([]);
        return;
    }
    if (window.CorneaSecurePatients?.getAllByIndex) {
        window.CorneaSecurePatients.getAllByIndex('patientId', patientId)
            .then((rows) => callback(sortVisitsChronological(rows || [])))
            .catch(() => callback([]));
        return;
    }
    const req = window.db.transaction([STORE_NAME], 'readonly')
        .objectStore(STORE_NAME).index('patientId').getAll(patientId);
    req.onsuccess = () => callback(sortVisitsChronological(req.result || []));
    req.onerror = () => callback([]);
}

window.autofillPatientInfoFromPreviousVisit = function(patientId, visits) {
    const currentRecordId = document.getElementById('currentRecordId')?.value;
    if (currentRecordId) {
        setPatientIdAutofillHint('', false);
        return;
    }
    if (!patientId || !visits?.length) {
        if (!visits?.length && patientId) setPatientIdAutofillHint('No previous visits for this ID — enter details as a new patient.', true);
        else setPatientIdAutofillHint('', false);
        return;
    }

    if (window._lastAutofillPatientId === patientId) return;

    const latest = visits[visits.length - 1];
    prepareNewVisitFromRecord(latest);
};

function truncateVisitText(str, maxLen = 100) {
    const t = String(str ?? '').trim();
    if (!t) return '';
    return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
}

function formatVisitDisplayDate(iso) {
    if (!iso) return 'No date';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function countMedicalAdviceRows(jsonStr) {
    try {
        const arr = JSON.parse(jsonStr || '[]');
        if (!Array.isArray(arr)) return 0;
        return arr.filter(r => r.drugName || r.eye || r.instruction).length;
    } catch (_) {
        return 0;
    }
}

function buildVisitSummaryHtml(record) {
    const e = escapeHtml;
    const medCount = countMedicalAdviceRows(record.medicalAdviceJSON);
    const vaRe = record.visionREBCVA || record.visionREUCVA || '—';
    const vaLe = record.visionLEBCVA || record.visionLEUCVA || '—';
    const iop = (record.iopRE || record.iopLE)
        ? `${e(record.iopRE || '—')} / ${e(record.iopLE || '—')} mmHg`
        : '—';
    const followDate = record.followUpDate ? formatVisitDisplayDate(record.followUpDate) : '—';
    const row = (label, value) => {
        const v = String(value ?? '').trim();
        if (!v || v === '—') return '';
        return `<dt>${e(label)}</dt><dd>${e(v)}</dd>`;
    };

    return `
        <dl class="visit-summary-dl">
            ${row('Visit date', formatVisitDisplayDate(record.visitDate))}
            ${row('Patient', record.fullName)}
            ${row('Age / Sex', (window.formatAgeDisplay(record) || '') + (record.sex ? ((window.formatAgeDisplay(record) || record.age) ? ', ' : '') + record.sex : '') || '—')}
            ${row('Chief complaint', record.chiefComplaint)}
            ${row('Duration', record.durationSymptoms)}
            ${row('Diagnosis', record.diagnosis)}
            ${row('Visual acuity (RE / LE)', vaRe + ' / ' + vaLe)}
            ${row('IOP (RE / LE)', (record.iopRE || record.iopLE) ? iop : '')}
            ${row('Cornea (RE / LE)', (record.corneaRE || '—') + ' · ' + (record.corneaLE || '—'))}
            ${row('Lens (RE / LE)', (record.lensRE || '—') + ' · ' + (record.lensLE || '—'))}
            ${row('Medications', medCount ? medCount + ' item(s) prescribed' : '')}
            ${row('Advice', truncateVisitText(record.advise, 200))}
            ${row('Follow-up', followDate !== '—' ? followDate + (record.followUpPlace ? ' @ ' + record.followUpPlace : '') : '')}
            ${row('Follow-up purpose', record.followUpPurpose)}
            ${row('Special remarks', truncateVisitText(record.specialRemarks, 160))}
        </dl>
    `;
}

function selectVisitHistoryItem(recordId, visits) {
    const list = document.getElementById('visitHistoryList');
    const detail = document.getElementById('visitHistoryDetail');
    const currentRecordId = document.getElementById('currentRecordId')?.value;
    const visitList = visits || window._patientVisitsCache || [];
    const record = visitList.find(v => String(v.id) === String(recordId));

    if (list) {
        list.querySelectorAll('.visit-history-item').forEach(btn => {
            const active = String(btn.dataset.recordId) === String(recordId);
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-current', active ? 'true' : 'false');
        });
    }

    if (!detail) return;
    if (!record) {
        detail.innerHTML = '';
        return;
    }

    const isCurrent = currentRecordId && String(record.id) === String(currentRecordId);
    const recordIdAttr = String(record.id).replace(/"/g, '&quot;');
    detail.innerHTML = `
        ${buildVisitSummaryHtml(record)}
        <div class="visit-summary-actions">
            <button type="button" class="btn-secondary btn-sm btn-mobile-summary" style="width:100%;margin-bottom:8px;" data-visit-summary-id="${recordIdAttr}">
                <i class="fa-solid fa-mobile-screen"></i> Mobile summary
            </button>
            ${isCurrent
                ? '<p style="margin:0 0 8px;font-size:0.78rem;color:var(--success);font-weight:600;"><i class="fa-solid fa-circle-check"></i> This visit is open in the form</p>'
                : `<button type="button" class="btn-primary btn-sm" style="width:100%;" onclick="openVisitFromHistory(${record.id})">
                    <i class="fa-solid fa-folder-open"></i> View this visit
                   </button>`}
        </div>
    `;
    detail.querySelector('[data-visit-summary-id]')?.addEventListener('click', () => {
        window.CorneaMobileVisitSummary?.openFromRecord(record);
    });
}

function renderVisitHistorySidebar(visits, currentRecordId) {
    const sidebar = document.getElementById('visitHistorySidebar');
    const list = document.getElementById('visitHistoryList');
    const label = document.getElementById('visitHistoryPatientLabel');
    const countEl = document.getElementById('visitHistoryCount');
    if (!sidebar || !list) return;

    const patientName = document.getElementById('fullName')?.value?.trim()
        || (visits[0]?.fullName) || '';

    if (!visits.length) {
        sidebar.classList.add('is-empty');
        list.innerHTML = '<p class="visit-history-empty">Enter a Patient ID or open a saved record to see all visits in chronological order.</p>';
        if (label) label.textContent = 'Chronological visits for this patient';
        if (countEl) countEl.hidden = true;
        const detail = document.getElementById('visitHistoryDetail');
        if (detail) detail.innerHTML = '';
        return;
    }

    sidebar.classList.remove('is-empty');
    if (label) {
        label.textContent = patientName
            ? `All visits for ${patientName}`
            : `Patient ID: ${visits[0].patientId || '—'}`;
    }
    if (countEl) {
        countEl.hidden = false;
        countEl.textContent = visits.length === 1 ? '1 visit' : `${visits.length} visits`;
    }

    list.innerHTML = visits.map((v, idx) => {
        const isCurrent = currentRecordId != null && String(v.id) === String(currentRecordId);
        const snippet = truncateVisitText(v.diagnosis || v.chiefComplaint, 55) || 'No diagnosis entered';
        return `
            <button type="button" class="visit-history-item${isCurrent ? ' active' : ''}"
                data-record-id="${v.id}" role="listitem"
                aria-current="${isCurrent ? 'true' : 'false'}"
                title="Visit ${idx + 1} of ${visits.length}">
                <span class="visit-history-date">${escapeHtml(formatVisitDisplayDate(v.visitDate))}</span>
                ${isCurrent ? '<span class="visit-history-badge">Current</span>' : ''}
                <span class="visit-history-snippet">${escapeHtml(snippet)}</span>
            </button>
        `;
    }).join('');

    list.querySelectorAll('.visit-history-item').forEach(btn => {
        btn.addEventListener('click', () => {
            selectVisitHistoryItem(parseInt(btn.dataset.recordId, 10), visits);
        });
    });

    const selectId = currentRecordId != null
        ? currentRecordId
        : visits[visits.length - 1].id;
    selectVisitHistoryItem(selectId, visits);
}

window.refreshPatientVisitHistory = function() {
    if (!window.db) {
        renderVisitHistorySidebar([], null);
        return;
    }
    const patientId = document.getElementById('patientId')?.value?.trim();
    const currentRecordId = document.getElementById('currentRecordId')?.value;

    if (!patientId) {
        window._patientVisitsCache = [];
        window._lastAutofillPatientId = '';
        setPatientIdAutofillHint('', false);
        renderVisitHistorySidebar([], null);
        return;
    }

    loadPatientVisits(patientId, (visits) => {
        window._patientVisitsCache = visits;
        renderVisitHistorySidebar(visits, currentRecordId ? parseInt(currentRecordId, 10) : null);
        window.autofillPatientInfoFromPreviousVisit(patientId, visits);
    });
};

window.openVisitFromHistory = function(recordId) {
    if (recordId) window.editRecord(recordId);
};

function setupAgeFieldListeners() {
    const valueEl = document.getElementById('ageValue');
    const unitEl = document.getElementById('ageUnit');
    if (!valueEl || valueEl.dataset.ageBound) return;
    valueEl.dataset.ageBound = '1';
    const onAgeEdit = () => {
        window._ageManuallyEdited = true;
        valueEl.setCustomValidity('');
        window.normalizePatientAgeFields?.();
    };
    valueEl.addEventListener('input', onAgeEdit);
    unitEl?.addEventListener('change', onAgeEdit);
}

function setupVisitHistoryListeners() {
    setupAgeFieldListeners();
    const patientIdEl = document.getElementById('patientId');
    if (patientIdEl && !patientIdEl.dataset.visitHistoryBound) {
        patientIdEl.dataset.visitHistoryBound = '1';
        let t;
        const refresh = () => {
            clearTimeout(t);
            const id = patientIdEl.value.trim();
            if (id !== window._lastAutofillPatientId) window._lastAutofillPatientId = '';
            t = setTimeout(() => window.refreshPatientVisitHistory(), 400);
        };
        patientIdEl.addEventListener('input', refresh);
        patientIdEl.addEventListener('change', refresh);
        patientIdEl.addEventListener('blur', refresh);
    }
}

// --- New Patient Helper ---
window.newPatient = function() {
    if (!window.CorneaOfflineAuth?.hasPermission?.('visits:write')) {
        alert('You do not have permission to register new patients.');
        return;
    }
    openPatientFormModal('new');
};

window.loadPatientVisits = loadPatientVisits;
window.collectFormDataObject = collectFormDataObject;
window.populateFormFromData = populateFormFromData;
window.renderEmrReadOnlyGrid = renderEmrReadOnlyGrid;
window.formatRefractionReadOnlySection = formatRefractionReadOnlySection;
