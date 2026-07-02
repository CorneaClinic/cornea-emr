/**
 * Per-section edit attribution on patient visit forms.
 * Shows who last changed each section and when (user, date, time).
 */
(function (global) {
  'use strict';

  const TITLE_TO_KEY = {
    'Patient Information': 'patient_info',
    'Clinical History': 'clinical_history',
    'Vision & Refraction': 'refraction',
    'Investigations & Vitals': 'vitals',
    'Anterior Segment Examination': 'anterior_segment',
    'Anterior Segment Drawing': 'anterior_drawing',
    'Fundus Examination': 'fundus',
    'Diagnosis & Management Plan': 'diagnosis_plan',
    'Opinion & Referral Notes': 'opinion_referral',
    'Documents & Clinical Images': 'documents',
    'Contact Lens': 'contact_lens',
    'Laser Refractive Work-up': 'laser_refractive',
    'Follow Up': 'follow_up'
  };

  /** @type {Record<string, { title: string, fieldIds: string[], radioNames: string[] }>} */
  let registry = {};
  let initialized = false;

  function titleToKey(title) {
    return TITLE_TO_KEY[title] || null;
  }

  function currentActor() {
    if (global.__corneaCloudMode && global.__corneaUser) {
      return {
        userId: global.__corneaUser.id || null,
        userName: global.__corneaUser.fullName || global.__corneaUser.email || 'Cloud user'
      };
    }
    const offline = global.CorneaOfflineAuth?.getCurrentUser?.();
    if (offline) {
      return {
        userId: offline.id,
        userName: offline.fullName || offline.username || 'Offline user'
      };
    }
    return { userId: null, userName: 'Unknown user' };
  }

  function stampEntry() {
    const actor = currentActor();
    const now = new Date();
    return {
      userId: actor.userId,
      userName: actor.userName,
      at: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8)
    };
  }

  function discoverRegistry() {
    registry = {};
    const form = document.getElementById('patientForm');
    if (!form) return;

    form.querySelectorAll('.form-card').forEach((card) => {
      const title = card.querySelector('.form-card-header h3')?.textContent?.trim();
      const key = titleToKey(title);
      if (!key) return;

      const fieldIds = [];
      const radioNames = new Set();
      card.querySelectorAll('input, textarea, select').forEach((el) => {
        if (el.id && !['currentRecordId', 'currentRecordUuid'].includes(el.id)) {
          fieldIds.push(el.id);
        }
        if (el.type === 'radio' && el.name) radioNames.add(el.name);
      });

      registry[key] = {
        title,
        fieldIds,
        radioNames: [...radioNames]
      };

      const header = card.querySelector('.form-card-header');
      if (header && !header.querySelector(`[data-section-key="${key}"]`)) {
        const badge = document.createElement('div');
        badge.className = 'section-attribution';
        badge.setAttribute('data-section-key', key);
        badge.setAttribute('aria-live', 'polite');
        header.appendChild(badge);
      }
    });
  }

  function snapshotSection(data, sectionKey) {
    if (!data || !registry[sectionKey]) return {};
    const snap = {};
    for (const id of registry[sectionKey].fieldIds) {
      if (Object.prototype.hasOwnProperty.call(data, id)) {
        snap[id] = data[id] ?? '';
      }
    }
    for (const name of registry[sectionKey].radioNames) {
      if (Object.prototype.hasOwnProperty.call(data, name)) {
        snap[`radio:${name}`] = data[name] ?? '';
      }
    }
    return snap;
  }

  function sectionHasContent(snap) {
    return Object.values(snap).some((v) => String(v ?? '').trim() !== '');
  }

  function snapshotsEqual(a, b) {
    return (global.safeJsonStringify || JSON.stringify)(a) === (global.safeJsonStringify || JSON.stringify)(b);
  }

  function enrichFormData(data) {
    const out = { ...(data || {}) };
    const ma = document.getElementById('medicalAdviceJSON');
    if (ma) out.medicalAdviceJSON = ma.value;
    const vm = document.getElementById('visitMediaJSON');
    if (vm) out.visitMediaJSON = vm.value;
    const dj = document.getElementById('anteriorDrawingJSON');
    if (dj) out.anteriorDrawingJSON = dj.value;
    const di = document.getElementById('anteriorDrawingImage');
    if (di) out.anteriorDrawingImage = di.value;
    return out;
  }

  /**
   * Merge section attribution based on diffs between old and new record data.
   * @param {object|null} existingAttribution
   * @param {object|null} oldData
   * @param {object} newData
   */
  function mergeAttribution(existingAttribution, oldData, newData) {
    const attr = { ...(existingAttribution || {}) };
    const enrichedNew = enrichFormData(newData);
    const enrichedOld = oldData ? enrichFormData(oldData) : null;

    for (const key of Object.keys(registry)) {
      const newSnap = snapshotSection(enrichedNew, key);
      const oldSnap = enrichedOld ? snapshotSection(enrichedOld, key) : {};

      if (!enrichedOld) {
        if (sectionHasContent(newSnap)) attr[key] = stampEntry();
      } else if (!snapshotsEqual(oldSnap, newSnap)) {
        attr[key] = stampEntry();
      }
    }
    return attr;
  }

  function formatEntry(entry) {
    if (!entry?.userName) return '';
    let when = '';
    if (entry.at) {
      try {
        when = new Date(entry.at).toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (_) {
        when = [entry.date, entry.time].filter(Boolean).join(' ');
      }
    } else {
      when = [entry.date, entry.time].filter(Boolean).join(' ');
    }
    return `${entry.userName}${when ? ` · ${when}` : ''}`;
  }

  function formatHeaderHtml(entry) {
    if (!entry) return '';
    const text = formatEntry(entry);
    if (!text) return '';
    return `<span class="section-attribution-inline"><i class="fa-solid fa-user-pen" aria-hidden="true"></i> Last edited: ${escapeHtml(text)}</span>`;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderForm(sectionAttribution) {
    if (!initialized) init();
    document.querySelectorAll('.section-attribution[data-section-key]').forEach((el) => {
      const key = el.getAttribute('data-section-key');
      const entry = sectionAttribution?.[key];
      if (entry) {
        el.innerHTML = formatHeaderHtml(entry);
        el.style.display = '';
      } else {
        el.innerHTML = '';
        el.style.display = 'none';
      }
    });
  }

  function ensureStyles() {
    if (document.getElementById('corneaSectionAttributionStyles')) return;
    const style = document.createElement('style');
    style.id = 'corneaSectionAttributionStyles';
    style.textContent = `
      .form-card-header {
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .form-card-header h3 { flex: 1 1 auto; margin: 0; }
      .section-attribution {
        flex: 1 1 100%;
        font-size: 0.78rem;
        font-weight: 400;
        color: var(--text-secondary, #5a6b7d);
        margin: 2px 0 0 44px;
        line-height: 1.4;
      }
      .section-attribution-inline i { margin-right: 5px; opacity: 0.85; }
      .emr-ro-section-header .section-attribution-inline {
        display: block;
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--text-secondary, #5a6b7d);
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureStyles();
    discoverRegistry();
    installSaveHook();
  }

  async function getExistingRecord(id) {
    if (!global.db || id == null) return null;
    return new Promise((resolve) => {
      const req = global.db.transaction(['patients'], 'readonly')
        .objectStore('patients').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  function installSaveHook() {
    if (!global.CorneaSync || installSaveHook._done) return;
    installSaveHook._done = true;

    const orig = global.CorneaSync.saveVisitLocal.bind(global.CorneaSync);
    global.CorneaSync.saveVisitLocal = async function (data) {
      const existing = data?.id != null ? await getExistingRecord(data.id) : null;
      data.sectionAttribution = mergeAttribution(
        existing?.sectionAttribution,
        existing,
        data
      );
      return orig(data);
    };
  }

  global.CorneaSectionAttribution = {
    init,
    titleToKey,
    mergeAttribution,
    enrichFormData,
    renderForm,
    formatHeaderHtml,
    formatEntry,
    keyForTitle: titleToKey,

    applyBeforeSave(data, existingRecord) {
      if (!initialized) init();
      data.sectionAttribution = mergeAttribution(
        existingRecord?.sectionAttribution,
        existingRecord,
        data
      );
      return data;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    setTimeout(init, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
