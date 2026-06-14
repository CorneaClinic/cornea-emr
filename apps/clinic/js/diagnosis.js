/**
 * Cornea Clinic — WHO ICD-11 diagnosis lookup and autocomplete
 * Phase 4 extraction from Cornea.html
 */

window.openIcdSettingsModal = function() {
    loadIcdApiSettingsIntoForm();
    openEmrModal('icdSettingsModal');
};

async function renderIcdReadOnlyView() {
    const box = document.getElementById('icdReadOnlyView');
    if (!box) return;
    if (!isIcdCloudMode()) {
        renderEmrReadOnlyGrid('icdReadOnlyView', [
            { label: 'Storage', value: 'Server-side (sign in to cloud sync)' },
            { label: 'Status', value: 'Not connected' }
        ]);
        return;
    }
    try {
        const res = await CorneaApi.request('/api/v1/icd/status');
        const status = res.data || res;
        renderEmrReadOnlyGrid('icdReadOnlyView', [
            { label: 'Client ID', value: status.clientId || 'Not configured' },
            { label: 'Client Secret', value: status.configured ? 'Configured (encrypted on server)' : 'Not configured' },
            { label: 'Status', value: status.configured ? 'Ready for ICD-11 lookup' : 'Not configured' }
        ]);
    } catch (_) {
        renderEmrReadOnlyGrid('icdReadOnlyView', [
            { label: 'Status', value: 'Could not load ICD status' }
        ]);
    }
}

window.saveIcdApiSettingsFromModal = function() {
    window.saveIcdApiSettings();
    renderIcdReadOnlyView();
    closeEmrModal('icdSettingsModal');
};

function isIcdCloudMode() {
    return !!(window.CorneaApi && CorneaApi.isEnabled && CorneaApi.isEnabled());
}

let _icdSearchSeq = 0;

function stripIcdHtml(html) {
    if (!html) return '';
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || d.innerText || '').trim();
}

function getIcdApiCredentials() {
    if (isIcdCloudMode()) return { clientId: '', clientSecret: '' };
    const clientId = (document.getElementById('icdApiClientId')?.value || '').trim();
    const clientSecret = (document.getElementById('icdApiClientSecret')?.value || '').trim();
    return { clientId, clientSecret };
}

function setDiagnosisIcdStatus(state, message) {
    const el = document.getElementById('diagnosisIcdStatus');
    if (!el) return;
    el.className = 'form-hint diagnosis-icd-status ' + state;
    const textEl = el.querySelector('.icd-status-text');
    if (textEl) textEl.textContent = message;
}

window.saveIcdApiSettings = async function() {
    const clientId = document.getElementById('icdApiClientId')?.value.trim();
    const clientSecret = document.getElementById('icdApiClientSecret')?.value.trim();
    if (!clientId || !clientSecret) {
        alert('Please enter both Client ID and Client Secret.');
        return;
    }
    if (!isIcdCloudMode()) {
        alert('Sign in to cloud sync first — WHO ICD keys are stored securely on the server, not in this browser.');
        return;
    }
    try {
        await CorneaApi.request('/api/v1/icd/credentials', {
            method: 'PUT',
            body: JSON.stringify({ clientId, clientSecret })
        });
        const idEl = document.getElementById('icdApiClientId');
        const secEl = document.getElementById('icdApiClientSecret');
        if (idEl) idEl.value = '';
        if (secEl) secEl.value = '';
        setDiagnosisIcdStatus('online', 'API keys saved on server. ICD-11 suggestions load when you type in Diagnosis.');
        alert('WHO ICD API keys saved securely for your clinic.');
        renderIcdReadOnlyView();
    } catch (err) {
        alert('Could not save ICD keys: ' + (err.message || 'Unknown error'));
    }
};

window.clearIcdApiSettings = async function() {
    if (!confirm('Remove WHO ICD API keys for this clinic?')) return;
    if (!isIcdCloudMode()) {
        alert('Sign in to cloud sync to manage ICD credentials.');
        return;
    }
    try {
        await CorneaApi.request('/api/v1/icd/credentials', { method: 'DELETE' });
        const idEl = document.getElementById('icdApiClientId');
        const secEl = document.getElementById('icdApiClientSecret');
        if (idEl) idEl.value = '';
        if (secEl) secEl.value = '';
        renderIcdReadOnlyView();
        updateDiagnosisIcdStatusMessage();
    } catch (err) {
        alert('Could not clear ICD keys: ' + (err.message || 'Unknown error'));
    }
};

