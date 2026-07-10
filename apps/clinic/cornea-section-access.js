/**
 * EMR section visibility — applied after cloud sign-in from user.emrSections.
 * Offline/local mode (no cloud user) shows all sections.
 *
 * IMPORTANT: use CSS class only — do not toggle the HTML `hidden` attribute.
 * Sidebar accordion/search owns `hidden` for expand/collapse and filtering.
 */
(function (global) {
  'use strict';

  const TAB_TO_SECTION = Object.freeze({
    dashboardTab: 'dashboard',
    formTab: 'patient_form',
    recordsTab: 'records',
    auditTrailTab: 'audit_trail',
    flowTab: 'patient_flow',
    appointmentsTab: 'appointments_recall',
    keratoplastyTab: 'keratoplasty',
    keratitisTab: 'keratitis_ulcer',
    dryEyeTab: 'dry_eye_osd',
    researchTab: 'research_analytics',
    kcRegistryTab: 'kc_registry',
    clinicalMediaTab: 'clinical_media',
    databaseTab: 'database'
  });

  /** @type {Record<string, boolean> | null} */
  let currentSections = null;

  function setElementVisible(el, show) {
    if (!el) return;
    el.classList.toggle('emr-section-hidden', !show);
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function applySections(sections) {
    currentSections = sections || null;

    if (!sections) {
      document.querySelectorAll('[data-emr-section]').forEach((el) => setElementVisible(el, true));
      document.querySelectorAll('.nav-item[data-tab]').forEach((el) => setElementVisible(el, true));
      // Keep cloud/offline admin panels mutually exclusive
      syncAdminPanels();
      return;
    }

    document.querySelectorAll('[data-emr-section]').forEach((el) => {
      const key = el.getAttribute('data-emr-section');
      setElementVisible(el, sections[key] !== false);
    });

    for (const [tabId, sectionKey] of Object.entries(TAB_TO_SECTION)) {
      document.querySelectorAll(`.nav-item[data-tab="${tabId}"]`).forEach((nav) => {
        setElementVisible(nav, sections[sectionKey] !== false);
      });
    }

    syncAdminPanels();

    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab?.id && TAB_TO_SECTION[activeTab.id]) {
      const activeKey = TAB_TO_SECTION[activeTab.id];
      if (sections[activeKey] === false) {
        const fallback = Object.entries(TAB_TO_SECTION).find(([, sk]) => sections[sk] !== false);
        if (fallback && typeof global.switchTab === 'function') {
          global.switchTab(fallback[0]);
        }
      }
    }
  }

  /** Cloud vs offline user admin cards must not both show. */
  function syncAdminPanels() {
    const cloudOn = !!global.__corneaCloudMode;
    const cloudPanel = document.getElementById('adminUsersPanel');
    const offlinePanel = document.getElementById('offlineUsersPanel');
    if (cloudPanel) {
      const allowed = !currentSections || currentSections.user_admin !== false;
      setElementVisible(cloudPanel, cloudOn && allowed);
    }
    if (offlinePanel) {
      const allowed = !currentSections || currentSections.user_admin !== false;
      setElementVisible(offlinePanel, !cloudOn && allowed);
    }
  }

  function isTabAllowed(tabId) {
    if (!currentSections) return true;
    const sectionKey = TAB_TO_SECTION[tabId];
    if (!sectionKey) return true;
    return currentSections[sectionKey] !== false;
  }

  global.CorneaSections = {
    apply: applySections,
    isTabAllowed,
    syncAdminPanels,
    tabToSection: TAB_TO_SECTION
  };
})(typeof window !== 'undefined' ? window : globalThis);
