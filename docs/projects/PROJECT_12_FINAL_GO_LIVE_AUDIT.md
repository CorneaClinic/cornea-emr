# Project 12 — Final Go-Live Audit

**Status:** Complete  
**Scope:** Re-run Clinical Go-Live Assessment; compare scores; GO / CONDITIONAL GO / NO GO.

---

## What shipped

### Audit documentation
| Document | Purpose |
|----------|---------|
| `docs/FINAL_GO_LIVE_AUDIT.md` | Executive audit summary with baseline comparison |

### Verification & audit runner
| Component | Purpose |
|-----------|---------|
| `scripts/verify-final-go-live-audit.mjs` | Infrastructure checks (F12-1–F12-7); writes `docs/final-audit-reports/latest.json` |
| `scripts/run-final-go-live-audit.mjs` | Full audit run with live verifier execution |
| `scripts/lib/final-go-live-audit-checks.mjs` | Scoring model, risk register, decision logic (tested) |

### npm scripts
```powershell
npm run verify:final-audit   # P12 verification + projected decision
npm run test:final-audit     # unit tests
npm run audit:final          # full audit with live verify:* execution
```

---

## Checks (F12-1 … F12-7)

| ID | Check |
|----|-------|
| F12-1 | Final audit document present |
| F12-2 | Verification script + package mapping |
| F12-3 | Full audit runner script |
| F12-4 | Baseline July 2026 comparison referenced |
| F12-5 | Project 12 documentation present |
| F12-6 | Score model produces GO / CONDITIONAL GO / NO GO |
| F12-7 | Readiness lift from baseline |

---

## Decision logic

- **GO:** All dimensions ≥90%, overall ≥90%, zero open High risks.
- **CONDITIONAL GO:** Overall ≥85%, ≤2 open High risks, ≤2 dimensions below target.
- **NO GO:** Otherwise.

Baseline scores from July 2026 audit: overall 76, patient safety 72, clinical 82, technical 74, operational 68, security 74.

---

## Operator workflow

```powershell
npm run test:final-audit
npm run verify:final-audit
npm run audit:final
```

Review `docs/final-audit-reports/latest.json` for score comparison and decision.

---

## Program exit

With P1–P11 complete, the projected outcome is **CONDITIONAL GO** pending formal pen-test (R5) and institutional governance sign-off (R6 accepted).

---

## Rollback

Documentation and audit scripts only; no application runtime changes.
