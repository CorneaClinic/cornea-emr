# Keratitis & Corneal Ulcer Registry (Project 3)

Structured workflow for infectious keratitis: case registration, daily ulcer assessments, microbiology, and cloud-backed registry sync.

## Clinic UI

1. **Keratitis & Ulcer** tab → **Overview** (active/healing/resolved counts) or **Ulcer cases**
2. **New case** — patient, eye, etiology, antimicrobial plan
3. Open a case → **Daily assessment** (ulcer size, BCVA, healing, pain)
4. **Culture result** — specimen, Gram stain, organism, sensitivity

Data is stored locally in IndexedDB (`keratitisCases`, `keratitisAssessments`, `keratitisCultures`) and syncs to the cloud API when signed in.

## API

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/keratitis-registry/overview` | `keratitis:read` |
| GET | `/api/v1/keratitis-registry` | `keratitis:read` |
| GET | `/api/v1/keratitis-registry/:id` | `keratitis:read` |
| POST | `/api/v1/keratitis-registry` | `keratitis:write` |
| POST | `/api/v1/keratitis-registry/:id/assessments` | `keratitis:write` |
| POST | `/api/v1/keratitis-registry/:id/cultures` | `keratitis:write` |

Migration: `017_keratitis_ulcer_registry.sql`

## EMR section

Cloud users need `keratitis_ulcer` in `emrSections` (or role defaults from `emr-sections.js`).

## Files

| File | Role |
|------|------|
| `apps/clinic/cornea-keratitis-taxonomy.js` | Etiology, status, specimen enums |
| `apps/clinic/cornea-keratitis.js` | UI logic + IndexedDB + cloud pull |
| `apps/api/src/services/keratitisRegistryService.js` | Postgres persistence |
| `apps/api/src/routes/keratitis-registry.js` | REST routes |

## Verify production

```bash
curl -s -o /dev/null -w "%{http_code}" https://corneaclinic-2zfpt.ondigitalocean.app/api/v1/keratitis-registry/overview
```

`401` = route live (auth required).
