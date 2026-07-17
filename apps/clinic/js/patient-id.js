/**
 * Shared patient identity helpers — one Patient ID (MRN) across all stations.
 */
(function patientIdModule(global) {
  'use strict';

  /**
   * Patient ID from the active Patient Records visit form.
   * @returns {string}
   */
  function getActiveMrn() {
    return document.getElementById('patientId')?.value?.trim() || '';
  }

  /**
   * Prefill a registry field from the active visit when empty.
   * @param {string} fieldId
   * @returns {string}
   */
  function prefillField(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return '';
    if (!el.value.trim()) {
      const mrn = getActiveMrn();
      if (mrn) el.value = mrn;
    }
    return el.value.trim();
  }

  /**
   * Best display Patient ID on a registry or visit row.
   * @param {Record<string, unknown>} record
   * @returns {string}
   */
  function displayPatientId(record) {
    if (!record) return '—';
    return String(
      record.kpEmrPatientMrn
      || record.kcEmrPatientMrn
      || record.deMrn
      || record.ukEmrMrn
      || record.emrPatientMrn
      || record.patientId
      || record.mrn
      || ''
    ).trim() || '—';
  }

  /**
   * Next CC-YYYY-NNNN from local visits; falls back to API when online.
   * @returns {Promise<string>}
   */
  async function nextLocalMrn() {
    const year = new Date().getFullYear();
    const prefix = `CC-${year}-`;
    let max = 0;

    const scan = (records) => {
      for (const r of records || []) {
        const id = String(r.patientId || r.mrn || '').trim();
        if (!id.startsWith(prefix)) continue;
        const n = parseInt(id.slice(prefix.length), 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    };

    if (global.db && global.STORE_NAME) {
      try {
        const all = await new Promise((resolve, reject) => {
          const tx = global.db.transaction(global.STORE_NAME, 'readonly');
          const req = tx.objectStore(global.STORE_NAME).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        scan(all);
      } catch (_) { /* offline/local only */ }
    }

    if (global.CorneaSync?.api?.get) {
      try {
        const res = await global.CorneaSync.api.get('/patients/next-mrn');
        if (res?.data?.mrn) return res.data.mrn;
      } catch (_) { /* use local sequence */ }
    }

    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Ensure registry save payload carries Patient ID; prefill from active visit if needed.
   * @param {string} fieldId
   * @returns {string}
   */
  function requireMrnForRegistry(fieldId) {
    const mrn = prefillField(fieldId);
    if (!mrn) {
      alert('Patient ID is required. Enter the same ID used in Patient Records, or open a patient visit first.');
    }
    return mrn;
  }

  global.CorneaPatientId = {
    getActiveMrn,
    prefillField,
    displayPatientId,
    nextLocalMrn,
    requireMrnForRegistry
  };
})(window);
