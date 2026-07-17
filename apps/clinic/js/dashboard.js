/**
 * Cornea Clinic — dashboard stats and institute KPIs
 * Phase 4 extraction from Cornea.html
 */

function kpiSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val == null ? '—' : String(val);
}

window.renderInstituteKpis = function (data) {
    const section = document.getElementById('instituteKpisSection');
    const hint = document.getElementById('instituteKpisHint');
    if (!section) return;

    if (!data) {
        section.setAttribute('hidden', 'hidden');
        if (hint) hint.removeAttribute('hidden');
        return;
    }

    const v = data.visits || {};
    const kc = data.registries?.kc || {};
    const uk = data.registries?.keratitis || {};
    const kp = data.registries?.keratoplasty || {};

    kpiSet('kpiUniquePatients', v.uniquePatients);
    kpiSet('kpiVisitsWeek', v.week);
    kpiSet('kpiKcEnrolled', kc.enrolled);
    kpiSet('kpiKcActive', kc.active);
    kpiSet('kpiCxlTotal', kc.cxl);
    kpiSet('kpiUkActive', uk.active);
    kpiSet('kpiKpWaiting', kp.waiting);
    kpiSet('kpiKpEmergency', kp.emergency);
    kpiSet('kpiTissueAvailable', kp.tissueAvailable);

    const asOf = document.getElementById('instituteKpisAsOf');
    if (asOf && data.generatedAt) {
        asOf.textContent = 'As of ' + new Date(data.generatedAt).toLocaleString([], {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    section.removeAttribute('hidden');
    if (hint) hint.setAttribute('hidden', 'hidden');
};

window.applyCloudVisitStats = function (data) {
    // Top summary cards (statTotalPatients, etc.) reflect local IndexedDB cache.
    // Institute-wide cloud KPIs are shown in #instituteKpisSection via renderInstituteKpis.
    void data;
};

window.fetchInstituteKpis = async function () {
    const api = window.CorneaApi;
    if (!api?.isEnabled?.()) {
        window.renderInstituteKpis(null);
        const hint = document.getElementById('instituteKpisHint');
        const section = document.getElementById('instituteKpisSection');
        if (section) section.removeAttribute('hidden');
        if (hint) hint.removeAttribute('hidden');
        window.CorneaRoleDashboard?.syncWidgetValues?.();
        return;
    }
    try {
        const res = await api.request('/api/v1/dashboard/kpis');
        const data = res?.data;
        window.applyCloudVisitStats(data);
        window.renderInstituteKpis(data);
        window.CorneaRoleDashboard?.syncWidgetValues?.();
    } catch (err) {
        console.warn('[Dashboard] Institute KPIs:', err);
        window.renderInstituteKpis(null);
        window.CorneaRoleDashboard?.syncWidgetValues?.();
    }
};

window.updateDashboardStats = async function() {
    if (!window.db) {
        window.fetchInstituteKpis().catch(() => {});
        if (window.CorneaRoleDashboard?.onDashboardRefresh) {
            window.CorneaRoleDashboard.onDashboardRefresh();
        }
        return;
    }
    const records = window.CorneaSecurePatients?.getAll
        ? await window.CorneaSecurePatients.getAll()
        : await new Promise((resolve) => {
            const request = window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });

    const totalVisits = records.length;
    const uniquePatientIds = new Set(
        records.map((r) => String(r.patientId || '').trim()).filter(Boolean)
    );
    const totalPatients = uniquePatientIds.size > 0 ? uniquePatientIds.size : totalVisits;
        const today = new Date().toISOString().split('T')[0];

        let todayCount = 0, maleCount = 0, femaleCount = 0;
        let latestDate = null;

        records.forEach(r => {
            if (r.visitDate === today) todayCount++;
            if (r.sex === 'Male') maleCount++;
            if (r.sex === 'Female') femaleCount++;
            if (r.lastModified && (!latestDate || r.lastModified > latestDate)) latestDate = r.lastModified;
        });

        document.getElementById('statTotalPatients').textContent = totalPatients;
        document.getElementById('statTodayVisits').textContent = todayCount;
        document.getElementById('statSexRatio').textContent = `${maleCount} / ${femaleCount}`;

        const lastEl = document.getElementById('statLastUpdated');
        if (lastEl) {
            lastEl.textContent = latestDate
                ? new Date(latestDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
        }

        const recentList = document.getElementById('dashRecentPatientsList');
        const recentHint = document.getElementById('dashRecentPatientsHint');
        if (recentList) {
            const sorted = [...records].sort((a, b) =>
                String(b.lastModified || b.visitDate || '').localeCompare(String(a.lastModified || a.visitDate || ''))
            ).slice(0, 5);
            if (!sorted.length) {
                recentList.innerHTML = '';
                if (recentHint) recentHint.removeAttribute('hidden');
            } else {
                if (recentHint) recentHint.setAttribute('hidden', 'hidden');
                recentList.innerHTML = sorted.map((r) => {
                    const name = escapeHtml(r.fullName || r.patientId || 'Patient');
                    const when = escapeHtml(r.visitDate || '—');
                    const id = Number(r.id);
                    const open = Number.isFinite(id)
                        ? ` data-csp-action="viewRecordReadOnly" data-csp-args='[${id},"records"]'`
                        : '';
                    return `<li><button type="button" class="dashboard-list-link"${open}><strong>${name}</strong> <span>${when}</span></button></li>`;
                }).join('');
            }
        }

        const sysDb = document.getElementById('dashSysDb');
        const sysCloud = document.getElementById('dashSysCloud');
        const sysSession = document.getElementById('dashSysSession');
        if (sysDb) sysDb.textContent = 'Active';
        if (sysCloud) {
            sysCloud.textContent = window.__corneaCloudMode && window.CorneaApi?.isEnabled?.()
                ? 'Connected'
                : 'Offline / local';
        }
        if (sysSession) {
            const user = window.__corneaUser?.email
                || window.CorneaOfflineAuth?.getCurrentUser?.()?.username
                || '—';
            sysSession.textContent = user;
        }

        window.fetchInstituteKpis().catch(() => {});
        if (window.CorneaRoleDashboard?.onDashboardRefresh) {
            window.CorneaRoleDashboard.onDashboardRefresh();
        }
};
