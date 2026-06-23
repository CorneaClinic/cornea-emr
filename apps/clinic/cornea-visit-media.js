/**

 * Visit documents & clinical image uploads (local-first + cloud sync).

 */

(function (global) {

  'use strict';



  const MAX_BYTES = 25 * 1024 * 1024;

  const CATEGORIES = [

    { value: 'slit_lamp', label: 'Slit Lamp Photo', accept: 'image/*' },

    { value: 'topography', label: 'Topography (Pentacam)', accept: 'image/*' },

    { value: 'tomography', label: 'Tomography (Orbscan/Sirius)', accept: 'image/*' },

    { value: 'corneal_topography', label: 'Corneal Topography (legacy)', accept: 'image/*' },

    { value: 'as_oct', label: 'AS-OCT Scan', accept: 'image/*' },

    { value: 'specular', label: 'Specular Microscopy', accept: 'image/*' },

    { value: 'confocal', label: 'Confocal Microscopy', accept: 'image/*' },

    { value: 'corneal_drawing', label: 'Corneal Drawing', accept: 'image/*' },

    { value: 'operative_photo', label: 'Operative Photo', accept: 'image/*' },

    { value: 'video', label: 'Surgical Video', accept: 'video/mp4,video/webm' },

    { value: 'pdf_report', label: 'PDF Report', accept: 'application/pdf,.pdf' },

    { value: 'document', label: 'Clinical Document (PDF)', accept: 'application/pdf,.pdf' },

    { value: 'referral', label: 'Referral Letter', accept: 'application/pdf,image/*' },

    { value: 'other', label: 'Other', accept: 'image/*,application/pdf,video/mp4' }

  ];



  /** @type {{ items: object[] }} */

  let state = { items: [] };

  let previewBlobUrl = null;



  function revokePreviewBlob() {

    if (previewBlobUrl) {

      URL.revokeObjectURL(previewBlobUrl);

      previewBlobUrl = null;

    }

  }



  function isImageItem(item) {

    return (item.mimeType || '').startsWith('image/');

  }



  function isPdfItem(item) {

    return item.category === 'document'

      || item.mimeType === 'application/pdf'

      || /\.pdf$/i.test(item.filename || '');

  }



  async function resolveItemUrl(item) {

    if (item.dataUrl) return item.dataUrl;

    if (item.blobLocalId && global.CorneaMediaBlobStore) {

      const rec = await global.CorneaMediaBlobStore.getBlob(item.blobLocalId);

      if (rec?.blob) {

        revokePreviewBlob();

        previewBlobUrl = URL.createObjectURL(rec.blob);

        return previewBlobUrl;

      }

    }

    const baseUrl = getBaseUrl();

    const token = getToken();

    if (!item.serverAssetId || !baseUrl || !token) return null;

    const res = await fetch(`${baseUrl}/api/v1/media/${item.serverAssetId}/content`, {

      headers: { Authorization: `Bearer ${token}` }

    });

    if (!res.ok) throw new Error('Could not load file');

    const blob = await res.blob();

    revokePreviewBlob();

    previewBlobUrl = URL.createObjectURL(blob);

    return previewBlobUrl;

  }



  function updateBrowserVisibility() {

    const empty = document.getElementById('visitMediaEmpty');

    const browser = document.getElementById('visitMediaBrowser');

    const hasItems = state.items.length > 0;

    if (empty) empty.hidden = hasItems;

    if (browser) browser.hidden = !hasItems;

  }



  async function showPreviewModal(item) {

    const modalId = 'visitMediaPreviewModal';

    const titleEl = document.getElementById('visitMediaPreviewModalTitle');

    const bodyEl = document.getElementById('visitMediaPreviewModalBody');

    if (!bodyEl) return;



    const title = item.label || item.filename || 'Preview';

    if (titleEl) titleEl.textContent = title;

    bodyEl.innerHTML = `<div class="visit-media-preview-loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading preview…</div>`;



    if (typeof global.openEmrModal === 'function') {

      global.openEmrModal(modalId);

    } else {

      const modal = document.getElementById(modalId);

      if (modal) {

        modal.classList.add('is-open');

        modal.setAttribute('aria-hidden', 'false');

        document.body.classList.add('emr-modal-open');

      }

    }



    try {

      const url = await resolveItemUrl(item);

      const eye = item.eye ? ` · ${escapeHtml(item.eye)}` : '';

      const meta = `${escapeHtml(categoryLabel(item.category))}${eye}${item.size ? ' · ' + formatSize(item.size) : ''}`;

      let content = '';



      if (url && isImageItem(item)) {

        content = `<img src="${url}" alt="${escapeHtml(title)}" />`;

      } else if (url && isPdfItem(item)) {

        content = `<iframe src="${url}" title="${escapeHtml(title)}"></iframe>`;

      } else if (url) {

        content = `<div class="visit-media-preview-empty">

          <i class="fa-solid fa-file" aria-hidden="true"></i>

          Preview not available for this file type

          <br><a href="${url}" target="_blank" rel="noopener" class="visit-media-preview-open"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open file</a>

        </div>`;

      } else {

        content = `<div class="visit-media-preview-empty">

          <i class="fa-solid fa-cloud" aria-hidden="true"></i>

          File is stored on the server. Connect to cloud mode to preview, or save and sync first.

        </div>`;

      }



      bodyEl.innerHTML = `<div class="visit-media-preview-modal-meta">${meta}</div>

        <div class="visit-media-preview-modal-body">${content}</div>`;

    } catch (err) {

      bodyEl.innerHTML = `<div class="visit-media-preview-empty">

        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>

        Could not load preview${err.message ? ': ' + escapeHtml(err.message) : ''}

      </div>`;

    }

  }



  function uid() {

    return 'vm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

  }



  function getToken() {

    return localStorage.getItem('corneaEmr_apiToken') || '';

  }



  function getBaseUrl() {

    return (localStorage.getItem('corneaEmr_apiBase') || '').replace(/\/$/, '');

  }



  function getVisitUuid() {

    return document.getElementById('currentRecordUuid')?.value?.trim() || '';

  }



  function escapeHtml(str) {

    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  }



  function categoryLabel(value) {

    const cat = CATEGORIES.find((c) => c.value === value);

    return cat ? cat.label : value;

  }



  function apiCategory(value) {

    const map = {

      document: 'pdf_report',

      corneal_topography: 'topography',

      drawing: 'corneal_drawing'

    };

    return map[value] || value;

  }



  function syncHiddenField() {

    const el = document.getElementById('visitMediaJSON');

    if (!el) return;

    const payload = {

      items: state.items.map((item) => {

        const copy = { ...item };

        if (copy.serverAssetId) {

          delete copy.dataUrl;

          delete copy.blobLocalId;

        }

        return copy;

      })

    };

    el.value = JSON.stringify(payload);

  }



  function readFileAsDataUrl(file) {

    return new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);

      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));

      reader.readAsDataURL(file);

    });

  }



  function renderList() {

    const list = document.getElementById('visitMediaList');

    if (!list) return;



    updateBrowserVisibility();



    if (!state.items.length) {

      list.innerHTML = '';

      return;

    }



    list.innerHTML = state.items.map((item) => {

      const isImage = isImageItem(item);

      const thumb = isImage && item.dataUrl

        ? `<img src="${item.dataUrl}" alt="" class="visit-media-thumb" />`

        : `<div class="visit-media-thumb visit-media-thumb-doc"><i class="fa-solid ${isPdfItem(item) ? 'fa-file-pdf' : 'fa-file-image'}"></i></div>`;

      const status = item.serverAssetId

        ? '<span class="visit-media-badge synced"><i class="fa-solid fa-cloud"></i> Synced</span>'

        : '<span class="visit-media-badge pending"><i class="fa-solid fa-clock"></i> Pending sync</span>';

      return `<div class="visit-media-item" data-local-id="${escapeHtml(item.localId)}">

        ${thumb}

        <div class="visit-media-meta">

          <strong>${escapeHtml(item.label || item.filename)}</strong>

          <span>${escapeHtml(categoryLabel(item.category))}${item.eye ? ' · ' + escapeHtml(item.eye) : ''}</span>

          <span class="visit-media-size">${formatSize(item.size)}</span>

          ${status}

        </div>

        <div class="visit-media-item-actions no-print">

          <button type="button" class="btn-secondary btn-sm visit-media-preview-btn" title="Preview"

            onclick="CorneaVisitMedia.openPreview('${escapeHtml(item.localId)}')">

            <i class="fa-solid fa-eye"></i> Preview

          </button>

          <button type="button" class="btn-danger btn-sm visit-media-remove" title="Remove"

            onclick="CorneaVisitMedia.removeItem('${escapeHtml(item.localId)}')">

            <i class="fa-solid fa-trash"></i>

          </button>

        </div>

      </div>`;

    }).join('');

  }



  function formatSize(bytes) {

    if (!bytes) return '';

    if (bytes < 1024) return bytes + ' B';

    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';

    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';

  }



  async function uploadItem(item, visitUuid) {

    const baseUrl = getBaseUrl();

    const token = getToken();

    if (!baseUrl || !token || !visitUuid) return false;

    let blob = null;

    if (item.blobLocalId && global.CorneaMediaBlobStore) {

      const rec = await global.CorneaMediaBlobStore.getBlob(item.blobLocalId);

      blob = rec?.blob || null;

    }

    if (!blob && item.dataUrl) blob = await dataUrlToBlob(item.dataUrl);

    if (!blob) return false;

    const form = new FormData();

    form.append('file', blob, item.filename);

    form.append('category', apiCategory(item.category));

    if (item.eye) form.append('eye', item.eye);

    form.append('label', item.label || item.filename);

    if (item.category === 'document' || item.category === 'pdf_report') {

      form.append('metadata', JSON.stringify({ kind: 'clinical_document' }));

    }

    form.append('moduleName', 'visit_media');

    if (document.getElementById('diagnosis')?.value) {

      form.append('diagnosisLabel', document.getElementById('diagnosis').value.slice(0, 500));

    }



    const res = await fetch(`${baseUrl}/api/v1/visits/${visitUuid}/media`, {

      method: 'POST',

      headers: { Authorization: `Bearer ${token}` },

      body: form

    });



    if (!res.ok) {

      const body = await res.json().catch(() => ({}));

      throw new Error(body.error?.message || body.message || `Upload failed (${res.status})`);

    }



    const body = await res.json();

    item.serverAssetId = body.data?.id || null;

    item.uploadedAt = new Date().toISOString();

    delete item.dataUrl;

    if (item.blobLocalId && global.CorneaMediaBlobStore) {

      await global.CorneaMediaBlobStore.deleteBlob(item.blobLocalId);

      delete item.blobLocalId;

    }

    return true;

  }



  async function dataUrlToBlob(dataUrl) {

    const res = await fetch(dataUrl);

    return res.blob();

  }



  async function loadFromServer(visitUuid) {

    const baseUrl = getBaseUrl();

    const token = getToken();

    if (!baseUrl || !token || !visitUuid) return;



    try {

      const res = await fetch(`${baseUrl}/api/v1/visits/${visitUuid}/media`, {

        headers: { Authorization: `Bearer ${token}` }

      });

      if (!res.ok) return;

      const body = await res.json();

      const remote = (body.data || []).map((a) => ({

        localId: a.id,

        serverAssetId: a.id,

        category: a.category === 'as_oct' && a.metadata?.kind === 'clinical_document' ? 'document' : a.category,

        eye: a.link?.eye || '',

        label: a.link?.label || a.originalFilename,

        filename: a.originalFilename,

        mimeType: a.mimeType,

        size: a.byteSize,

        uploadedAt: a.createdAt

      }));



      const pending = state.items.filter((i) => !i.serverAssetId);

      const merged = [...pending];

      remote.forEach((r) => {

        if (!merged.some((m) => m.serverAssetId === r.serverAssetId)) merged.push(r);

      });

      state.items = merged;

      renderList();

      syncHiddenField();

    } catch (err) {

      console.warn('[CorneaVisitMedia] Could not load remote media', err);

    }

  }



  const CorneaVisitMedia = {

    reset() {

      revokePreviewBlob();

      state = { items: [] };

      renderList();

      syncHiddenField();

      const fileInput = document.getElementById('visitMediaFileInput');

      if (fileInput) fileInput.value = '';

    },



    async openPreview(localId) {

      const item = state.items.find((i) => i.localId === localId);

      if (!item) return;

      revokePreviewBlob();

      await showPreviewModal(item);

    },



    closePreview() {

      revokePreviewBlob();

      if (typeof global.closeEmrModal === 'function') {

        global.closeEmrModal('visitMediaPreviewModal');

      } else {

        const modal = document.getElementById('visitMediaPreviewModal');

        if (modal) {

          modal.classList.remove('is-open');

          modal.setAttribute('aria-hidden', 'true');

          document.body.classList.remove('emr-modal-open');

        }

      }

    },



    loadFromRecord(data) {

      revokePreviewBlob();

      state = { items: [] };

      try {

        const raw = data?.visitMediaJSON;

        const parsed = typeof raw === 'string' ? JSON.parse(raw || '{"items":[]}') : (raw || { items: [] });

        state.items = Array.isArray(parsed.items) ? parsed.items : [];

      } catch {

        state.items = [];

      }

      renderList();

      syncHiddenField();

      const uuid = data?.uuid || getVisitUuid();

      if (uuid) loadFromServer(uuid);

    },



    syncToHiddenField() {

      syncHiddenField();

    },



    async addFiles(fileList) {

      const categoryEl = document.getElementById('visitMediaCategory');

      const eyeEl = document.getElementById('visitMediaEye');

      const labelEl = document.getElementById('visitMediaLabel');

      const category = categoryEl?.value || 'slit_lamp';

      const eye = eyeEl?.value || '';

      const labelBase = labelEl?.value?.trim() || '';



      const files = Array.from(fileList || []);

      if (!files.length) return;



      for (const file of files) {

        if (file.size > MAX_BYTES) {

          alert(`"${file.name}" exceeds the 25 MB limit.`);

          continue;

        }

        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

        const isImage = (file.type || '').startsWith('image/');

        const isVideo = (file.type || '').startsWith('video/');

        const pdfCats = ['document', 'pdf_report'];

        if (pdfCats.includes(category) && !isPdf) {

          alert(`"${file.name}" must be a PDF for this category.`);

          continue;

        }

        if (category === 'video' && !isVideo) {

          alert(`"${file.name}" must be a video for surgical video.`);

          continue;

        }

        if (!pdfCats.includes(category) && category !== 'video' && category !== 'referral' && !isImage) {

          alert(`"${file.name}" must be an image for this category.`);

          continue;

        }



        const localId = uid();

        if (global.CorneaMediaBlobStore) {

          await global.CorneaMediaBlobStore.putBlob(localId, file, {

            mimeType: file.type,

            filename: file.name

          });

        }

        state.items.push({

          localId,

          category,

          eye,

          label: labelBase || file.name,

          filename: file.name,

          mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),

          size: file.size,

          blobLocalId: global.CorneaMediaBlobStore ? localId : null,

          dataUrl: global.CorneaMediaBlobStore ? null : await readFileAsDataUrl(file),

          serverAssetId: null,

          uploadedAt: null,

          syncStatus: 'pending'

        });

      }



      if (labelEl) labelEl.value = '';

      const fileInput = document.getElementById('visitMediaFileInput');

      if (fileInput) fileInput.value = '';



      renderList();

      syncHiddenField();



      const uuid = getVisitUuid();

      if (uuid) {

        try {

          await CorneaVisitMedia.flushPendingUploads(uuid);

        } catch (err) {

          console.warn('[CorneaVisitMedia] Upload deferred:', err.message);

        }

      }

    },



    removeItem(localId) {

      if (!confirm('Remove this file from the visit?')) return;

      state.items = state.items.filter((i) => i.localId !== localId);

      renderList();

      syncHiddenField();

    },



    async flushPendingUploads(visitUuid) {

      const uuid = visitUuid || getVisitUuid();

      if (!uuid || !getBaseUrl() || !getToken()) return { uploaded: 0, failed: 0 };



      let uploaded = 0;

      let failed = 0;

      for (const item of state.items) {

        if (item.serverAssetId || !item.dataUrl) continue;

        try {

          await uploadItem(item, uuid);

          uploaded++;

        } catch (err) {

          failed++;

          console.warn('[CorneaVisitMedia] Upload failed:', item.filename, err.message);

        }

      }

      renderList();

      syncHiddenField();

      return { uploaded, failed };

    },



    formatReadOnly(data) {

      let items = [];

      try {

        const parsed = JSON.parse(data?.visitMediaJSON || '{"items":[]}');

        items = parsed.items || [];

      } catch {

        return '';

      }

      if (!items.length) return '';



      const listHtml = items.map((item, idx) => {

        const name = escapeHtml(item.label || item.filename);

        const cat = escapeHtml(categoryLabel(item.category));

        const eye = item.eye ? ` · ${escapeHtml(item.eye)}` : '';

        const isImage = isImageItem(item);

        const thumb = isImage && item.dataUrl

          ? `<img src="${item.dataUrl}" alt="" class="visit-media-thumb" />`

          : `<div class="visit-media-thumb visit-media-thumb-doc"><i class="fa-solid ${isPdfItem(item) ? 'fa-file-pdf' : 'fa-file-image'}"></i></div>`;

        return `<div class="visit-media-item visit-media-ro-row">

          ${thumb}

          <div class="visit-media-meta">

            <strong>${name}</strong>

            <span>${cat}${eye}</span>

          </div>

          <button type="button" class="btn-secondary btn-sm visit-media-preview-btn visit-media-ro-preview-btn" data-ro-index="${idx}">

            <i class="fa-solid fa-eye"></i> Preview

          </button>

        </div>`;

      }).join('');



      const content = `<div class="visit-media-ro-list-only">${listHtml}</div>`;



      return window.buildEmrRoSection

        ? window.buildEmrRoSection('Documents & Clinical Images', 'fa-folder-open', content, '', 'section-theme-documents')

        : `<div class="emr-ro-section section-theme-documents"><div class="emr-ro-section-header"><h4><i class="fa-solid fa-folder-open"></i> Documents &amp; Clinical Images</h4></div><div style="padding:12px;">${content}</div></div>`;

    },



    initReadOnlyBrowser(container, data) {

      let items = [];

      try {

        const parsed = JSON.parse(data?.visitMediaJSON || '{"items":[]}');

        items = parsed.items || [];

      } catch {

        return;

      }

      if (!items.length) return;



      (container || document).querySelectorAll('.visit-media-ro-preview-btn').forEach((btn) => {

        btn.addEventListener('click', async () => {

          const idx = Number(btn.getAttribute('data-ro-index')) || 0;

          const item = items[idx];

          if (!item) return;

          revokePreviewBlob();

          await showPreviewModal(item);

        });

      });

    },



    onCategoryChange() {

      const category = document.getElementById('visitMediaCategory')?.value;

      const fileInput = document.getElementById('visitMediaFileInput');

      const cat = CATEGORIES.find((c) => c.value === category);

      if (fileInput && cat) {

        fileInput.accept = cat.accept;

      }

    }

  };



  global.CorneaVisitMedia = CorneaVisitMedia;



  document.addEventListener('DOMContentLoaded', () => {

    const catEl = document.getElementById('visitMediaCategory');

    if (catEl) {

      catEl.addEventListener('change', () => CorneaVisitMedia.onCategoryChange());

      CorneaVisitMedia.onCategoryChange();

    }



    const previewModal = document.getElementById('visitMediaPreviewModal');

    if (previewModal) {

      previewModal.addEventListener('click', (e) => {

        if (e.target === previewModal) CorneaVisitMedia.closePreview();

      });

      const observer = new MutationObserver(() => {

        if (!previewModal.classList.contains('is-open')) revokePreviewBlob();

      });

      observer.observe(previewModal, { attributes: true, attributeFilter: ['class'] });

    }

  }, { once: true });

})(typeof window !== 'undefined' ? window : globalThis);


