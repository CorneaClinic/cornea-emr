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
    if (!data?.visits) return;
    const v = data.visits;
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    if (v.uniquePatients != null) set('statTotalPatients', v.uniquePatients);
    if (v.today != null) set('statTodayVisits', v.today);
    if (v.sexRatio) {
        set('statSexRatio', `${v.sexRatio.male || 0} / ${v.sexRatio.female || 0}`);
    }
    if (v.lastUpdated) {
        set('statLastUpdated', new Date(v.lastUpdated).toLocaleDateString([], {
            month: 'short', day: 'numeric', year: 'numeric'
        }));
    }
};

window.fetchInstituteKpis = async function () {
    const api = window.CorneaApi;
    if (!api?.isEnabled?.()) {
        window.renderInstituteKpis(null);
        const hint = document.getElementById('instituteKpisHint');
        const section = document.getElementById('instituteKpisSection');
        if (section) section.removeAttribute('hidden');
        if (hint) hint.removeAttribute('hidden');
        return;
    }
    try {
        const res = await api.request('/api/v1/dashboard/kpis');
        const data = res?.data;
        window.applyCloudVisitStats(data);
        window.renderInstituteKpis(data);
    } catch (err) {
        console.warn('[Dashboard] Institute KPIs:', err);
        window.renderInstituteKpis(null);
    }
};

window.updateDashboardStats = async function() {
    if (!window.db) {
        window.fetchInstituteKpis().catch(() => {});
        return;
    }
    const records = window.CorneaSecurePatients?.getAll
        ? await window.CorneaSecurePatients.getAll()
        : await new Promise((resolve) => {
            const request = window.db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });

    const total = records.length;
        const today = new Date().toISOString().split('T')[0];

        let todayCount = 0, maleCount = 0, femaleCount = 0;
        let latestDate = null;

        records.forEach(r => {
            if (r.visitDate === today) todayCount++;
            if (r.sex === 'Male') maleCount++;
            if (r.sex === 'Female') femaleCount++;
            if (r.lastModified && (!latestDate || r.lastModified > latestDate)) latestDate = r.lastModified;
        });

        document.getElementById('statTotalPatients').textContent = total;
        document.getElementById('statTodayVisits').textContent = todayCount;
        document.getElementById('statSexRatio').textContent = `${maleCount} / ${femaleCount}`;

        const lastEl = document.getElementById('statLastUpdated');
        if (lastEl) {
            lastEl.textContent = latestDate
                ? new Date(latestDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
        }

        window.fetchInstituteKpis().catch(() => {});
};
