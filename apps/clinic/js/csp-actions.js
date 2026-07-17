/**
 * CSP-safe delegated click/change handlers (replaces inline on* attributes).
 */
(function initCspActions() {
  const root = typeof globalThis !== 'undefined' ? globalThis : window;

  function resolveCallable(path) {
    return String(path || '')
      .split('.')
      .reduce((current, key) => (current == null ? undefined : current[key]), root);
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

  function showHandlerError(err) {
    const message = err?.message || String(err);
    if (typeof root.showToast === 'function') {
      root.showToast(message, 'error');
    } else {
      root.alert?.(message);
    }
  }

  function invokeAction(target, attrName, event) {
    const action = target.getAttribute(attrName);
    if (!action) return;

    const fn = resolveCallable(action);
    if (typeof fn !== 'function') {
      console.warn('[CSP] Missing handler:', action);
      return;
    }

    const args = parseArgs(target.getAttribute('data-csp-args'));
    let result;
    try {
      result = fn.apply(target, args);
    } catch (err) {
      console.error('[CSP] Handler failed:', action, err);
      showHandlerError(err);
      return;
    }
    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        console.error('[CSP] Async handler failed:', action, err);
        showHandlerError(err);
      });
    }
    if (result === false && event?.preventDefault) event.preventDefault();
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-csp-action]')
      : null;
    if (!target) return;
    invokeAction(target, 'data-csp-action', event);
  });

  document.addEventListener('change', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.hasAttribute('data-csp-change')) return;
    invokeAction(target, 'data-csp-change', event);
  });

  document.addEventListener('input', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.hasAttribute('data-csp-input')) return;
    invokeAction(target, 'data-csp-input', event);
  });
})();