window.testIcdApiConnection = async function() {
    if (!isIcdCloudMode()) {
        alert('Sign in to cloud sync, then save WHO ICD keys (register at icd.who.int/icdapi).');
        return;
    }
    setDiagnosisIcdStatus('pending', 'Testing connection to WHO ICD API…');
    try {
        const results = await searchIcdMms('diabetes');
        if (results.length) {
            setDiagnosisIcdStatus('online', 'Connected to WHO ICD-11 MMS. Diagnosis suggestions are active.');
            alert('Connection successful. ICD-11 lookup is ready.');
        } else {
            setDiagnosisIcdStatus('error', 'Connected but no search results returned. Check API access or try again later.');
            alert('Token obtained but search returned no results.');
        }
    } catch (err) {
        setDiagnosisIcdStatus('error', 'Could not connect: ' + (err.message || 'Unknown error'));
        alert('Connection failed: ' + (err.message || 'Unknown error'));
    }
};

function loadIcdApiSettingsIntoForm() {
    const idEl = document.getElementById('icdApiClientId');
    const secEl = document.getElementById('icdApiClientSecret');
    if (idEl) idEl.value = '';
    if (secEl) secEl.value = '';
}

async function updateDiagnosisIcdStatusMessage() {
    if (!navigator.onLine) {
        setDiagnosisIcdStatus('offline', 'No internet — ICD-11 suggestions unavailable. You can still type diagnoses manually.');
        return;
    }
    if (!isIcdCloudMode()) {
        setDiagnosisIcdStatus('pending', 'Sign in to cloud sync, then configure WHO API keys in Database (admin).');
        return;
    }
    try {
        const res = await CorneaApi.request('/api/v1/icd/status');
        const status = res.data || res;
        if (status.configured) {
            setDiagnosisIcdStatus('online', 'ICD-11 MMS (2026-01) ready — type in Diagnosis for WHO terminology suggestions.');
        } else {
            setDiagnosisIcdStatus('pending', 'Add WHO API keys in Database (admin) to enable ICD-11 suggestions.');
        }
    } catch (_) {
        setDiagnosisIcdStatus('error', 'Could not reach ICD service — check API connection.');
    }
}

function parseIcdSearchResults(data) {
    const raw = data?.destinationEntities || data?.flatResults || data?.entities || [];
    const out = [];
    const seen = new Set();
    for (const e of raw) {
        const title = stripIcdHtml(e.title || e.label || e.matchingPVs?.[0]?.label || '');
        if (!title) continue;
        const code = (e.theCode || e.code || '').trim();
        const key = title + '|' + code;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, code, uri: e.id || e['@id'] || '' });
        if (out.length >= 12) break;
    }
    return out;
}

async function searchIcdMms(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    if (!isIcdCloudMode()) return [];
    const data = await CorneaApi.request('/api/v1/icd/search?q=' + encodeURIComponent(q));
    return parseIcdSearchResults(data);
}

function getDiagnosisSearchQuery(textarea) {
    const val = textarea.value;
    const pos = textarea.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const segment = before.slice(lineStart).trim();
    return segment.length >= 2 ? segment : (val.trim().length >= 2 && !val.includes('\n') ? val.trim() : segment);
}

function formatIcdDiagnosisLine(item) {
    return item.code ? item.title + ' (ICD-11: ' + item.code + ')' : item.title;
}

