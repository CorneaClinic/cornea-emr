# Project 10 — Go-Live Preparation

**Status:** Complete  
**Scope:** Role manuals, training guide, deployment checklist, downtime SOP, incident/rollback linkage.

---

## What shipped

### Operational documentation
| Document | Purpose |
|----------|---------|
| `docs/ADMIN_MANUAL.md` | Admin daily operations, escalation, deployment controls |
| `docs/CLINICIAN_MANUAL.md` | Clinical workflow guardrails and downtime protocol |
| `docs/RECEPTION_MANUAL.md` | Front-desk workflow and escalation triggers |
| `docs/TRAINING_GUIDE.md` | Role-based onboarding and competency sign-off |
| `docs/GO_LIVE_DEPLOYMENT_CHECKLIST.md` | Production release gate and go/no-go sign-off |
| `docs/DOWNTIME_SOP.md` | Downtime activation, role actions, reconciliation |

### Verification
| Component | Purpose |
|-----------|---------|
| `scripts/verify-go-live-preparation.mjs` | Go-live checks; writes `docs/go-live-reports/latest.json` |
| `scripts/lib/go-live-preparation-checks.mjs` | Shared helper checks (tested) |
| `scripts/tests/go-live-preparation-checks.test.mjs` | Unit tests for go-live checks |

### npm scripts
```powershell
npm run verify:go-live            # full P10 verification + JSON report
npm run test:go-live-preparation  # static check unit tests
```

---

## Checks (G10-1 … G10-6)

| ID | Check |
|----|-------|
| G10-1 | All go-live documents present with required sections |
| G10-2 | Verification script + package mapping |
| G10-3 | Deployment checklist links rollback runbook |
| G10-4 | Clinician and reception manuals link downtime SOP |
| G10-5 | Incident response linkage in go-live docs |
| G10-6 | Project 10 documentation present |

---

## Operator workflow

1. Complete role training sessions and competency sign-off.
2. Execute release using `docs/GO_LIVE_DEPLOYMENT_CHECKLIST.md`.
3. If platform degradation occurs, activate `docs/DOWNTIME_SOP.md`.
4. Run go-live readiness verification before each major release:

```powershell
npm run test:go-live-preparation
npm run verify:go-live
```

---

## Rollback

Project 10 adds governance and operational documents plus validation scripts only.  
Rollback is documentation/script removal; application runtime behavior is unchanged.

---

## Readiness impact

Estimated **+3% operational readiness** through standardized manuals, role training, go-live gating, and downtime readiness.
