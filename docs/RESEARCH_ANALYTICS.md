# Research Analytics & Outcomes Dashboard (Project 6)

Institute-level analytics across KC/CXL, keratitis, and keratoplasty graft registries — outcome summaries, cohort export, and simplified graft survival curves.

## Clinic UI

**Research** tab (cloud sign-in required for live data):

- Registry summary tiles (KC, CXL, keratitis, KP)
- Graft survival chart at 1/3/6/12/24/36-month checkpoints
- Cohort builder with CSV export

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/research-analytics/overview` | `research:read` |
| GET | `/api/v1/research-analytics/graft-survival` | `research:read` |
| GET | `/api/v1/research-analytics/cohort/:type` | `research:read` |
| GET | `/api/v1/research-analytics/cohort/:type/export.csv` | `research:export` |

### Cohort types

| `type` | Description |
|--------|-------------|
| `kc` | KC registry patients |
| `cxl` | CXL procedures |
| `keratitis` | Keratitis / ulcer cases |
| `kp` | All keratoplasty patients |
| `kp-graft` | Completed KP with exam/rejection aggregates |

## EMR section

Cloud users need `research_analytics` in `emrSections` (default for admin, consultants, ophthalmologists, trainees).

## Files

| File | Role |
|------|------|
| `apps/api/src/services/researchAnalyticsService.js` | Aggregations & CSV |
| `apps/api/src/routes/research-analytics.js` | REST routes |
| `apps/clinic/cornea-research-analytics.js` | Dashboard UI |

## Verify production

```bash
curl -s -o /dev/null -w "%{http_code}" https://corneaclinic-2zfpt.ondigitalocean.app/api/v1/research-analytics/overview
```

`401` = route live.

*Master Development Plan — Phase 3, Project 6.*