function applyIcdDiagnosisSelection(textarea, item, query) {
    const formatted = formatIcdDiagnosisLine(item);
    const val = textarea.value;
    const pos = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : val.length;
    const lineStart = val.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    const nextNl = val.indexOf('\n', pos);
    const lineEnd = nextNl === -1 ? val.length : nextNl;
    let line = val.slice(lineStart, lineEnd);
    if (query) {
        const idx = line.toLowerCase().lastIndexOf(query.toLowerCase());
        if (idx >= 0) line = line.slice(0, idx) + formatted;
        else line = formatted;
    } else {
        line = formatted;
    }
    textarea.value = val.slice(0, lineStart) + line + val.slice(lineEnd);
    const newPos = lineStart + line.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setupDiagnosisIcdAutocomplete() {
    const input = document.getElementById('diagnosis');
    const list = document.getElementById('diagnosis-ac');
    if (!input || !list) return;

    list.dataset.lidInputId = 'diagnosis';

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'diagnosis-ac');
    input.setAttribute('aria-expanded', 'false');

    let hi = -1;
    let blurTO = null;
    let debounceTO = null;
    let scrollListenersBound = false;
    let lastResults = [];

    function positionList() {
        const r = input.getBoundingClientRect();
        if (r.width < 2 && r.height < 2) return;
        const pad = 8;
        const w = Math.max(280, r.width);
        let left = r.left;
        if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
        if (left < pad) left = pad;
        list.style.left = left + 'px';
        list.style.top = (r.bottom + 4) + 'px';
        list.style.width = w + 'px';
        const maxH = Math.min(280, Math.max(100, window.innerHeight - r.bottom - 16));
        list.style.maxHeight = maxH + 'px';
    }

    list._lidReposition = positionList;

    function unbindScroll() {
        if (!scrollListenersBound) return;
        scrollListenersBound = false;
        window.removeEventListener('scroll', onScrollResize, true);
        window.removeEventListener('resize', onScrollResize);
    }

    function hide() {
        list.classList.remove('open');
        list.innerHTML = '';
        list.setAttribute('aria-hidden', 'true');
        input.setAttribute('aria-expanded', 'false');
        hi = -1;
        lastResults = [];
        unbindScroll();
    }

    function onScrollResize() {
        if (list.classList.contains('open')) positionList();
    }

    function bindScroll() {
        if (scrollListenersBound) return;
        scrollListenersBound = true;
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);
    }

    function renderResults(matches, statusMsg) {
        list.innerHTML = '';
        hi = -1;
        lastResults = matches;

        if (statusMsg) {
            const li = document.createElement('li');
            li.className = 'lid-ac-item icd-ac-item icd-ac-hint';
            li.setAttribute('role', 'option');
            li.textContent = statusMsg;
            list.appendChild(li);
        } else {
            matches.forEach((item, idx) => {
                const li = document.createElement('li');
                li.className = 'lid-ac-item icd-ac-item';
                li.setAttribute('role', 'option');
                li.id = 'diagnosis-ac-opt-' + idx;
                li.innerHTML = '<span class="icd-ac-title"></span><span class="icd-ac-code"></span>';
                li.querySelector('.icd-ac-title').textContent = item.title;
                li.querySelector('.icd-ac-code').textContent = item.code ? 'ICD-11: ' + item.code : 'ICD-11 MMS';
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    applyIcdDiagnosisSelection(input, item, getDiagnosisSearchQuery(input));
                    hide();
                    input.focus();
                });
                list.appendChild(li);
            });
        }

        if (!statusMsg && matches.length === 0) {
            hide();
            return;
        }
        list.setAttribute('aria-hidden', 'false');
        list.classList.add('open');
        requestAnimationFrame(() => { positionList(); bindScroll(); });
        input.setAttribute('aria-expanded', 'true');
    }

    async function refresh() {
        clearTimeout(blurTO);
        clearTimeout(debounceTO);
        const q = getDiagnosisSearchQuery(input);
        if (!q || q.length < 2) {
            hide();
            return;
        }
        if (!navigator.onLine) {
            renderResults([], 'Offline — connect to the internet for ICD-11 suggestions.');
            return;
        }

        const seq = ++_icdSearchSeq;
        renderResults([], 'Searching WHO ICD-11…');

        debounceTO = setTimeout(async () => {
            try {
                const results = await searchIcdMms(q);
                if (seq !== _icdSearchSeq) return;
                if (!results.length) {
                    renderResults([], 'No ICD-11 match — try different terms or check API keys in Database.');
                    return;
                }
                renderResults(results, '');
            } catch (err) {
                if (seq !== _icdSearchSeq) return;
                renderResults([], 'Lookup failed — ' + (err.message || 'check API keys and internet.'));
            }
        }, 380);
    }

    input.addEventListener('input', refresh);
    input.addEventListener('focus', () => { if (getDiagnosisSearchQuery(input)) refresh(); });
    input.addEventListener('blur', () => { blurTO = setTimeout(hide, 220); });

    input.addEventListener('keydown', (e) => {
        if (!list.classList.contains('open') || !list.querySelector('.icd-ac-item:not(.icd-ac-hint)')) {
            if (e.key === 'Escape') hide();
            return;
        }
        const items = [...list.querySelectorAll('.icd-ac-item:not(.icd-ac-hint)')];
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            hi = Math.min(hi + 1, items.length - 1);
            items.forEach((el, i) => el.setAttribute('aria-selected', i === hi ? 'true' : 'false'));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            hi = Math.max(hi - 1, 0);
            items.forEach((el, i) => el.setAttribute('aria-selected', i === hi ? 'true' : 'false'));
        } else if (e.key === 'Enter' && hi >= 0 && lastResults[hi]) {
            e.preventDefault();
            applyIcdDiagnosisSelection(input, lastResults[hi], getDiagnosisSearchQuery(input));
            hide();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hide();
        } else if (e.key === 'Tab' && hi >= 0 && lastResults[hi]) {
            applyIcdDiagnosisSelection(input, lastResults[hi], getDiagnosisSearchQuery(input));
            hide();
        }
    });

    window.addEventListener('online', updateDiagnosisIcdStatusMessage);
    window.addEventListener('offline', updateDiagnosisIcdStatusMessage);
}

function repositionOpenDiagnosisAutocomplete() {
    const list = document.getElementById('diagnosis-ac');
    if (list?.classList.contains('open') && typeof list._lidReposition === 'function') {
        list._lidReposition();
    }
}

window.renderIcdReadOnlyView = renderIcdReadOnlyView;
window.updateDiagnosisIcdStatusMessage = updateDiagnosisIcdStatusMessage;
window.repositionOpenDiagnosisAutocomplete = repositionOpenDiagnosisAutocomplete;
