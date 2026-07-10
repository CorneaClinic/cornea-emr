/**
 * Cornea Clinic — visit persistence, records list, form reset
 * Phase 3 extraction from Cornea.html
 */

// --- Data Management ---
window.saveToDatabase = async function() {
    if (!window.CorneaOfflineAuth?.hasPermission?.('visits:write')) {
        alert('You do not have permission to save patient records.');
        return;
    }
    if (!window.db) { alert("Database not ready."); return; }
    const form = document.getElementById('patientForm');
    if (!form) return;

    window.syncMedicalAdviceJSON();

    try {
        if (window.CorneaVisitMedia) {
            window.CorneaVisitMedia.syncToHiddenField();
        }

        window.CorneaAnteriorSegment?.syncToLegacyFields?.();
        window.CorneaPosteriorSegment?.syncToLegacyFields?.();

        if (window.CorneaContactLens) {
            window.CorneaContactLens.syncToHiddenField();
        }

        if (window.CorneaScleralLens) {
            window.CorneaScleralLens.syncToHiddenField();
        }

        if (window.CorneaLaserRefractive) {
            window.CorneaLaserRefractive.syncToHiddenField();
        }
    } catch (syncErr) {
        alert('Error preparing record for save: ' + (syncErr?.message || syncErr));
        return;
    }

    if (typeof window.normalizePatientAgeFields === 'function') {
        window.normalizePatientAgeFields();
    }
    if (typeof window.validatePatientAgeFields === 'function' && !window.validatePatientAgeFields()) {
        const ageEl = document.getElementById('ageValue');
        if (ageEl) ageEl.reportValidity();
        return;
    }
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (window.CorneaDuplicatePatients?.checkBeforeSave) {
        const maySave = await window.CorneaDuplicatePatients.checkBeforeSave();
        if (!maySave) return;
    }

    const data = {};
    form.querySelectorAll('input, textarea, select').forEach(input => {
        if (input.type === 'radio') {
            if (input.checked) data[input.name] = input.value;
        } else if (input.id) {
            data[input.id] = input.value;
        }
    });

    data.lastModified = new Date().toISOString();
    const currentId = document.getElementById('currentRecordId')?.value;
    if (currentId && data.id == null) {
        const parsed = parseInt(String(currentId), 10);
        if (!Number.isNaN(parsed)) data.id = parsed;
    }
    delete data.currentRecordId;
    delete data.currentRecordUuid;

    try {
        let existingForAudit = null;
        if (data.id != null && !Number.isNaN(data.id)) {
            if (window.CorneaSecurePatients?.get) {
                existingForAudit = await window.CorneaSecurePatients.get(data.id);
            } else {
                existingForAudit = await new Promise((resolve) => {
                    const req = window.db.transaction([STORE_NAME], 'readonly')
                        .objectStore(STORE_NAME).get(data.id);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                });
            }
        }

        // Editing an existing record: carry over sync metadata so offline
        // edits keep their server identity and sync correctly later.
        if (existingForAudit) {
            if (existingForAudit.uuid && !data.uuid) data.uuid = existingForAudit.uuid;
            if (existingForAudit.revision != null) data.revision = existingForAudit.revision;
            if (existingForAudit.client_mutation_id) data.client_mutation_id = existingForAudit.client_mutation_id;
        }

        if (window.CorneaPatientFlow) {
            window.CorneaPatientFlow.applyOnSave(data, existingForAudit);
        }

        if (window.CorneaVisualAcuity) {
            window.CorneaVisualAcuity.applyBeforeSave(data);
        }

        if (window.CorneaContactLens) {
            window.CorneaContactLens.applyBeforeSave(data);
        }

        if (window.CorneaScleralLens) {
            window.CorneaScleralLens.applyBeforeSave(data);
        }

        if (window.CorneaLaserRefractive) {
            window.CorneaLaserRefractive.applyBeforeSave(data);
        }

        if (window.CorneaSectionAttribution && !window.CorneaSync) {
            window.CorneaSectionAttribution.applyBeforeSave(data, existingForAudit);
        }

        let savedId;
        let savedRecord = null;
        if (window.CorneaSync) {
            const saved = await CorneaSync.saveVisitLocal(data);
            savedId = saved.id;
            savedRecord = saved;
        } else if (window.CorneaSecurePatients?.put) {
            savedId = await window.CorneaSecurePatients.put(data);
            savedRecord = { ...data, id: savedId };
            if (window.CorneaAudit) {
                const view = collectFormDataObject();
                view.id = savedId;
                await window.CorneaAudit.logDirectSave(existingForAudit, view, savedId);
            }
        } else {
            savedId = await new Promise((resolve, reject) => {
                const req = window.db.transaction([STORE_NAME], 'readwrite')
                    .objectStore(STORE_NAME).put(data);
                req.onsuccess = (event) => resolve(event.target.result);
                req.onerror = () => reject(req.error);
            });
            savedRecord = { ...data, id: savedId };
            if (window.CorneaAudit) {
                const view = collectFormDataObject();
                view.id = savedId;
                await window.CorneaAudit.logDirectSave(existingForAudit, view, savedId);
            }
        }

        document.getElementById('currentRecordId').value = savedId;
        window._currentViewRecordId = savedId;
        window.syncMedicalAdviceJSON();
        const view = collectFormDataObject();
        view.id = savedId;
        if (savedRecord?.sectionAttribution) view.sectionAttribution = savedRecord.sectionAttribution;
        if (window.CorneaSectionAttribution) {
            window.CorneaSectionAttribution.renderForm(view.sectionAttribution);
        }
        alert("Patient record saved successfully!");
        closeEmrModal('emrPatientModal');
        renderPatientReadOnly(view, 'patientReadOnlyContent');
        updatePatientReadOnlyToolbar(true);
        window.updateDashboardStats();
        loadRecords();
        if (window.CorneaPatientFlow) window.CorneaPatientFlow.refresh();
        window.switchTab('formTab');
    } catch (err) {
        alert("Error saving record to database: " + (err?.message || err));
    }
};

