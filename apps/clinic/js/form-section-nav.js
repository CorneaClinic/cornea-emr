/**
 * Patient form section navigation — sticky sidebar for quick jumps
 */
(function (global) {
  'use strict';

  let scrollRoot = null;
  let scrollSpy = null;

  function getFormCards(form) {
    return [...form.querySelectorAll('.form-card')].filter((card) => {
      if (!card.querySelector('.form-card-body')) return false;
      if (card.classList.contains('cl-optional-section') && card.hidden) return false;
      return true;
    });
  }

  function getSectionLabel(card) {
    return card.querySelector('.form-card-header h3')?.textContent?.trim() || card.id || 'Section';
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function expandSectionIfNeeded(card) {
    if (card.classList.contains('is-collapsed') && global.toggleFormSection) {
      global.toggleFormSection(card.id);
    }
  }

  function navigateToSection(card) {
    if (!card) return;
    expandSectionIfNeeded(card);
    setActiveNavItem(card.id);

    const root = scrollRoot || card.closest('.patient-form-main');
    if (root) {
      const top = card.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12;
      root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      return;
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setActiveNavItem(sectionId) {
    const navList = document.getElementById('formSectionNavList');
    if (!navList || !sectionId) return;
    navList.querySelectorAll('.form-section-nav-item').forEach((btn) => {
      const active = btn.getAttribute('data-section') === sectionId;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function buildNavItems(form) {
    const navList = document.getElementById('formSectionNavList');
    if (!navList) return;

    const activeId = navList.querySelector('.form-section-nav-item.is-active')?.getAttribute('data-section');
    navList.replaceChildren();

    getFormCards(form).forEach((card, index) => {
      if (!card.id) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'form-section-nav-item';
      btn.setAttribute('data-section', card.id);

      const theme = [...card.classList].find((c) => c.startsWith('section-theme-'));
      if (theme) btn.dataset.theme = theme.replace('section-theme-', '');

      btn.innerHTML = `<span class="form-section-nav-num" aria-hidden="true">${index + 1}</span>
        <span class="form-section-nav-label">${escapeHtml(getSectionLabel(card))}</span>`;

      btn.addEventListener('click', () => navigateToSection(card));
      navList.appendChild(btn);
    });

    const cards = getFormCards(form);
    const keepActive = activeId && cards.some((c) => c.id === activeId);
    setActiveNavItem(keepActive ? activeId : cards[0]?.id);
  }

  function setupScrollSpy(form) {
    if (scrollSpy) scrollSpy.disconnect();
    const cards = getFormCards(form);
    const root = scrollRoot || form.closest('.patient-form-main');
    if (!cards.length || !root) return;

    scrollSpy = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) setActiveNavItem(visible[0].target.id);
      },
      { root, rootMargin: '-8% 0px -72% 0px', threshold: [0, 0.15, 0.35, 0.6] }
    );

    cards.forEach((card) => scrollSpy.observe(card));
  }

  function observeOptionalSections(form) {
    form.querySelectorAll('.cl-optional-section').forEach((section) => {
      if (section.dataset.navObserved === '1') return;
      section.dataset.navObserved = '1';
      new MutationObserver(() => global.refreshFormSectionNav?.()).observe(section, {
        attributes: true,
        attributeFilter: ['hidden'],
      });
    });
  }

  function wrapFormLayout(form) {
    if (document.getElementById('patientFormLayout')) {
      scrollRoot = document.querySelector('.patient-form-main');
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'patient-form-layout';
    layout.id = 'patientFormLayout';

    const aside = document.createElement('aside');
    aside.className = 'form-section-nav no-print';
    aside.setAttribute('aria-label', 'Form sections');
    aside.innerHTML = `<div class="form-section-nav-header"><i class="fa-solid fa-list" aria-hidden="true"></i> Sections</div>
      <nav id="formSectionNavList" class="form-section-nav-list" role="navigation" aria-label="Patient form sections"></nav>`;

    const main = document.createElement('div');
    main.className = 'patient-form-main';

    const parent = form.parentNode;
    parent.insertBefore(layout, form);
    main.appendChild(form);
    layout.append(aside, main);
    scrollRoot = main;
  }

  global.initFormSectionNav = function () {
    const form = document.getElementById('patientForm');
    if (!form) return;

    wrapFormLayout(form);
    buildNavItems(form);
    setupScrollSpy(form);
    observeOptionalSections(form);
  };

  global.refreshFormSectionNav = function () {
    const form = document.getElementById('patientForm');
    if (!form || !document.getElementById('formSectionNavList')) return;
    buildNavItems(form);
    setupScrollSpy(form);
  };

  global.navigateToFormSection = function (sectionId) {
    navigateToSection(document.getElementById(sectionId));
  };
})(typeof window !== 'undefined' ? window : globalThis);
