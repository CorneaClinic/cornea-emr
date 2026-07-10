/**
 * Accordion sidebar: expand/collapse, search, favorites, recent, badges, FAB.
 * Preserves existing switchTab routing and visual palette.
 */
(function (global) {
  'use strict';

  const STORAGE_EXPANDED = 'corneaNavExpandedSection';
  const STORAGE_FAVORITES = 'corneaNavFavorites';
  const STORAGE_RECENT = 'corneaNavRecent';
  const DEFAULT_SECTION = 'patient';
  const RECENT_MAX = 6;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) { /* ignore quota */ }
  }

  function getFavorites() {
    const list = readJson(STORAGE_FAVORITES, []);
    return Array.isArray(list) ? list : [];
  }

  function setFavorites(list) {
    writeJson(STORAGE_FAVORITES, list);
  }

  function getRecent() {
    const list = readJson(STORAGE_RECENT, []);
    return Array.isArray(list) ? list : [];
  }

  function setRecent(list) {
    writeJson(STORAGE_RECENT, list);
  }

  function findSourceByKey(key) {
    return document.querySelector(`.sidebar-nav .nav-item[data-nav-key="${key}"]`);
  }

  function ensureNavRows() {
    document.querySelectorAll('.sidebar-nav .nav-item[data-nav-key]').forEach((item) => {
      if (item.parentElement?.classList.contains('nav-row')) return;
      const row = document.createElement('div');
      row.className = 'nav-row';
      const key = item.getAttribute('data-nav-key');
      if (key) row.setAttribute('data-nav-key', key);
      item.parentNode.insertBefore(row, item);
      row.appendChild(item);

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'nav-pin-btn';
      pin.setAttribute('data-csp-action', 'toggleNavFavorite');
      pin.setAttribute('data-csp-args', JSON.stringify([key]));
      pin.title = 'Pin to favorites';
      pin.setAttribute('aria-label', `Pin ${item.getAttribute('data-nav-label') || 'module'} to favorites`);
      pin.innerHTML = '<i class="fa-regular fa-star" aria-hidden="true"></i>';
      row.appendChild(pin);
    });
  }

  function syncPinIcons() {
    const favs = new Set(getFavorites());
    document.querySelectorAll('.nav-pin-btn').forEach((btn) => {
      let key = null;
      try {
        key = JSON.parse(btn.getAttribute('data-csp-args') || '[]')[0];
      } catch (_) { /* ignore */ }
      const on = key && favs.has(key);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = on ? 'fa-solid fa-star' : 'fa-regular fa-star';
      }
      btn.classList.toggle('is-pinned', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderMetaLists() {
    const favBlock = document.getElementById('navFavoritesBlock');
    const favList = document.getElementById('navFavoritesList');
    const recentBlock = document.getElementById('navRecentBlock');
    const recentList = document.getElementById('navRecentList');
    if (!favList || !recentList) return;

    const favorites = getFavorites();
    favList.innerHTML = '';
    favorites.forEach((key) => {
      const src = findSourceByKey(key);
      if (!src) return;
      const clone = src.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.remove('active');
      clone.removeAttribute('aria-current');
      clone.querySelectorAll('.nav-badge').forEach((b) => b.remove());
      favList.appendChild(clone);
    });
    if (favBlock) favBlock.hidden = favorites.length === 0;

    const recent = getRecent();
    recentList.innerHTML = '';
    recent.forEach((key) => {
      const src = findSourceByKey(key);
      if (!src) return;
      const clone = src.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.remove('active');
      clone.removeAttribute('aria-current');
      clone.querySelectorAll('.nav-badge').forEach((b) => b.remove());
      recentList.appendChild(clone);
    });
    if (recentBlock) recentBlock.hidden = recent.length === 0;

    syncPinIcons();
  }

  function setSectionOpen(sectionId, open, { exclusive = true, persist = true } = {}) {
    const accordion = document.querySelector(`.nav-accordion[data-nav-section="${sectionId}"]`);
    if (!accordion) return;

    if (exclusive && open) {
      document.querySelectorAll('.nav-accordion').forEach((acc) => {
        const id = acc.getAttribute('data-nav-section');
        if (id === sectionId) return;
        acc.classList.remove('is-open');
        const toggle = acc.querySelector('.nav-accordion-toggle');
        const panel = acc.querySelector('.nav-accordion-panel');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        if (panel) panel.hidden = true;
      });
    }

    accordion.classList.toggle('is-open', open);
    const toggle = accordion.querySelector('.nav-accordion-toggle');
    const panel = accordion.querySelector('.nav-accordion-panel');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.hidden = !open;

    if (persist && open) {
      try {
        localStorage.setItem(STORAGE_EXPANDED, sectionId);
      } catch (_) { /* ignore */ }
    }
  }

  function toggleSection(sectionId) {
    const accordion = document.querySelector(`.nav-accordion[data-nav-section="${sectionId}"]`);
    if (!accordion) return;
    const willOpen = !accordion.classList.contains('is-open');
    setSectionOpen(sectionId, willOpen, { exclusive: true, persist: true });
  }

  function expandForTab(tabId) {
    const item = document.querySelector(`.sidebar-nav .nav-accordion .nav-item[data-tab="${tabId}"]`);
    const parent = item?.getAttribute('data-nav-parent');
    if (parent) {
      setSectionOpen(parent, true, { exclusive: true, persist: true });
    }
    requestAnimationFrame(() => {
      const active = document.querySelector(`.sidebar-nav .nav-item[data-tab="${tabId}"].active`);
      active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function recordVisit(tabId) {
    const item = document.querySelector(`.sidebar-nav .nav-accordion .nav-item[data-tab="${tabId}"][data-nav-key], .sidebar-nav .nav-item-top[data-tab="${tabId}"][data-nav-key]`);
    const key = item?.getAttribute('data-nav-key');
    if (!key) return;
    const next = [key, ...getRecent().filter((k) => k !== key)].slice(0, RECENT_MAX);
    setRecent(next);
    renderMetaLists();
  }

  function toggleFavorite(key) {
    if (!key) return;
    const favs = getFavorites();
    const idx = favs.indexOf(key);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(key);
    setFavorites(favs);
    renderMetaLists();
  }

  function filterNav(query) {
    const q = String(query || '').trim().toLowerCase();
    const empty = document.getElementById('sidebarSearchEmpty');
    const searching = q.length > 0;
    document.getElementById('sidebarNav')?.classList.toggle('is-searching', searching);

    let matches = 0;
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
      if (item.closest('#navFavoritesList') || item.closest('#navRecentList')) {
        item.hidden = searching;
        return;
      }
      const label = (item.getAttribute('data-nav-label') || item.textContent || '').toLowerCase();
      const show = !searching || label.includes(q);
      item.hidden = !show;
      const row = item.closest('.nav-row');
      if (row) row.hidden = !show;
      if (show && searching) matches += 1;
    });

    document.querySelectorAll('.nav-accordion').forEach((acc) => {
      if (!searching) {
        acc.hidden = false;
        return;
      }
      const any = [...acc.querySelectorAll('.nav-item')].some((el) => !el.hidden);
      acc.hidden = !any;
      if (any) setSectionOpen(acc.getAttribute('data-nav-section'), true, { exclusive: false, persist: false });
    });

    document.getElementById('navFavoritesBlock')?.toggleAttribute('hidden', searching || getFavorites().length === 0);
    document.getElementById('navRecentBlock')?.toggleAttribute('hidden', searching || getRecent().length === 0);

    if (empty) empty.hidden = !searching || matches > 0;
  }

  function setBadge(name, value) {
    document.querySelectorAll(`[data-nav-badge="${name}"]`).forEach((el) => {
      if (value == null || value === '' || value === 0) {
        el.hidden = true;
        el.textContent = '';
      } else {
        el.hidden = false;
        el.textContent = String(value);
      }
    });
  }

  function toggleFab() {
    const menu = document.getElementById('navFabMenu');
    const btn = document.getElementById('navFabToggle');
    if (!menu || !btn) return;
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById('navFab')?.classList.toggle('is-open', open);
  }

  function closeFab() {
    const menu = document.getElementById('navFabMenu');
    const btn = document.getElementById('navFabToggle');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.getElementById('navFab')?.classList.remove('is-open');
  }

  function onTabChange(tabId) {
    expandForTab(tabId);
    recordVisit(tabId);
    closeFab();
  }

  function bindSearch() {
    const input = document.getElementById('sidebarSearchInput');
    if (!input || input.dataset.bound) return;
    input.dataset.bound = '1';
    input.addEventListener('input', () => filterNav(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        filterNav('');
        input.blur();
      }
    });
  }

  function bindKeyboard() {
    document.querySelectorAll('.nav-accordion-toggle').forEach((toggle) => {
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          const section = toggle.closest('.nav-accordion')?.getAttribute('data-nav-section');
          if (section) setSectionOpen(section, true, { exclusive: true, persist: true });
        }
        if (e.key === 'ArrowLeft') {
          const section = toggle.closest('.nav-accordion')?.getAttribute('data-nav-section');
          if (section) setSectionOpen(section, false, { exclusive: false, persist: true });
        }
      });
    });
  }

  function init() {
    ensureNavRows();
    const saved = localStorage.getItem(STORAGE_EXPANDED) || DEFAULT_SECTION;
    document.querySelectorAll('.nav-accordion').forEach((acc) => {
      const id = acc.getAttribute('data-nav-section');
      setSectionOpen(id, id === saved, { exclusive: false, persist: false });
    });
    // Ensure exactly one open if none matched
    if (!document.querySelector('.nav-accordion.is-open')) {
      setSectionOpen(DEFAULT_SECTION, true, { exclusive: true, persist: true });
    }
    renderMetaLists();
    bindSearch();
    bindKeyboard();

    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (activeTab) expandForTab(activeTab);
  }

  global.CorneaSidebarNav = {
    init,
    toggleSection,
    toggleFavorite,
    toggleFab,
    closeFab,
    filterNav,
    setBadge,
    onTabChange,
    expandForTab
  };

  global.toggleNavSection = toggleSection;
  global.toggleNavFavorite = toggleFavorite;
  global.toggleNavFab = toggleFab;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* deploy-marker: sidebar-nav */

