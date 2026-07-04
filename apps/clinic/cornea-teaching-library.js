/**
 * Teaching case library — browse, tag, anonymize, and export teaching media (backlog B3)
 */
(function (global) {
  'use strict';

  let cases = [];
  let editingId = null;

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function apiFetch(path, opts = {}) {
    const options = { ...opts };
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
    if (global.CorneaClinicalMedia?.apiFetch) {
      return global.CorneaClinicalMedia.apiFetch(path, options);
    }
    const apiPath = path.startsWith('/api/v1') ? path : `/api/v1${path}`;
    return global.CorneaApi.request(apiPath, opts);
  }

  function cloudReady() {
    return global.CorneaApi?.isEnabled?.() === true;
  }

  function categoryLabel(v) {
    return global.CorneaClinicalMedia?.categoryLabel?.(v) || v || '—';
  }

  function renderGrid() {
    const grid = document.getElementById('teachingCaseGrid');
    const meta = document.getElementById('teachingCaseMeta');
    if (!grid) return;

    if (!cases.length) {
      grid.innerHTML = '<p class="teaching-case-empty">No teaching cases yet. Mark media as teaching from the library table above, or upload with category <strong>Teaching Case</strong>.</p>';
      if (meta) meta.textContent = '0 cases';
      return;
    }

    grid.innerHTML = cases.map((c) => {
      const title = c.teaching?.title || c.title || c.link?.diagnosisLabel || c.visitDiagnosis || categoryLabel(c.category);
      const tags = (c.teaching?.tags || c.tags || []).slice(0, 4);
      const published = c.teaching?.hasAnonymizedSnapshot || c.hasPublishedSnapshot;
      const patient = c.patientName ? `<span class="teaching-case-patient">${escapeHtml(c.patientName)}</span>` : '';
      return `<article class="teaching-case-card" data-id="${escapeHtml(c.id)}">
        <header>
          <span class="teaching-case-ref">${escapeHtml(c.caseRef || c.id?.slice(0, 8) || '')}</span>
          ${published ? '<span class="teaching-case-badge">Published</span>' : ''}
        </header>
        <h4>${escapeHtml(title)}</h4>
        <p class="teaching-case-meta">${escapeHtml(categoryLabel(c.category))}${c.link?.eye ? ` · ${escapeHtml(c.link.eye)}` : ''}</p>
        ${patient}
        <div class="teaching-case-tags">${tags.map((t) => `<span class="teaching-tag">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="teaching-case-actions">
          <button type="button" class="btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(c.id)}">Edit</button>
          <button type="button" class="btn-secondary btn-sm" data-action="preview" data-id="${escapeHtml(c.id)}">Preview anon</button>
          <button type="button" class="btn-teal btn-sm" data-action="publish" data-id="${escapeHtml(c.id)}">Publish</button>
          <button type="button" class="btn-secondary btn-sm" data-action="export" data-id="${escapeHtml(c.id)}">Export JSON</button>
        </div>
      </article>`;
    }).join('');

    if (meta) meta.textContent = `${cases.length} case${cases.length === 1 ? '' : 's'}`;
  }

  async function loadCases() {
    const grid = document.getElementById('teachingCaseGrid');
    if (!cloudReady()) {
      if (grid) {
        grid.innerHTML = '<p class="teaching-case-empty">Sign in to cloud to browse the teaching case library.</p>';
      }
      return;
    }
    const search = document.getElementById('teachingCaseSearch')?.value?.trim() || '';
    const qs = new URLSearchParams({ limit: '100' });
    if (search) qs.set('search', search);
    const json = await apiFetch(`/teaching-cases?${qs}`);
    cases = json.data || [];
    renderGrid();
  }

  function openEditor(assetId, existing) {
    editingId = assetId;
    const modal = document.getElementById('teachingCaseEditorModal');
    if (!modal) return;
    const t = existing?.teaching || {};
    document.getElementById('tcEditTitle').value = t.title || '';
    document.getElementById('tcEditSummary').value = t.summary || '';
    document.getElementById('tcEditDiagnosis').value = t.publicDiagnosis || existing?.link?.diagnosisLabel || '';
    document.getElementById('tcEditTags').value = (t.tags || []).join(', ');
    document.getElementById('tcEditObjectives').value = (t.learningObjectives || []).join('\n');
    document.getElementById('tcEditInteresting').checked = Boolean(t.interestingCase);
    document.getElementById('tcEditComplication').checked = Boolean(t.complication);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeEditor() {
    editingId = null;
    const modal = document.getElementById('teachingCaseEditorModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  async function saveEditor() {
    if (!editingId) return;
    const tags = document.getElementById('tcEditTags')?.value?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    const learningObjectives = document.getElementById('tcEditObjectives')?.value?.split('\n').map((s) => s.trim()).filter(Boolean) || [];
    await apiFetch(`/teaching-cases/${editingId}`, {
      method: 'PUT',
      body: {
        title: document.getElementById('tcEditTitle')?.value?.trim(),
        summary: document.getElementById('tcEditSummary')?.value?.trim(),
        publicDiagnosis: document.getElementById('tcEditDiagnosis')?.value?.trim(),
        tags,
        learningObjectives,
        interestingCase: document.getElementById('tcEditInteresting')?.checked,
        complication: document.getElementById('tcEditComplication')?.checked,
        teachingCase: true
      }
    });
    closeEditor();
    await loadCases();
  }

  async function previewAnonymized(assetId) {
    const json = await apiFetch(`/teaching-cases/${assetId}/export`);
    const pre = document.getElementById('teachingCasePreviewBody');
    const modal = document.getElementById('teachingCasePreviewModal');
    if (pre) pre.textContent = JSON.stringify(json.data, null, 2);
    if (modal) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  async function publishCase(assetId) {
    await apiFetch(`/teaching-cases/${assetId}/publish`, { method: 'POST', body: '{}' });
    await loadCases();
    alert('Anonymized teaching snapshot published to library.');
  }

  async function exportCase(assetId) {
    const json = await apiFetch(`/teaching-cases/${assetId}/export`);
    const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `teaching-case-${assetId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function markAssetAsTeaching(assetId) {
    await apiFetch(`/teaching-cases/${assetId}`, {
      method: 'PUT',
      body: { teachingCase: true, title: 'Teaching case' }
    });
    await loadCases();
    alert('Marked as teaching case. Open Teaching Library below to add metadata and publish.');
  }

  function bindEvents() {
    document.getElementById('teachingCaseRefreshBtn')?.addEventListener('click', () => {
      loadCases().catch((e) => alert(e.message));
    });
    document.getElementById('teachingCaseSearch')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadCases().catch((err) => alert(err.message));
    });
    document.getElementById('teachingCaseGrid')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      try {
        if (action === 'edit') {
          const item = cases.find((c) => c.id === id);
          openEditor(id, item);
        }
        if (action === 'preview') await previewAnonymized(id);
        if (action === 'publish') await publishCase(id);
        if (action === 'export') await exportCase(id);
      } catch (err) {
        alert(err.message);
      }
    });
    document.getElementById('tcEditSaveBtn')?.addEventListener('click', () => {
      saveEditor().catch((e) => alert(e.message));
    });
    document.getElementById('tcEditCancelBtn')?.addEventListener('click', closeEditor);
    document.getElementById('teachingCaseEditorClose')?.addEventListener('click', closeEditor);
    document.getElementById('teachingCasePreviewClose')?.addEventListener('click', () => {
      document.getElementById('teachingCasePreviewModal')?.classList.remove('is-open');
    });
  }

  function init() {
    bindEvents();
    if (cloudReady()) loadCases().catch(() => {});
  }

  global.CorneaTeachingLibrary = {
    init,
    refresh: loadCases,
    markAssetAsTeaching,
    openEditor
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
