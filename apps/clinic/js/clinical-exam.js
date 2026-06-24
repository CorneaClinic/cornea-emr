/**
 * Cornea Clinic — exam finding highlights and pull-from-previous
 * Phase 5 extraction from Cornea.html
 */

function setupFieldListeners() {
    [...ANT_SEGMENT_FIELDS, ...FUNDUS_FIELDS].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const run = () => window.checkNormalModification(id);
        el.addEventListener('input', run);
        el.addEventListener('change', run);
    });
}

window.refreshExamFindingHighlights = function() {
    [...ANT_SEGMENT_FIELDS, ...FUNDUS_FIELDS].forEach(id => window.checkNormalModification(id));
};

// --- Clinical Logic ---
window.checkNormalModification = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const baseKey = id.replace(/RE$|LE$/, '');
    const normalValue = NORMAL_ANT_SEGMENT[baseKey] || NORMAL_FUNDUS[baseKey];
    const val = (el.value || '').trim();
    const td = el.closest('td');
    const isAbnormal = normalValue && val !== '' && val.toLowerCase() !== normalValue.toLowerCase();
    if (isAbnormal) {
        el.classList.add('modified-normal');
        if (td) td.classList.add('td-finding-abnormal');
    } else {
        el.classList.remove('modified-normal');
        if (td) td.classList.remove('td-finding-abnormal');
    }
};

window.setNormalFindings = function() {
    if (window.CorneaAnteriorSegment?.setAllNormal) {
        window.CorneaAnteriorSegment.setAllNormal();
        return;
    }
    ANT_SEGMENT_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const baseKey = id.replace(/RE$|LE$/, '');
            if (NORMAL_ANT_SEGMENT[baseKey]) {
                el.value = NORMAL_ANT_SEGMENT[baseKey];
                window.checkNormalModification(id);
            }
        }
    });
};

window.setNormalFundusFindings = function() {
    if (window.CorneaPosteriorSegment?.setAllNormal) {
        window.CorneaPosteriorSegment.setAllNormal();
        return;
    }
    FUNDUS_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const baseKey = id.replace(/RE$|LE$/, '');
            if (NORMAL_FUNDUS[baseKey]) {
                el.value = NORMAL_FUNDUS[baseKey];
                window.checkNormalModification(id);
            }
        }
    });
};

window.pullPreviousAntSegment = function() {
    if (!window.db) { alert("Database not ready."); return; }
    const pId = document.getElementById('patientId').value;
    if (!pId) { alert("Please enter a Patient ID first."); return; }

    const transaction = window.db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index("patientId");
    const currentId = document.getElementById('currentRecordId')?.value;
    const request = index.openCursor(IDBKeyRange.only(pId), 'prev');
    let found = false;

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            if (currentId && cursor.value.id === parseInt(currentId)) { cursor.continue(); return; }
            const prev = cursor.value;
            ANT_SEGMENT_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && prev[id] !== undefined) { el.value = prev[id]; window.checkNormalModification(id); }
            });
            ['remarksAntRE', 'remarksAntLE'].forEach(id => {
                const el = document.getElementById(id);
                if (el && prev[id] !== undefined) el.value = prev[id];
            });
            if (prev.anteriorSegmentJSON) {
                const jsonEl = document.getElementById('anteriorSegmentJSON');
                if (jsonEl) jsonEl.value = prev.anteriorSegmentJSON;
            }
            window.CorneaAnteriorSegment?.onFormPopulated?.(prev);
            alert("Pulled Anterior Segment findings from visit: " + (prev.visitDate || "Unknown Date"));
            found = true;
        } else if (!found) {
            alert("No previous records found for this Patient ID.");
        }
    };
};

window.pullPreviousFundusExam = function() {
    if (!window.db) { alert("Database not ready."); return; }
    const pId = document.getElementById('patientId').value;
    if (!pId) { alert("Please enter a Patient ID first."); return; }

    const transaction = window.db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index("patientId");
    const currentId = document.getElementById('currentRecordId')?.value;
    const request = index.openCursor(IDBKeyRange.only(pId), 'prev');
    let found = false;

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            if (currentId && cursor.value.id === parseInt(currentId)) { cursor.continue(); return; }
            const prev = cursor.value;
            FUNDUS_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && prev[id] !== undefined) { el.value = prev[id]; window.checkNormalModification(id); }
            });
            ['fundusRemarksRE', 'fundusRemarksLE'].forEach(id => {
                const el = document.getElementById(id);
                if (el && prev[id] !== undefined) el.value = prev[id];
            });
            if (prev.posteriorSegmentJSON) {
                const jsonEl = document.getElementById('posteriorSegmentJSON');
                if (jsonEl) jsonEl.value = prev.posteriorSegmentJSON;
            }
            window.CorneaPosteriorSegment?.onFormPopulated?.(prev);
            alert("Pulled Fundus Exam findings from visit: " + (prev.visitDate || "Unknown Date"));
            found = true;
        } else if (!found) {
            alert("No previous records found for this Patient ID.");
        }
    };
};

window.setupFieldListeners = setupFieldListeners;
