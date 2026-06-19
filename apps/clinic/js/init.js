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

    // DOB removed — age is entered manually on the patient form.
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
