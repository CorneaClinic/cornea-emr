/**
 * Cornea Clinic — DOMContentLoaded bootstrap
 * Phase 5 extraction from Cornea.html
 */

window.addEventListener('DOMContentLoaded', () => {
    // Live clock
    function updateClock() {
        const el = document.getElementById('liveClock');
        if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Set today's date as default visit date
    const visitDateEl = document.getElementById('visitDate');
    if (visitDateEl && !visitDateEl.value) {
        visitDateEl.value = new Date().toISOString().split('T')[0];
    }

    // DOB → Age calculation
    const dobInput = document.getElementById('dob');
    const ageInput = document.getElementById('age');
    if (dobInput && ageInput) {
        dobInput.addEventListener('change', () => {
            const dob = new Date(dobInput.value);
            if (!isNaN(dob.getTime())) {
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                ageInput.value = age;
            }
        });
    }

    initDB();
    setTimeout(setupLidAutocomplete, 0);
    setupDiagnosisIcdAutocomplete();
    setupVisitHistoryListeners();
    loadIcdApiSettingsIntoForm();
    updateDiagnosisIcdStatusMessage().catch(() => {});
    initMedicalAdvice();
    initFollowUp();
    initEmrModals();
    initFormSectionCollapse();
    if (window.CorneaContactLens) window.CorneaContactLens.init();
    if (window.CorneaScleralLens) window.CorneaScleralLens.init();
    if (window.CorneaLaserRefractive) window.CorneaLaserRefractive.init();
    preloadDrawingSketch();
    initAnteriorDrawingStudio();
    renderAnteriorDrawingPreview();
    window.refreshPatientVisitHistory();

    if (window.CorneaAnteriorSegment) {
        window.CorneaAnteriorSegment.buildLegacyHiddenFields();
        window.CorneaAnteriorSegment.init();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.innerWidth < 900) closeSidebar();
    });
});
