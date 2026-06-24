# KP Graft Outcomes Registry (Project 5)

Post-keratoplasty follow-up: serial exams (BCVA, IOP, endothelial count, graft clarity) and rejection episodes, linked to KP register patients.

## Clinic UI

1. **Keratoplasty** → open a **Completed** (or any) patient in read-only detail
2. Scroll to **Graft outcomes** panel
3. **Post-graft exam** — date, interval, ECD, clarity, meds
4. **Rejection episode** — onset, type/grade, treatment, outcome

ECD trend chart appears when two or more exams include endothelial count.

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/keratoplasty-patients/graft-outcomes/overview` | `kp:read` |
| GET | `/api/v1/keratoplasty-patients/:id/graft-exams` | `kp:read` |
| POST | `/api/v1/keratoplasty-patients/:id/graft-exams` | `kp:write` |
| GET | `/api/v1/keratoplasty-patients/:id/rejections` | `kp:read` |
| POST | `/api/v1/keratoplasty-patients/:id/rejections` | `kp:write` |
| GET | `/api/v1/keratoplasty-patients/:id/graft-timeline` | `kp:read` |

Migration: `016_kp_graft_outcomes.sql` (extends `keratoplasty_patients` with `graft_outcome_status`, EMR link fields).

## IndexedDB stores

- `kpGraftExams` — keyed by local `kpPatientId`
- `kpRejections` — rejection episodes per KP patient

Cloud bootstrap calls `CorneaKpGraftOutcomes.syncFromCloud()` after sign-in.

## Files

| File | Role |
|------|------|
| `apps/clinic/cornea-kp-graft-outcomes.js` | Exams, rejections, ECD chart, sync |
| `apps/api/src/services/kpGraftOutcomesService.js` | Postgres persistence |
| `apps/api/src/routes/kp-graft-outcomes.js` | Nested KP routes |

## Verify production

```bash
curl -s -o /dev/null -w "%{http_code}" https://corneaclinic-2zfpt.ondigitalocean.app/api/v1/keratoplasty-patients/graft-outcomes/overview
```

`401` = route live (auth required).
