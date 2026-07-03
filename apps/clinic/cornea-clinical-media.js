/**
 * Clinical Media Library — search, timeline, advanced viewer, admin stats.
 * Requires cloud API (CorneaApi). Offline pending uploads remain in CorneaVisitMedia.
 */
(function (global) {
  'use strict';

  const CATEGORIES = [
    { value: '', label: 'All categories' },
    { value: 'slit_lamp', label: 'Slit Lamp' },
    { value: 'topography', label: 'Topography (Pentacam)' },
    { value: 'tomography', label: 'Tomography (Orbscan/Sirius)' },
    { value: 'as_oct', label: 'AS-OCT' },
    { value: 'specular', label: 'Specular Microscopy' },
    { value: 'confocal', label: 'Confocal Microscopy' },
    { value: 'corneal_drawing', label: 'Corneal Drawing' },
    { value: 'operative_photo', label: 'Operative Photo' },
    { value: 'video', label: 'Video' },
    { value: 'pdf_report', label: 'PDF Report' },
    { value: 'referral', label: 'Referral' },
    { value: 'teaching_case', label: 'Teaching Case' },
    { value: 'research', label: 'Research' },
    { value: 'other', label: 'Other' }
  ];

  let libraryItems = [];
  let compareLeft = null;
  let compareRight = null;
  let viewerState = { scale: 1, panX: 0, panY: 0, brightness: 100, rotation: 0 };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getBaseUrl() {
    const fromApi = global.CorneaApi?.getBaseUrl?.();
    if (fromApi) return String(fromApi).replace(/\/$/, '');
    const stored = localStorage.getItem('corneaEmr_apiBase') || '';
    if (stored) return stored.replace(/\/$/, '');
    return global.CorneaAuthPages?.getApiBase?.()?.replace(/\/$/, '') || '';
  }

  function isCloudReady() {
    return global.CorneaApi?.isEnabled?.() === true;
  }

  function getToken() {
    return global.CorneaApi?.getToken?.() || localStorage.getItem('corneaEmr_apiToken') || '';
  }

  async function apiFetch(path, opts) {
    const apiPath = path.startsWith('/api/v1') ? path : `/api/v1${path}`;

    if (global.CorneaApi?.request) {
      try {
        return await global.CorneaApi.request(apiPath, opts);
      } catch (err) {
        if (err.status === 401 && global.CorneaApi?.signIn) {
          const ok = await global.CorneaApi.signIn();
          if (ok) return await global.CorneaApi.request(apiPath, opts);
        }
        throw err;
      }
    }

    const base = getBaseUrl();
    const token = getToken();
    if (!base || !token) throw new Error('Cloud connection required');
    const res = await fetch(`${base}${apiPath}`, {
      ...opts,
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Device-Id': localStorage.getItem('corneaEmr_deviceId') || '',
        ...(opts?.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.error?.message || body.message || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function showLibraryAuthMessage(message) {
    const body = document.getElementById('clinicalMediaLibraryBody');
    if (body) {
      body.innerHTML = `<tr><td colspan="7" class="clinical-media-empty">${escapeHtml(message)}</td></tr>`;
    }
    const meta = document.getElementById('clinicalMediaLibraryMeta');
    if (meta) meta.textContent = '';
  }

  async function handleLibraryError(err) {
    const msg = String(err?.message || err);
    if (err?.status === 401 || /expired|authentication required|invalid.*token/i.test(msg)) {
      showLibraryAuthMessage('Session expired — use Sign in to Cloud in the header, then click Refresh.');
      return;
    }
    if (msg === 'Cloud connection required') {
      showLibraryAuthMessage('Sign in to cloud to load media library.');
      return;
    }
    alert(msg);
  }

  function categoryLabel(v) {
    return CATEGORIES.find((c) => c.value === v)?.label || v || '—';
  }

  function formatBytes(n) {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function resolveAssetUrl(asset) {
    try {
      const signed = await apiFetch(`/media/${asset.id}/signed-url`);
      if (signed?.data?.url) return signed.data.url;
    } catch (_) { /* fall through */ }
    const base = getBaseUrl();
    const token = getToken();
    const res = await fetch(`${base}/api/v1/media/${asset.id}/content`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not load media');
    return URL.createObjectURL(await res.blob());
  }

  function renderLibraryTable() {
    const body = document.getElementById('clinicalMediaLibraryBody');
    if (!body) return;
    if (!libraryItems.length) {
      body.innerHTML = '<tr><td colspan="7" class="clinical-media-empty">No media found. Upload from Patient Form or connect to cloud.</td></tr>';
      return;
    }
    body.innerHTML = libraryItems.map((a) => {
      const patient = a.patientName || a.patientMrn || '—';
      const date = (a.link?.capturedAt || a.createdAt || '').slice(0, 10);
      return `<tr data-id="${escapeHtml(a.id)}">
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(categoryLabel(a.category))}</td>
        <td>${escapeHtml(a.originalFilename)}</td>
        <td>${escapeHtml(patient)}</td>
        <td>${escapeHtml(a.link?.diagnosisLabel || a.visitDiagnosis || '—')}</td>
        <td>${formatBytes(a.byteSize)}</td>
        <td class="clinical-media-actions">
          <button type="button" class="btn-secondary btn-sm" data-action="view" data-id="${escapeHtml(a.id)}">View</button>
          <button type="button" class="btn-secondary btn-sm" data-action="compare-a" data-id="${escapeHtml(a.id)}">A</button>
          <button type="button" class="btn-secondary btn-sm" data-action="compare-b" data-id="${escapeHtml(a.id)}">B</button>
          <button type="button" class="btn-secondary btn-sm" data-action="download" data-id="${escapeHtml(a.id)}">↓</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function loadLibrary() {
    if (!isCloudReady()) {
      showLibraryAuthMessage('Sign in to cloud to load media library.');
      return;
    }
    const search = document.getElementById('clinicalMediaSearch')?.value?.trim() || '';
    const category = document.getElementById('clinicalMediaCategoryFilter')?.value || '';
    const qs = new URLSearchParams({ limit: '100', sort: 'created_at', dir: 'desc' });
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    const json = await apiFetch(`/media-library?${qs}`);
    libraryItems = json.data || [];
    renderLibraryTable();
    const meta = document.getElementById('clinicalMediaLibraryMeta');
    if (meta) meta.textContent = `${json.meta?.total ?? libraryItems.length} items`;
  }

  async function loadTimeline() {
    const patientId = document.getElementById('patientId')?.value?.trim();
    const el = document.getElementById('clinicalMediaTimeline');
    if (!el) return;
    if (!patientId) {
      el.innerHTML = '<p class="clinical-media-hint">Enter a Patient ID on the form to view cornea media timeline.</p>';
      return;
    }
    const patients = await apiFetch(`/patients?search=${encodeURIComponent(patientId)}`).catch(() => null);
    let uuid = null;
    if (patients?.data?.length) {
      const match = patients.data.find((p) => p.mrn === patientId || p.fullName === patientId);
      uuid = match?.id;
    }
    if (!uuid) {
      el.innerHTML = '<p class="clinical-media-hint">Patient not found in cloud — save and sync first.</p>';
      return;
    }
    const json = await apiFetch(`/media-library/timeline/patient/${uuid}`);
    const items = json.data || [];
    if (!items.length) {
      el.innerHTML = '<p class="clinical-media-hint">No timeline media for this patient yet.</p>';
      return;
    }
    el.innerHTML = items.map((a) => `
      <div class="clinical-media-timeline-item" data-id="${escapeHtml(a.id)}">
        <div class="clinical-media-timeline-date">${escapeHtml((a.link?.capturedAt || a.createdAt || '').slice(0, 10))}</div>
        <div class="clinical-media-timeline-body">
          <strong>${escapeHtml(categoryLabel(a.category))}</strong>
          ${a.link?.procedureLabel ? ` · ${escapeHtml(a.link.procedureLabel)}` : ''}
          ${a.link?.diagnosisLabel || a.visitDiagnosis ? `<div>${escapeHtml(a.link?.diagnosisLabel || a.visitDiagnosis)}</div>` : ''}
          <div class="clinical-media-timeline-file">${escapeHtml(a.originalFilename)}</div>
          <button type="button" class="btn-link btn-sm timeline-view" data-id="${escapeHtml(a.id)}">View</button>
        </div>
      </div>`).join('');
  }

  async function openViewer(assetId) {
    const asset = libraryItems.find((a) => a.id === assetId);
    if (!asset) return;
    const modal = document.getElementById('clinicalMediaViewerModal');
    const canvas = document.getElementById('clinicalMediaViewerCanvas');
    const meta = document.getElementById('clinicalMediaViewerMeta');
    if (!modal || !canvas) return;
    viewerState = { scale: 1, panX: 0, panY: 0, brightness: 100, rotation: 0 };
    meta.textContent = `${categoryLabel(asset.category)} · ${asset.originalFilename} · ${formatBytes(asset.byteSize)}`;
    const url = await resolveAssetUrl(asset);
    if ((asset.mimeType || '').startsWith('image/')) {
      canvas.innerHTML = `<img src="${url}" alt="" id="clinicalMediaViewerImg" style="filter:brightness(${viewerState.brightness}%);transform:rotate(${viewerState.rotation}deg) scale(${viewerState.scale});" />`;
    } else {
      canvas.innerHTML = `<iframe src="${url}" title="preview"></iframe>`;
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function loadAdminStats() {
    const el = document.getElementById('clinicalMediaAdminStats');
    if (!el) return;
    try {
      const json = await apiFetch('/media-library/admin/stats');
      const s = json.data;
      el.innerHTML = `<ul class="clinical-media-stats">
        <li>Storage: <strong>${escapeHtml(s.storageProvider)}</strong>${s.bucket ? ` · ${escapeHtml(s.bucket)}` : ''}</li>
        <li>Total files: <strong>${s.totalCount}</strong> (${formatBytes(s.totalBytes)})</li>
        <li>Archived: ${s.archivedCount} · Videos: ${s.videoCount}</li>
        <li>Upload failures (7d): ${s.uploadFailures7d}</li>
        <li>Orphaned (no link): ${(s.orphanedLinks || []).length}</li>
      </ul>`;
    } catch (err) {
      el.textContent = err.message;
    }
  }

  function bindEvents() {
    document.getElementById('clinicalMediaRefreshBtn')?.addEventListener('click', () => {
      loadLibrary().catch(handleLibraryError);
      loadTimeline().catch(() => {});
      loadAdminStats().catch(() => {});
    });
    document.getElementById('clinicalMediaSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadLibrary().catch(handleLibraryError);
    });
    document.getElementById('clinicalMediaCategoryFilter')?.addEventListener('change', () => {
      loadLibrary().catch(handleLibraryError);
    });
    document.getElementById('clinicalMediaLibraryBody')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'view') openViewer(id).catch((err) => alert(err.message));
      if (action === 'compare-a') compareLeft = libraryItems.find((a) => a.id === id);
      if (action === 'compare-b') compareRight = libraryItems.find((a) => a.id === id);
      if (action === 'compare-a' || action === 'compare-b') updateComparePanel();
      if (action === 'download') {
        const url = await resolveAssetUrl(libraryItems.find((a) => a.id === id));
        const a = document.createElement('a');
        a.href = url;
        a.download = libraryItems.find((x) => x.id === id)?.originalFilename || 'download';
        a.click();
      }
    });
    document.getElementById('clinicalMediaTimeline')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.timeline-view');
      if (btn) openViewer(btn.dataset.id).catch((err) => alert(err.message));
    });
    document.getElementById('clinicalMediaViewerClose')?.addEventListener('click', () => {
      document.getElementById('clinicalMediaViewerModal')?.classList.remove('is-open');
    });
    document.getElementById('clinicalMediaZoomIn')?.addEventListener('click', () => adjustViewerScale(0.2));
    document.getElementById('clinicalMediaZoomOut')?.addEventListener('click', () => adjustViewerScale(-0.2));
    document.getElementById('clinicalMediaRotate')?.addEventListener('click', () => {
      viewerState.rotation = (viewerState.rotation + 90) % 360;
      applyViewerTransform();
    });
    document.getElementById('clinicalMediaBrightness')?.addEventListener('input', (e) => {
      viewerState.brightness = Number(e.target.value) || 100;
      applyViewerTransform();
    });
  }

  function adjustViewerScale(delta) {
    viewerState.scale = Math.max(0.2, Math.min(5, viewerState.scale + delta));
    applyViewerTransform();
  }

  function applyViewerTransform() {
    const img = document.getElementById('clinicalMediaViewerImg');
    if (img) {
      img.style.filter = `brightness(${viewerState.brightness}%)`;
      img.style.transform = `rotate(${viewerState.rotation}deg) scale(${viewerState.scale})`;
    }
  }

  async function updateComparePanel() {
    const el = document.getElementById('clinicalMediaComparePanel');
    if (!el) return;
    const parts = [];
    if (compareLeft) {
      const url = await resolveAssetUrl(compareLeft);
      parts.push(`<div><h4>A: ${escapeHtml(compareLeft.originalFilename)}</h4><img src="${url}" alt="" /></div>`);
    }
    if (compareRight) {
      const url = await resolveAssetUrl(compareRight);
      parts.push(`<div><h4>B: ${escapeHtml(compareRight.originalFilename)}</h4><img src="${url}" alt="" /></div>`);
    }
    el.innerHTML = parts.length ? parts.join('') : '<p class="clinical-media-hint">Select A and B from the library table to compare.</p>';
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('clinicalMediaCategoryFilter');
    if (!sel || sel.options.length > 1) return;
    CATEGORIES.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.value;
      o.textContent = c.label;
      sel.appendChild(o);
    });
  }

  function init() {
    populateCategoryFilter();
    bindEvents();
    if (isCloudReady()) {
      loadLibrary().catch(handleLibraryError);
      loadAdminStats().catch(() => {});
    }
  }

  global.CorneaClinicalMedia = {
    init,
    loadLibrary,
    loadTimeline,
    CATEGORIES
  };
})(window);
