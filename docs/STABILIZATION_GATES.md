# Stabilization Gates G1–G7

**Project 1 of Production Readiness Plan**  
**Exit criterion:** All gates **PASS** before Project 2 begins.

---

## Verification

```powershell
npm run verify:gates          # Automated gate check (exit 0 = all PASS)
npm run stabilize:check       # Weekly ops check
npm run health:production     # G6/G7 health probe
npm run phase0:verified       # Append gate snapshot to backups/stabilization-gates.log
```

---

## Gate definitions

| Gate | Criterion | Automated check | Operator confirmation |
|------|-----------|-----------------|----------------------|
| **G1** Data safety | DB backed up; restore drill PASS; off-site `.dump.enc` | `backup.log` <48h; offsite enc; drill log | `npm run drill:restore-local` → `--drill-pass` |
| **G2** Media durability | `MEDIA_STORAGE_PROVIDER=s3` on DO | `global-debug` S3 env | Spot-check 10 assets in UI |
| **G3** Auth hardening | Refresh not in body; CORS; SMTP; password reset E2E | DO env via `global-debug` | `npm run verify:password-reset`; evidence file |
| **G4** Regression safety | CI green; pentest self-check | `stabilize:check` CI probe | Confirm GitHub Actions green |
| **G5** Sync reliability | Sync matrix covers visit/KP/KC/keratitis/dry-eye/OR/eye-bank | Gate evidence or CI log | CI `verify:sync-matrix` green |
| **G6** Security baseline | Redis-backed rate limits on production | `/health` → `checks.redis.mode=redis` | Confirm `REDIS_URL` on DO |
| **G7** Observability | Health checks + alert drill | API health; evidence file | `npm run alert-drill:fail`; GitHub notification |

---

## Operator evidence files

Create under `backups/gate-evidence/` (not committed — contains ops metadata):

| File | Content | Gate |
|------|---------|------|
| `g3-password-reset.pass` | `PASS` | G3 |
| `g5-sync-matrix.pass` | `PASS` | G5 |
| `g7-alert-drill.pass` | `PASS` | G7 |

---

## Rollback (Project 1)

| Change | Rollback |
|--------|----------|
| Record lock force → admin only | Revert `recordLockService.js` acquireLock check |
| Record lock release → kp:write | Revert `record-locks.js` release permission |
| Gate verifier script | Remove script; no runtime impact |

---

## Related

- [PRODUCTION_READINESS_ROADMAP.md](./PRODUCTION_READINESS_ROADMAP.md)
- [projects/PROJECT_01_STABILIZATION_GATES.md](./projects/PROJECT_01_STABILIZATION_GATES.md)
- [PRODUCTION_STABILIZATION_ROADMAP.md](./PRODUCTION_STABILIZATION_ROADMAP.md)
