# Project 8 — Clinical Validation

**Status:** Complete  
**Scope:** End-to-end simulation of all 11 cornea workflows + printing + media.

---

## What shipped

### Workflow catalog (11 subspecialties)
| ID | Workflow | UI / module |
|----|----------|-------------|
| W01 | Cornea clinic (core) | Patient visit form |
| W02 | Contact lens | `cornea-contact-lens.js` |
| W03 | Scleral lens | `cornea-scleral-lens.js` |
| W04 | Laser refractive | `cornea-laser-refractive.js` + ectasia AI |
| W05 | Corneal ulcer (keratitis) | Keratitis tab |
| W06 | Dry eye / OSD | Dry eye tab |
| W07 | Keratoconus | KC & CXL registry tab |
| W08 | Cross-linking (CXL) | KC CXL modal |
| W09 | Keratoplasty | Keratoplasty tab |
| W10 | Eye bank traceability | Eye bank panel (KP tab) |
| W11 | Opinion & referral | `cornea-opinion-referral.js` + teaching library |

### Verification & simulation
| Component | Purpose |
|-----------|---------|
| `scripts/verify-clinical-validation.mjs` | Ten checks (C1–C10); writes `docs/clinical-validation-reports/latest.json` |
| `scripts/lib/clinical-validation-checks.mjs` | Workflow definitions + probes (tested) |
| `scripts/clinical-workflow-simulation.mjs` | Live API simulation per workflow + media library |

### Playwright (live production)
| Component | Purpose |
|-----------|---------|
| `e2e/clinical-validation.spec.js` | Workflow tab navigation, printing, contact lens section |
| `playwright.clinical.config.js` | Desktop Chrome against production clinic |

### npm scripts
```powershell
npm run verify:clinical           # full P8 verification + JSON report
npm run test:clinical-validation    # static check unit tests
npm run clinical:simulate           # live API workflow simulation (needs credentials)
npm run test:e2e:clinical           # Playwright workflow tabs (needs STAGING_E2E_*)
```

---

## Checks (C1–C10)

| ID | Check |
|----|-------|
| C1 | 11 workflow definitions |
| C2 | Static JS modules for each workflow |
| C3 | UI tabs/markers in `Cornea.html` |
| C4 | Printing (`printSummary` + print CSS) |
| C5 | Clinical media platform (tab + API) |
| C6 | Workflow simulation script |
| C7 | Clinical validation e2e spec |
| C8 | This project doc |
| C9 | Live API workflow probes (needs credentials) |
| C10 | Live media library probe (needs credentials) |

---

## Operator workflow

1. **Weekly:** `npm run verify:clinical` (static checks always run; live probes skip without credentials)
2. **Before release:** `npm run clinical:simulate` with consultant credentials
3. **UI validation:** `npm run test:e2e:clinical`

```powershell
$env:STAGING_E2E_EMAIL = "your@email"
$env:STAGING_E2E_PASSWORD = "your-password"
npm run clinical:simulate
npm run test:e2e:clinical
```

Use `STAGING_E2E_ROLE=cornea_consultant` when creating the test user for full API access.

---

## Printing & media

- **Printing:** Visit summary via `printSummary()`; dedicated `@media print` rules in `Cornea.html`
- **Media:** Clinical Media tab, `media-library` API, DICOM import preview (`/api/v1/dicom/parse`)

---

## Rollback

Remove scripts and e2e spec; no database migration.

---

## Readiness impact

Estimated **+5% clinical readiness** — documented 11-workflow validation, automated static checks, live API simulation, and Playwright tab coverage.
