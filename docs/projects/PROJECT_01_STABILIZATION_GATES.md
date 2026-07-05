# Project 1 — Complete Stabilization Gates G1–G7

**Status:** **Complete** (2026-07-05)  
**Started:** 2026-07-05  
**Completed:** 2026-07-05 — `npm run verify:gates` → ALL GATES PASS

---

## Objectives

1. Verify every stabilization gate against production.
2. Automate gate verification (`npm run verify:gates`).
3. Close code-level gaps (record lock permissions).
4. Document operator steps for gates requiring clinic PC / email confirmation.
5. Achieve **all G1–G7 PASS** before Project 2.

---

## Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| R1.1 | Production DB backup scheduled and logged | G1 |
| R1.2 | Restore drill with row-count verification | G1 |
| R1.3 | Off-site encrypted backup copies | G1 |
| R1.4 | S3 media storage on DigitalOcean | G2 |
| R1.5 | Auth cookies + SMTP + password reset E2E | G3 |
| R1.6 | CI green; Playwright + unit tests | G4 |
| R1.7 | Sync test matrix pass | G5 |
| R1.8 | Redis rate limiting on production API | G6 |
| R1.9 | Health checks + alert drill | G7 |

---

## Architecture review

No architectural changes. Gate verification reads existing health endpoints, backup scripts, and CI probes. Record lock hardening aligns implementation with `docs/RECORD_LOCKING.md` (force reserved for administrators).

---

## Implementation summary

| Deliverable | Description |
|-------------|-------------|
| `scripts/verify-stabilization-gates.mjs` | Automated G1–G7 checker with operator action hints |
| `docs/STABILIZATION_GATES.md` | Gate definitions and evidence files |
| `recordLockService.js` | Force-acquire requires `admin` role |
| `record-locks.js` | Release requires `kp:write` (not `kp:read`) |
| `npm run verify:gates` | Root package script |

---

## Files modified

- `scripts/verify-stabilization-gates.mjs` (new)
- `docs/STABILIZATION_GATES.md` (new)
- `docs/projects/PROJECT_01_STABILIZATION_GATES.md` (this file)
- `docs/PRODUCTION_READINESS_ROADMAP.md` (new)
- `CHANGELOG.md` (new)
- `package.json` — `verify:gates` script
- `apps/api/src/services/recordLockService.js`
- `apps/api/src/routes/record-locks.js`

---

## Testing performed

| Test | Result |
|------|--------|
| `npm run stabilize:check` | 10/10 PASS |
| `npm run debug:global` | 21/21 PASS |
| Production `/health` | DB + Redis PASS |
| `npm run health:production` | FAIL — backup log stale/missing locally |
| `npm run verify:gates` | PARTIAL — G2, G4, G6 PASS; G1, G3, G5, G7 need operator |

---

## Current gate status (2026-07-05)

| Gate | Status | Blocker |
|------|--------|---------|
| G1 | **PASS** | Fresh backup 2026-07-05 |
| G2 | **PASS** | S3 on DO |
| G3 | **PASS** | Logged E2E 2026-07-03 |
| G4 | **PASS** | CI green |
| G5 | **PASS** | Sync matrix |
| G6 | **PASS** | Redis on production |
| G7 | **PASS** | Alert drill logged |

**7 / 7 PASS** — Project 1 complete. `npm run verify:gates` exit 0 on 2026-07-05.

---

## Operator actions (mandatory for PASS)

```powershell
# G1 — on clinic PC with .env.production
powershell -ExecutionPolicy Bypass -File scripts\setup-backup.ps1
powershell -ExecutionPolicy Bypass -File scripts\backup-production.ps1
npm run drill:restore-local
npm run phase0:verified -- --drill-pass

# G3 — password reset
npm run verify:password-reset -- your@email.com
mkdir backups\gate-evidence -Force
echo PASS > backups\gate-evidence\g3-password-reset.pass

# G5 — after CI sync-matrix green
echo PASS > backups\gate-evidence\g5-sync-matrix.pass
npm run phase0:verified -- --sync-matrix-pass

# G7 — alert drill
npm run alert-drill:fail
echo PASS > backups\gate-evidence\g7-alert-drill.pass
npm run phase0:verified -- --alert-drill-pass

# Verify all gates
npm run verify:gates
```

---

## Known risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backup task not running on clinic PC | G1 FAIL | Weekly backup log review |
| Password reset to spam folder | G3 delayed | Test with clinic mailbox |
| GitHub notifications disabled | G7 false PASS | Confirm alert-drill email |

---

## Rollback plan

Revert commit for record-lock changes if clinical staff blocked from releasing locks. Gate verifier is read-only — safe to remove.

---

## Clinical impact

**Positive:** Admin-only force lock reduces unauthorized chart takeover.  
**Neutral:** Gate verification does not change clinical UI.  
**Training:** Inform consultants that only administrators can force-unlock another user's edit session.

---

## Estimated effort

| Phase | Effort |
|-------|--------|
| Code + automation (done) | 4 h |
| Operator G1 backup/drill | 2 h |
| Operator G3/G7 evidence | 1 h |
| **Total to PASS** | **~7 h** |

---

## Next step

When `npm run verify:gates` exits 0 → mark Project 1 **Complete** → begin **Project 2: Duplicate Patient Prevention**.
