# Stabilization mode (vendor postponed)

**Cornea Clinic EMR** · July 2026  
**Mode:** Harden and operate — **no new clinical modules** until vendor pen-test resumes or clinic lifts the backlog gate.

Formal vendor engagement is **postponed** (`docs/PENTEST_ENGAGEMENT.md`). Interim security work uses Wave 1 CI tests, `npm run pentest:self-check`, and `docs/PENTEST_ASVS_CHECKLIST.md`.

---

## Ops rhythm

| Cadence | Command / action |
|---------|------------------|
| **Weekly** | `npm run stabilize:check` |
| **After deploy** | `npm run check:production-operator` |
| **Monthly** | `npm run drill:restore-local` |
| **Nightly (CI)** | E2E workflow with staging secrets |
| **Quarterly** | Production user role review (below) |

Quick combined check:

```powershell
npm run stabilize:check
```

---

## Weekly stabilization checklist

| # | Item | Pass |
|---|------|------|
| 1 | `npm run stabilize:check` green (or only S9 skipped locally) | ☐ |
| 2 | Production API `/health/live` returns `ok: true` | ☐ |
| 3 | GitHub CI green on latest `main` commit | ☐ |
| 4 | No unplanned outages reported by clinic staff | ☐ |
| 5 | Backup log reviewed (`backups/production/backup.log`) | ☐ |

---

## Interim hardening (Wave 3)

Track progress in `docs/PENTEST_REMEDIATION.md` § Wave 3.

| Item | Status | Action |
|------|--------|--------|
| Sync push batch limit (max 100) | **Enforced** | `syncService.js`; test in `security-pentest.test.js` |
| ASVS L2 self-assessment | In progress | `docs/PENTEST_ASVS_CHECKLIST.md` |
| Cloudflare WAF / API rate rules | **Reviewed** | Managed Ruleset + Bot Fight Mode active (2026-07-03) — `docs/CLOUDFLARE_WAF_REVIEW.md` |
| Quarterly role review | Ops | Table below |
| Staging mirror | Optional | `docs/DEPLOY_ROLLBACK.md` staging E2E |

---

## Quarterly role review (least privilege)

Run every **3 months** (Jan / Apr / Jul / Oct). Record date and operator in `backups/ops-smoke-test.log`.

| # | Check |
|---|--------|
| 1 | List production users via Admin → Users |
| 2 | Confirm no shared accounts; each user has own login |
| 3 | `admin` role limited to IT / clinic lead |
| 4 | `cornea_consultant` / clinical roles match active staff only |
| 5 | Deactivate departed users; rotate `e2e-monitor` / test accounts if exposed |
| 6 | Confirm `pentest-vendor@` inactive until vendor reactivated |

---

## Production smoke (after major changes)

See `docs/PHASE4_EXIT.md` § Exit verification — dashboard KPIs, FHIR export, appointments, DICOM, dry eye, OR, ectasia v2.

---

## When to exit stabilization mode

Choose one:

1. **Resume vendor pen-test** — reactivation triggers in `docs/PENTEST_ENGAGEMENT.md`
2. **Start deferred backlog** — see [BACKLOG.md](./BACKLOG.md) (B1–B4 **done** 2026-07-04)

---

## Related

- `docs/PENTEST_REMEDIATION.md` — Wave 0–3 tracker  
- `docs/SECURITY_BASELINE.md` — G6 controls  
- `docs/PHASE4_EXIT.md` — P1–P7 operator smoke  
- `docs/BACKUP_RECOVERY.md` — backup drill  
