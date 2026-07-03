/**
 * Eye bank traceability — custody, cold chain, serology, quarantine (Project 10)
 */
(function (global) {
  'use strict';

  const STORE_CUSTODY = 'kpCustodyEvents';
  const STORE_COLD = 'kpColdChainEvents';
  let _custody = [];
  let _cold = [];

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function dbGetAll(store) {
    return new Promise((resolve) => {
      if (!global.db) { resolve([]); return; }
      const req = global.db.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function dbPut(store, data) {
    return new Promise((resolve, reject) => {
      const req = global.db.transaction([store], 'readwrite').objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function guardCloudRegistryWrite(label) {
    return global.CorneaRegistryOnline?.guardCloudWrite(apiOn(), label || 'Eye bank traceability') !== false;
  }

  let _eyeBankOfflineUiBound = false;
  function bindEyeBankOfflineUi() {
    if (_eyeBankOfflineUiBound) {
      global.CorneaRegistryOnline?.refresh('eyebank');
      return;
    }
    _eyeBankOfflineUiBound = true;
    global.CorneaRegistryOnline?.bindRegistryOfflineUi('eyebank', {
      bannerId: 'eyeBankOfflineBanner',
      registryLabel: 'Eye bank traceability',
      writeSelectors: [
        '#kpTissueTraceabilityPanel .btn-secondary:not([onclick*="exportTraceability"])',
        '#kpCustodyModal .btn-primary',
        '#kpColdChainModal .btn-primary'
      ]
    });
  }

  async function api(path, options) {
    return global.CorneaApi.request(path, options);
  }

  async function refresh() {
    _custody = await dbGetAll(STORE_CUSTODY);
    _cold = await dbGetAll(STORE_COLD);
  }

  function custodyForTissue(tissueLocalId) {
    return _custody.filter((e) => e.tissueLocalId === tissueLocalId)
      .sort((a, b) => String(b.occurredAt || b.kpCustodyAt).localeCompare(String(a.occurredAt || a.kpCustodyAt)));
  }

  function coldForTissue(tissueLocalId) {
    return _cold.filter((e) => e.tissueLocalId === tissueLocalId)
      .sort((a, b) => String(b.recordedAt || b.kpColdAt).localeCompare(String(a.recordedAt || a.kpColdAt)));
  }

  function quarantineBadge(status) {
    const s = status || 'Cleared';
    const cls = s === 'Quarantine' ? 'badge-urgent' : s === 'Failed' ? 'badge-emergency' : s === 'Released' ? 'badge-matched' : 'badge-available';
    return `<span class="badge ${cls}">${escapeHtml(s)}</span>`;
  }

  async function syncEventsFromCloud(tissue) {
    if (!apiOn() || !tissue?.uuid) return;
    try {
      const packet = await api(`/api/v1/eye-bank/tissues/${tissue.uuid}/traceability`);
      for (const e of packet?.data?.custodyEvents || []) {
        await dbPut(STORE_CUSTODY, {
          tissueLocalId: tissue.id,
          tissueUuid: tissue.uuid,
          uuid: e.id,
          kpCustodyType: e.eventType,
          kpCustodyFrom: e.fromParty,
          kpCustodyTo: e.toParty,
          kpCustodyActor: e.actorName,
          kpCustodyLocation: e.location,
          kpCustodyNotes: e.notes,
          kpCustodyAt: e.occurredAt
        });
      }
      for (const e of packet?.data?.coldChainEvents || []) {
        await dbPut(STORE_COLD, {
          tissueLocalId: tissue.id,
          tissueUuid: tissue.uuid,
          uuid: e.id,
          kpColdType: e.eventType,
          kpColdTemp: e.temperatureC,
          kpColdInRange: e.inRange,
          kpColdLocation: e.location,
          kpColdNotes: e.notes,
          kpColdBy: e.recordedBy,
          kpColdAt: e.recordedAt
        });
      }
      await refresh();
    } catch (err) {
      console.warn('[EyeBank] Cloud sync failed:', err.message);
    }
  }

  async function renderTissueTraceability(tissue) {
    const panel = document.getElementById('kpTissueTraceabilityPanel');
    if (!panel || !tissue) return;
    bindEyeBankOfflineUi();
    await refresh();
    if (apiOn() && tissue.uuid) await syncEventsFromCloud(tissue);

    const custody = custodyForTissue(tissue.id);
    const cold = coldForTissue(tissue.id);

    const custodyRows = custody.length ? custody.map((e) => `<tr>
      <td>${escapeHtml((e.kpCustodyAt || e.occurredAt || '').toString().slice(0, 16))}</td>
      <td>${escapeHtml(e.kpCustodyType || e.eventType)}</td>
      <td>${escapeHtml(e.kpCustodyFrom || '—')} → ${escapeHtml(e.kpCustodyTo || '—')}</td>
      <td>${escapeHtml(e.kpCustodyLocation || '—')}</td>
      <td>${escapeHtml(e.kpCustodyActor || '—')}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="text-muted">No custody events yet.</td></tr>';

    const coldRows = cold.length ? cold.map((e) => `<tr>
      <td>${escapeHtml((e.kpColdAt || e.recordedAt || '').toString().slice(0, 16))}</td>
      <td>${escapeHtml(e.kpColdType || e.eventType)}</td>
      <td>${e.kpColdTemp != null ? escapeHtml(e.kpColdTemp) + ' °C' : '—'}</td>
      <td>${e.kpColdInRange === false ? '<span class="badge badge-emergency">Out</span>' : e.kpColdInRange === true ? '<span class="badge badge-available">OK</span>' : '—'}</td>
      <td>${escapeHtml(e.kpColdLocation || '—')}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="text-muted">No cold-chain logs yet.</td></tr>';

    panel.innerHTML = `
      <div class="eye-bank-trace-panel">
        <div class="emr-toolbar" style="margin-bottom:10px;">
          <div class="emr-toolbar-title"><i class="fa-solid fa-link"></i> Eye bank traceability</div>
          <div class="emr-toolbar-actions no-print">
            <button type="button" class="btn-secondary btn-sm" onclick="CorneaEyeBank.openCustodyModal(${tissue.id})"><i class="fa-solid fa-truck"></i> Custody event</button>
            <button type="button" class="btn-secondary btn-sm" onclick="CorneaEyeBank.openColdChainModal(${tissue.id})"><i class="fa-solid fa-temperature-low"></i> Temp check</button>
            <button type="button" class="btn-secondary btn-sm" onclick="CorneaEyeBank.exportTraceability(${tissue.id})"><i class="fa-solid fa-file-export"></i> Export CSV</button>
          </div>
        </div>
        <div class="eye-bank-serology-grid">
          <div><strong>Donor ID</strong><br>${escapeHtml(tissue.kpDonorId || '—')}</div>
          <div><strong>Lot</strong><br>${escapeHtml(tissue.kpLotNumber || '—')}</div>
          <div><strong>Laterality</strong><br>${escapeHtml(tissue.kpTissueLaterality || '—')}</div>
          <div><strong>Quarantine</strong><br>${quarantineBadge(tissue.kpQuarantineStatus)}</div>
          <div><strong>HIV</strong><br>${escapeHtml(tissue.kpSerologyHiv || '—')}</div>
          <div><strong>HBV</strong><br>${escapeHtml(tissue.kpSerologyHbv || '—')}</div>
          <div><strong>HCV</strong><br>${escapeHtml(tissue.kpSerologyHcv || '—')}</div>
          <div><strong>Syphilis</strong><br>${escapeHtml(tissue.kpSerologySyphilis || '—')}</div>
        </div>
        <h4 style="margin:14px 0 6px;">Chain of custody</h4>
        <div class="table-scroll"><table class="records-table"><thead><tr>
          <th>When</th><th>Event</th><th>Transfer</th><th>Location</th><th>Actor</th>
        </tr></thead><tbody>${custodyRows}</tbody></table></div>
        <h4 style="margin:14px 0 6px;">Cold chain</h4>
        <div class="table-scroll"><table class="records-table"><thead><tr>
          <th>When</th><th>Event</th><th>Temp</th><th>Range</th><th>Location</th>
        </tr></thead><tbody>${coldRows}</tbody></table></div>
      </div>`;
    global.CorneaRegistryOnline?.refresh('eyebank');
  }

  global.CorneaEyeBank = {
    STORE_CUSTODY,
    STORE_COLD,
    ensureStores(db) {
      if (!db.objectStoreNames.contains(STORE_CUSTODY)) {
        const s = db.createObjectStore(STORE_CUSTODY, { keyPath: 'id', autoIncrement: true });
        s.createIndex('tissueLocalId', 'tissueLocalId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_COLD)) {
        const s = db.createObjectStore(STORE_COLD, { keyPath: 'id', autoIncrement: true });
        s.createIndex('tissueLocalId', 'tissueLocalId', { unique: false });
      }
    },
    renderTissueTraceability,
    quarantineBadge,
    openCustodyModal(tissueLocalId) {
      document.getElementById('kpCustodyTissueId').value = tissueLocalId;
      document.getElementById('kpCustodyAt').value = new Date().toISOString().slice(0, 16);
      global.openEmrModal('kpCustodyModal');
    },
    openColdChainModal(tissueLocalId) {
      document.getElementById('kpColdTissueId').value = tissueLocalId;
      document.getElementById('kpColdAt').value = new Date().toISOString().slice(0, 16);
      global.openEmrModal('kpColdChainModal');
    },
    async saveCustodyEvent() {
      if (!guardCloudRegistryWrite()) return;
      const tissueLocalId = Number(document.getElementById('kpCustodyTissueId')?.value);
      const tissue = (global._kpTissuesCache || []).find((t) => t.id === tissueLocalId);
      const row = {
        tissueLocalId,
        tissueUuid: tissue?.uuid,
        kpCustodyType: document.getElementById('kpCustodyType')?.value,
        kpCustodyFrom: document.getElementById('kpCustodyFrom')?.value,
        kpCustodyTo: document.getElementById('kpCustodyTo')?.value,
        kpCustodyLocation: document.getElementById('kpCustodyLocation')?.value,
        kpCustodyNotes: document.getElementById('kpCustodyNotes')?.value,
        kpCustodyAt: document.getElementById('kpCustodyAt')?.value
      };
      if (!row.kpCustodyType) { alert('Event type required.'); return; }
      await dbPut(STORE_CUSTODY, row);
      if (apiOn() && tissue?.uuid) {
        try {
          await api(`/api/v1/eye-bank/tissues/${tissue.uuid}/custody-events`, {
            method: 'POST',
            body: JSON.stringify({
              eventType: row.kpCustodyType,
              fromParty: row.kpCustodyFrom,
              toParty: row.kpCustodyTo,
              location: row.kpCustodyLocation,
              notes: row.kpCustodyNotes,
              occurredAt: row.kpCustodyAt ? new Date(row.kpCustodyAt).toISOString() : undefined
            })
          });
        } catch (err) {
          console.warn('[EyeBank] Custody push failed:', err.message);
        }
      }
      global.closeEmrModal('kpCustodyModal');
      if (tissue) await renderTissueTraceability(tissue);
    },
    async saveColdChainEvent() {
      if (!guardCloudRegistryWrite()) return;
      const tissueLocalId = Number(document.getElementById('kpColdTissueId')?.value);
      const tissue = (global._kpTissuesCache || []).find((t) => t.id === tissueLocalId);
      const temp = document.getElementById('kpColdTemp')?.value;
      const row = {
        tissueLocalId,
        tissueUuid: tissue?.uuid,
        kpColdType: document.getElementById('kpColdType')?.value || 'Storage check',
        kpColdTemp: temp === '' ? null : Number(temp),
        kpColdLocation: document.getElementById('kpColdLocation')?.value,
        kpColdNotes: document.getElementById('kpColdNotes')?.value,
        kpColdAt: document.getElementById('kpColdAt')?.value
      };
      if (row.kpColdTemp != null) {
        row.kpColdInRange = row.kpColdTemp >= 2 && row.kpColdTemp <= 8;
      }
      await dbPut(STORE_COLD, row);
      if (apiOn() && tissue?.uuid) {
        try {
          await api(`/api/v1/eye-bank/tissues/${tissue.uuid}/cold-chain-events`, {
            method: 'POST',
            body: JSON.stringify({
              eventType: row.kpColdType,
              temperatureC: row.kpColdTemp,
              inRange: row.kpColdInRange,
              location: row.kpColdLocation,
              notes: row.kpColdNotes,
              recordedAt: row.kpColdAt ? new Date(row.kpColdAt).toISOString() : undefined
            })
          });
        } catch (err) {
          console.warn('[EyeBank] Cold chain push failed:', err.message);
        }
      }
      global.closeEmrModal('kpColdChainModal');
      if (tissue) await renderTissueTraceability(tissue);
    },
    async exportTraceability(tissueLocalId) {
      const tissue = (global._kpTissuesCache || []).find((t) => t.id === tissueLocalId);
      if (!tissue) return;
      if (apiOn() && tissue.uuid) {
        try {
          const base = (global.CorneaApi?.getBaseUrl?.() || '').replace(/\/$/, '');
          const token = localStorage.getItem('corneaEmr_apiToken');
          const res = await fetch(`${base}/api/v1/eye-bank/tissues/${tissue.uuid}/traceability/export.csv`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (!res.ok) throw new Error(res.statusText);
          const blob = await res.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `eye-bank-${tissue.kpTissueId || tissue.uuid}.csv`;
          a.click();
          return;
        } catch (err) {
          console.warn('[EyeBank] Export API failed, building local CSV:', err.message);
        }
      }
      const lines = ['Field,Value', `Tissue ID,${tissue.kpTissueId}`, `Donor ID,${tissue.kpDonorId || ''}`, `Quarantine,${tissue.kpQuarantineStatus || ''}`];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `eye-bank-${tissue.kpTissueId || 'tissue'}.csv`;
      a.click();
    }
  };

  global.saveKpCustodyEvent = () => global.CorneaEyeBank.saveCustodyEvent();
  global.saveKpColdChainEvent = () => global.CorneaEyeBank.saveColdChainEvent();
})(typeof window !== 'undefined' ? window : globalThis);
