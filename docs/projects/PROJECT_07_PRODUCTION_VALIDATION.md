# Project 7 — Production Validation

**Status:** Complete  
**Scope:** Regression, Playwright, performance/load, browser/mobile, accessibility.

---

## What shipped

### Verification & reporting
| Component | Purpose |
|-----------|---------|
| `scripts/verify-production-validation.mjs` | Twelve checks (V1–V12); writes `docs/validation-reports/latest.json` |
| `scripts/lib/production-validation-checks.mjs` | Shared helpers (tested) |
| `scripts/production-load-check.mjs` | Light API latency baseline (`/health/live`) |
| `scripts/production-a11y-check.mjs` | Static + live clinic accessibility baseline |

### Playwright (live production)
| Component | Purpose |
|-----------|---------|
| `e2e/production-validation.spec.js` | Desktop + mobile: sign-in, New Visit modal, tab navigation |
| `playwright.production.config.js` | Desktop Chrome + Pixel 5 projects |

### npm scripts
```powershell
npm run verify:production          # full P7 verification + JSON report
npm run test:production-validation # static check unit tests
npm run production:load-check      # API p95 latency baseline
npm run production:a11y-check      # clinic a11y baseline
npm run test:e2e:production        # live Playwright (needs STAGING_E2E_*)
npm run test:e2e:staging           # existing staging smoke
npm run check:production-operator  # API regression checklist
```

---

## Checks (V1–V12)

| ID | Check |
|----|-------|
| V1 | Playwright regression suite (≥10 specs, 3 configs) |
| V2 | API unit test suite (vitest) |
| V3 | Staging smoke spec |
| V4 | Production validation e2e spec + config |
| V5 | Load check script |
| V6 | Accessibility check script |
| V7 | Operator regression script |
| V8 | This project doc |
| V9 | Live API health (`/health`) |
| V10 | Live clinic HTML loads |
| V11 | API latency baseline — p95 ≤ 3000ms on `/health/live` |
| V12 | Clinic a11y — lang/viewport + login labels in adapter |

---

## Operator workflow

1. **CI / nightly:** `npm test` (API) + Playwright local (`e2e-nightly.yml`)
2. **Weekly:** `npm run verify:production`
3. **Before release:** `npm run test:e2e:production` with `STAGING_E2E_EMAIL` / `STAGING_E2E_PASSWORD`
4. **Full API regression:** `npm run check:production-operator` (consultant role recommended)

### Playwright credentials
```powershell
$env:STAGING_E2E_EMAIL = "your@email"
$env:STAGING_E2E_PASSWORD = "your-password"
npm run test:e2e:production
```

---

## Performance baseline

`production:load-check` hits `/health/live` 20 times sequentially and reports min/avg/p95/max. Override threshold:

```powershell
$env:LOAD_P95_MAX_MS = "5000"
npm run production:load-check
```

---

## Accessibility scope

P7 covers **baseline** checks only (not full WCAG audit):

- `html lang`, `title`, viewport meta on `Cornea.html`
- Login form labels in `cornea-api-adapter.js` (JS-injected modal)
- `role="dialog"` on patient visit modal shell

For full accessibility audit, use a dedicated tool (axe, Lighthouse) in a future pass.

---

## Rollback

Remove scripts and e2e spec; no database or API changes.

---

## Readiness impact

Estimated **+4% technical readiness** — automated regression verification, load baseline, mobile/desktop Playwright, and accessibility shell checks.
