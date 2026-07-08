/**
 * CSP-safe delegated click handlers (replaces inline onclick attributes).
 */
(function initCspActions() {
  function resolveCallable(path) {
    return String(path || '')
      .split('.')
      .reduce((current, key) => (current == null ? undefined : current[key]), window);
  }

  function parseArgs(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((entry) => {
        if (!entry || typeof entry !== 'object' || !entry.__expr) return entry;
        return resolveCallable(entry.__expr);
      });
    } catch {
      return [];
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-csp-action]')
      : null;
    if (!target) return;

    const action = target.getAttribute('data-csp-action');
    if (!action) return;

    const fn = resolveCallable(action);
    if (typeof fn !== 'function') {
      console.warn('[CSP] Missing click handler:', action);
      return;
    }

    const args = parseArgs(target.getAttribute('data-csp-args'));
    const result = fn.apply(target, args);
    if (result === false) event.preventDefault();
  });
})();