function loadRecords() {
    if (!window.db) return;
    const body = document.getElementById('recordsBody');
    if (!body) return;
    body.innerHTML = '';

    const renderRow = (record) => {
        const row = document.createElement('tr');
        const canEdit = window.CorneaOfflineAuth?.hasPermission?.('visits:write') ?? false;
        const canDelete = window.CorneaOfflineAuth?.hasPermission?.('visits:delete') ?? false;
        const editBtn = canEdit ? `<button type="button" class="btn-secondary btn-sm" data-csp-action="loadAndEditRecord" data-csp-args='[${record.id}]'><i class="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>` : '';
        const deleteBtn = canDelete ? `<button type="button" class="btn-danger btn-sm" data-csp-action="deleteRecord" data-csp-args='[${record.id}]'><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` : '';
        row.innerHTML = `
            <td><span class="patient-id-badge">${escapeHtml(record.patientId ?? '') || '—'}</span></td>
            <td>${escapeHtml(record.fullName ?? '') || 'Unnamed'}</td>
            <td>${escapeHtml(record.visitDate ?? '') || '—'}</td>
            <td>${escapeHtml(record.phone ?? '') || '—'}</td>
            <td class="no-print records-actions">
                <button type="button" class="btn-info" data-csp-action="viewRecordReadOnly" data-csp-args='[${record.id},"records"]'><i class="fa-solid fa-eye" aria-hidden="true"></i> View</button>
                ${editBtn}
                ${deleteBtn}
            </td>
        `;
        body.appendChild(row);
    };

    if (window.CorneaSecurePatients?.forEachCursor) {
        let hasRows = false;
        window.CorneaSecurePatients.forEachCursor('prev', (record) => {
            hasRows = true;
            renderRow(record);
        }).then(() => {
            if (!hasRows) {
                body.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No records found. Register your first patient.</p></div></td></tr>`;
            }
        }).catch(() => loadRecordsLegacy());
        return;
    }
    loadRecordsLegacy();

    function loadRecordsLegacy() {
        const store = window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
        let hasRows = false;
        store.openCursor(null, 'prev').onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                hasRows = true;
                renderRow(cursor.value);
                cursor.continue();
            } else if (!hasRows) {
                body.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No records found. Register your first patient.</p></div></td></tr>`;
            }
        };
    }
}

window.loadAndEditRecord = async function(id) {
    if (!window.CorneaOfflineAuth?.hasPermission?.('visits:write')) {
        alert('You do not have permission to edit patient records.');
        return;
    }
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
    openPatientFormModal('edit');
};

window.editRecord = function(id) {
    viewRecordReadOnly(id);
};

window.deleteRecord = async function(id) {
    if (!window.CorneaOfflineAuth?.hasPermission?.('visits:delete')) {
        alert('You do not have permission to delete patient records.');
        return;
    }
    if (!window.db) return;
    if (!confirm("Are you sure you want to permanently delete this record?")) return;
    try {
        if (window.CorneaSync) {
            await CorneaSync.deleteVisitLocal(id);
        } else if (window.CorneaSecurePatients?.remove) {
            const existing = await window.CorneaSecurePatients.get(id);
            await window.CorneaSecurePatients.remove(id);
            if (window.CorneaAudit && existing) {
                await window.CorneaAudit.logVisit({
                    action: 'delete',
                    oldRecord: existing,
                    newRecord: null,
                    recordId: id
                });
            }
        } else {
            const existing = await new Promise((resolve) => {
                const req = window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            await new Promise((resolve, reject) => {
                const req = window.db.transaction([STORE_NAME], 'readwrite')
                    .objectStore(STORE_NAME).delete(id);
                req.onsuccess = resolve;
                req.onerror = () => reject(req.error);
            });
            if (window.CorneaAudit && existing) {
                await window.CorneaAudit.logVisit({
                    action: 'delete',
                    oldRecord: existing,
                    newRecord: null,
                    recordId: id
                });
            }
        }
        loadRecords();
        updateDashboardStats();
        window.refreshPatientVisitHistory();
    } catch (err) {
        alert("Delete failed: " + (err?.message || err));
    }
};


window.filterRecords = function() {
    const query = document.getElementById('searchInput')?.value.toLowerCase();
    document.querySelectorAll('#recordsBody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = !query || text.includes(query) ? '' : 'none';
    });
};

window.clearForm = function(ask = true) {
    if (!ask || confirm('Are you sure you want to clear the form?')) {
        const form = document.getElementById('patientForm');
        if (form) form.reset();
        const ageValueInput = document.getElementById('ageValue');
        const ageUnitInput = document.getElementById('ageUnit');
        const ageInput = document.getElementById('age');
        if (ageValueInput) ageValueInput.value = '';
        if (ageUnitInput) ageUnitInput.value = 'years';
        if (ageInput) ageInput.value = '';
        const idField = document.getElementById('currentRecordId');
        if (idField) idField.value = '';
        document.querySelectorAll('.modified-normal').forEach(el => el.classList.remove('modified-normal'));
        document.querySelectorAll('.td-finding-abnormal').forEach(el => el.classList.remove('td-finding-abnormal'));
        // Reset visit date to today
        const visitDateEl = document.getElementById('visitDate');
        if (visitDateEl) visitDateEl.value = new Date().toISOString().split('T')[0];
        window.loadMedicalAdviceFromJSON('[]');
        window.resetFollowUpUI();
        const drawingJsonEl = document.getElementById('anteriorDrawingJSON');
        const drawingImgEl = document.getElementById('anteriorDrawingImage');
        if (drawingJsonEl) drawingJsonEl.value = '';
        if (drawingImgEl) drawingImgEl.value = '';
        renderAnteriorDrawingPreview();
        if (window.CorneaVisitMedia) window.CorneaVisitMedia.reset();
        if (window.CorneaContactLens) window.CorneaContactLens.reset();
        if (window.CorneaScleralLens) window.CorneaScleralLens.reset();
        if (window.CorneaLaserRefractive) window.CorneaLaserRefractive.reset();
        if (window.CorneaOpinionReferral) window.CorneaOpinionReferral.reset();
        window._patientVisitsCache = [];
        window._lastAutofillPatientId = '';
        window._ageManuallyEdited = false;
        window._currentViewRecordId = null;
        setPatientIdAutofillHint('', false);
        renderPatientReadOnly(null);
        updatePatientReadOnlyToolbar(false);
        window.refreshPatientVisitHistory();
        window.scrollTo(0, 0);
    }
};

window.loadRecords = loadRecords;
