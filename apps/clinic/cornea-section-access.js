/**
 * EMR section visibility — applied after cloud sign-in from user.emrSections.
 * Offline/local mode (no cloud user) shows all sections.
 */
(function (global) {
  'use strict';

  const TAB_TO_SECTION = Object.freeze({
    dashboardTab: 'dashboard',
    formTab: 'patient_form',
    recordsTab: 'records',
    auditTrailTab: 'audit_trail',
    flowTab: 'patient_flow',
    keratoplastyTab: 'keratoplasty',
    keratitisTab: 'keratitis_ulcer',
    researchTab: 'research_analytics',
    kcRegistryTab: 'kc_registry',
    clinicalMediaTab: 'clinical_media',
    databaseTab: 'database'
  });

  /** @type {Record<string, boolean> | null} */
  let currentSections = null;

  function setElementVisible(el, show) {
    if (!el) return;
    if (show) {
      el.style.display = '';
      el.classList.remove('emr-section-hidden');
      el.setAttribute('aria-hidden', 'false');
    } else {
      el.style.display = 'none';
      el.classList.add('emr-section-hidden');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function applySections(sections) {
    currentSections = sections || null;

    if (!sections) {
      document.querySelectorAll('[data-emr-section]').forEach((el) => setElementVisible(el, true));
      document.querySelectorAll('.nav-item[data-tab]').forEach((el) => setElementVisible(el, true));
      return;
    }

    document.querySelectorAll('[data-emr-section]').forEach((el) => {
      const key = el.getAttribute('data-emr-section');
      setElementVisible(el, sections[key] !== false);
    });

    for (const [tabId, sectionKey] of Object.entries(TAB_TO_SECTION)) {
      const nav = document.getElementById('nav-' + tabId)
        || document.querySelector(`.nav-item[data-tab="${tabId}"]`);
      setElementVisible(nav, sections[sectionKey] !== false);
    }

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

  function isTabAllowed(tabId) {
    if (!currentSections) return true;
    const sectionKey = TAB_TO_SECTION[tabId];
    if (!sectionKey) return true;
    return currentSections[sectionKey] !== false;
  }

  global.CorneaSections = {
    apply: applySections,
    isTabAllowed,
    tabToSection: TAB_TO_SECTION
  };
})(typeof window !== 'undefined' ? window : globalThis);
