/**
 * Collapsible form sections — long patient form navigation
 */
(function (global) {
  'use strict';

  const STORAGE_PREFIX = 'corneaFormCollapse:';

  function getSectionKey(card) {
    return card.id || card.querySelector('.form-card-header h3')?.textContent?.trim() || '';
  }

  function setCollapsed(card, collapsed, persist) {
    card.classList.toggle('is-collapsed', collapsed);
    const btn = card.querySelector('.form-card-collapse-btn');
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Expand section' : 'Collapse section');
    }
    if (persist) {
      const key = getSectionKey(card);
      if (key) {
        try {
          sessionStorage.setItem(STORAGE_PREFIX + key, collapsed ? '1' : '0');
        } catch (_) {}
      }
    }
  }

  function toggleCard(card) {
    setCollapsed(card, !card.classList.contains('is-collapsed'), true);
  }

  function getFormCards(form) {
    return [...form.querySelectorAll('.form-card')].filter((c) => {
      if (!c.querySelector('.form-card-body')) return false;
      if (c.classList.contains('cl-optional-section') && c.hidden) return false;
      return true;
    });
  }

  function injectToolbar(form) {
    if (form.querySelector('.form-section-collapse-bar')) return;
    const cards = getFormCards(form);
    if (!cards.length) return;

    const bar = document.createElement('div');
    bar.className = 'form-section-collapse-bar no-print';
    bar.innerHTML = `<span class="form-section-collapse-bar-label"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Sections</span>
      <button type="button" class="btn-secondary btn-sm" data-action="expand-all">Expand all</button>
      <button type="button" class="btn-secondary btn-sm" data-action="collapse-all">Collapse all</button>`;

    bar.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.getAttribute('data-action');
      if (action === 'expand-all') global.expandAllFormSections();
      if (action === 'collapse-all') global.collapseAllFormSections();
    });

    const anchor = [...form.children].find((el) => el.classList?.contains('form-card')) || form.firstElementChild;
    form.insertBefore(bar, anchor);
  }

  function initCard(card) {
    if (card.dataset.collapseInit === '1') return;
    const header = card.querySelector('.form-card-header');
    const body = card.querySelector('.form-card-body');
    if (!header || !body) return;

    card.dataset.collapseInit = '1';
    card.classList.add('form-card-collapsible');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'form-card-collapse-btn no-print';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Collapse section');
    toggle.innerHTML = '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>';
    header.appendChild(toggle);

    header.classList.add('form-card-header-collapsible');

    const sectionKey = getSectionKey(card);
    let startCollapsed = false;
    if (sectionKey) {
      try {
        startCollapsed = sessionStorage.getItem(STORAGE_PREFIX + sectionKey) === '1';
      } catch (_) {}
    }
    setCollapsed(card, startCollapsed, false);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCard(card);
    });

    header.addEventListener('click', (e) => {
      if (e.target.closest('.form-card-collapse-btn')) return;
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      toggleCard(card);
    });
  }

  global.initFormSectionCollapse = function (root) {
    if (root?.classList?.contains('form-card')) {
      initCard(root);
      return;
    }
    const form = root?.querySelector?.('#patientForm') || root || document.getElementById('patientForm');
    if (!form || !form.querySelectorAll) return;
    injectToolbar(form);
    getFormCards(form).forEach(initCard);
  };

  global.expandAllFormSections = function () {
    const form = document.getElementById('patientForm');
    if (!form) return;
    getFormCards(form).forEach((card) => setCollapsed(card, false, true));
  };

  global.collapseAllFormSections = function () {
    const form = document.getElementById('patientForm');
    if (!form) return;
    getFormCards(form).forEach((card) => setCollapsed(card, true, true));
  };

  global.toggleFormSection = function (sectionId) {
    const card = document.getElementById(sectionId);
    if (card) toggleCard(card);
  };
})(typeof window !== 'undefined' ? window : globalThis);
