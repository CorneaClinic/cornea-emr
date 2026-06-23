/**
 * Cornea Clinic — navigation, modals, sidebar shell
 * Phase 2 extraction from Cornea.html
 */
window._currentViewRecordId = null;
window._kpSelectedPatientId = null;
window._kpSelectedTissueId = null;

var PAGE_META = {
    dashboardTab: { title: 'Dashboard', subtitle: 'Overview & recent activity' },
    formTab:      { title: 'Patient Form', subtitle: 'Read-only visit record · use Edit to modify' },
    recordsTab:   { title: 'Patient Records', subtitle: 'All stored patient visits' },
    auditTrailTab:{ title: 'Audit Trail', subtitle: 'Who changed which patient records' },
    flowTab:      { title: 'Patient Flow', subtitle: 'Today\'s patients by clinic station' },
    databaseTab:  { title: 'Database Management', subtitle: 'Export, import & manage local data' },
    keratoplastyTab: { title: 'Keratoplasty Register', subtitle: 'Patient register, tissue inventory & matching' },
    kcRegistryTab: { title: 'KC & CXL Registry', subtitle: 'Keratoconus programme, serial topography & cross-linking' },
    clinicalMediaTab: { title: 'Clinical Media', subtitle: 'Imaging library, timeline & comparison' }
};

function escapeHtml(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}
window.escapeHtml = escapeHtml;

function isAuthModalId(modalId) {
    return window.CorneaAuthEnv?.isAuthModal?.(modalId) === true;
}

window.openEmrModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('emr-modal-open');
};

window.closeEmrModal = function(modalId) {
    if (isAuthModalId(modalId)) return;
    const el = document.getElementById(modalId);
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.emr-modal-overlay.is-open')) {
        document.body.classList.remove('emr-modal-open');
    }
};

function initEmrModals() {
    const form = document.getElementById('patientForm');
    const body = document.getElementById('emrPatientModalBody');
    const footer = document.getElementById('emrPatientModalFooter');
    if (form && body) {
        body.appendChild(form);
        form.hidden = false;
        form.removeAttribute('aria-hidden');
    }
    const actions = document.querySelector('.emr-form-actions-source');
    if (actions && footer) {
        const cancelBtn = footer.querySelector('.btn-secondary');
        while (actions.firstChild) {
            footer.insertBefore(actions.firstChild, cancelBtn);
        }
        actions.remove();
    }
    document.querySelectorAll('.emr-modal-overlay').forEach(ov => {
        ov.addEventListener('click', e => {
            if (e.target === ov && !isAuthModalId(ov.id)) closeEmrModal(ov.id);
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.emr-modal-overlay.is-open').forEach(m => {
                if (!isAuthModalId(m.id)) closeEmrModal(m.id);
            });
        }
    });
    renderIcdReadOnlyView();
}

window.initEmrModals = initEmrModals;

window.switchTab = function(tabId) {
    if (window.CorneaAuthEnv?.isAuthenticated && !window.CorneaAuthEnv.isAuthenticated()) {
        return;
    }
    if (window.CorneaSections?.isTabAllowed && !window.CorneaSections.isTabAllowed(tabId)) {
        alert('You do not have access to this section.');
        return;
    }
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(n => {
        n.classList.remove('active');
        n.removeAttribute('aria-current');
    });

    const target = document.getElementById(tabId);
    if (target) {
        target.classList.add('active');
        target.setAttribute('aria-hidden', 'false');
    }

    const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (navItem) {
        navItem.classList.add('active');
        navItem.setAttribute('aria-current', 'page');
    }

    const meta = PAGE_META[tabId];
    if (meta) {
        document.getElementById('pageTitle').textContent = meta.title;
        document.getElementById('pageSubtitle').textContent = meta.subtitle;
    }

    if (tabId === 'recordsTab') {
        if (window.__corneaCloudMode && window.CorneaSync?.syncNow) {
            window.CorneaSync.syncNow()
                .then(() => { if (typeof loadRecords === 'function') loadRecords(); })
                .catch(() => { if (typeof loadRecords === 'function') loadRecords(); });
        } else if (typeof loadRecords === 'function') {
            loadRecords();
        }
    }
    if (tabId === 'auditTrailTab' && window.CorneaAudit?.renderViewer) {
        window.CorneaAudit.renderViewer();
    }
    if (tabId === 'dashboardTab') updateDashboardStats();
    if (tabId === 'flowTab' && window.CorneaPatientFlow) {
        window.CorneaPatientFlow.initFlowTab();
    }

    if (tabId === 'formTab') {
        requestAnimationFrame(() => {
            repositionOpenLidAutocompleteLists();
            repositionOpenDiagnosisAutocomplete();
            updateDiagnosisIcdStatusMessage().catch(() => {});
            window.refreshPatientVisitHistory();
            ['lidRE', 'lidLE'].forEach((id) => {
                const el = document.getElementById(id);
                if (el && el.value.trim()) el.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }

    if (tabId === 'databaseTab') {
        loadIcdApiSettingsIntoForm();
        renderIcdReadOnlyView();
        if (window.CorneaAdminUsers?.refresh) window.CorneaAdminUsers.refresh();
        if (window.CorneaOfflineAuth?.renderOfflineUsersAdmin) window.CorneaOfflineAuth.renderOfflineUsersAdmin();
    }
    if (tabId === 'keratoplastyTab') {
        initKeratoplastyTab();
    }
    if (tabId === 'kcRegistryTab' && typeof initKcRegistry === 'function') {
        initKcRegistry();
    }

    if (window.innerWidth < 900) closeSidebar();
};

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
    const open = sidebar.classList.contains('open');
    if (btn) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
    const btn = document.getElementById('hamburgerBtn');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open menu');
    }
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
