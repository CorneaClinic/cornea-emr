# Project 11 — 90-Day Pilot Plan

**Status:** Complete  
**Scope:** Pilot protocol, weekly checklist, safety monitoring, success metrics, expansion criteria.

---

## What shipped

### Pilot documentation
| Document | Purpose |
|----------|---------|
| `docs/PILOT_90_DAY_PROTOCOL.md` | 90-day phases, governance roles, escalation |
| `docs/PILOT_WEEKLY_CHECKLIST.md` | Weekly operator review checklist |
| `docs/PILOT_SAFETY_MONITORING.md` | Safety signals, thresholds, monitoring workflow |
| `docs/PILOT_SUCCESS_METRICS.md` | Technical, clinical, and adoption KPIs |
| `docs/PILOT_EXPANSION_CRITERIA.md` | Expansion/extend/restrict decision matrix |

### Verification & review
| Component | Purpose |
|-----------|---------|
| `scripts/verify-pilot-plan.mjs` | Pilot checks (P11-1–P11-7); writes `docs/pilot-reports/latest.json` |
| `scripts/lib/pilot-plan-checks.mjs` | Shared helpers (tested) |
| `scripts/review-pilot-week.mjs` | Weekly safety review with health + audit sample |

### npm scripts
```powershell
npm run verify:pilot           # full P11 verification + JSON report
npm run test:pilot-plan        # static check unit tests
npm run pilot:weekly-review    # weekly safety review output
```

---

## Checks (P11-1 … P11-7)

| ID | Check |
|----|-------|
| P11-1 | All five pilot documents with required sections |
| P11-2 | Verification script + package mapping |
| P11-3 | Weekly review script |
| P11-4 | Protocol/checklist link safety monitoring |
| P11-5 | Success metrics linked to expansion criteria |
| P11-6 | Project 11 documentation present |
| P11-7 | Live pilot health probe (API + clinic) |

---

## Operator workflow

1. Start pilot using `docs/PILOT_90_DAY_PROTOCOL.md`.
2. Each week: `npm run pilot:weekly-review` + complete `docs/PILOT_WEEKLY_CHECKLIST.md`.
3. Track KPIs in `docs/PILOT_SUCCESS_METRICS.md`.
4. At day 90: apply `docs/PILOT_EXPANSION_CRITERIA.md` for expansion decision.

```powershell
npm run test:pilot-plan
npm run verify:pilot
npm run pilot:weekly-review
```

---

## Rollback

Project 11 adds pilot governance documents and validation scripts only.  
Rollback is documentation/script removal; application runtime behavior is unchanged.

---

## Readiness impact

Estimated governance readiness lift through structured 90-day pilot operations, weekly safety monitoring, and measurable expansion criteria ahead of Project 12 final audit.
