/**
 * Cornea Clinic — dashboard stats and recent activity
 * Phase 4 extraction from Cornea.html
 */

window.updateDashboardStats = function() {
    if (!window.db) return;
    const transaction = window.db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const records = request.result;
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

        // Recent Activity
        const recentBody = document.getElementById('recentActivityBody');
        if (recentBody) {
            recentBody.innerHTML = '';
            const recent = [...records]
                .sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0))
                .slice(0, 5);

            if (recent.length === 0) {
                recentBody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No activity yet. Register your first patient.</p></div></td></tr>`;
            } else {
                recent.forEach(r => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>${escapeHtml(r.fullName ?? '') || 'Unnamed'}</strong></td>
                        <td><span class="patient-id-badge">${escapeHtml(r.patientId ?? '') || '—'}</span></td>
                        <td>${escapeHtml(r.visitDate ?? '') || '—'}</td>
                        <td><button type="button" class="btn-info" onclick="viewRecordReadOnly(${r.id})"><i class="fa-solid fa-eye" aria-hidden="true"></i> View</button></td>
                    `;
                    recentBody.appendChild(row);
                });
            }
        }
    };
};
