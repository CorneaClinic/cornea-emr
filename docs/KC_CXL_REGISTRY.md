# KC & CXL Longitudinal Registry (Project 2)

Keratoconus programme enrolment, serial topography (Kmax/Kmean), CXL protocol tracking, progression flags, and links to scleral lens / laser refractive modules.

## Apply migration

```bash
cd apps/api
node src/db/migrate-cli.js
```

Migration: `015_kc_cxl_registry.sql`

## API (`/api/v1/kc-registry`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Dashboard counts |
| GET | `/` | List enrolled patients |
| POST | `/` | Enrol patient |
| GET | `/:id` | Patient + topography + CXL |
| PUT | `/:id` | Update patient |
| DELETE | `/:id` | Remove patient |
| GET | `/:id/timeline` | Combined chronological events |
| GET/POST | `/:id/topography` | Serial topography readings |
| PUT/DELETE | `/:id/topography/:readingId` | Edit/remove reading |
| GET/POST | `/:id/cxl` | CXL procedures |
| PUT/DELETE | `/:id/cxl/:cxlId` | Edit/remove CXL |

Permissions: `kc:read`, `kc:write` (clinical senior roles).

## Clinic UI

- Navigation: **KC & CXL** tab (`kc_registry` EMR section)
- IndexedDB stores: `kcPatients`, `kcTopography`, `kcCxlProcedures` (DB v8)
- Cloud mode: direct API sync on save; pull on tab open

## Clinical media integration

- Link patient MRN to Clinical Media Library topography timeline
- Topography uploads use category `topography` / Pentacam alias
- Import from visit: pulls laser refractive work-up topography fields

## Progression rules

- ΔKmax ≥ 1.0 D across serial readings → Suspect progression (per eye)
- Patient `progression_status` aggregates flagged eyes
- CXL post-op: Kmax/Kmean at 3m, 6m, 12m

## Related modules

- `cornea-laser-refractive.js` — per-visit ectasia screening (import source)
- `cornea-scleral-lens.js` — KC fitting (linked from registry)
- Project 4 — Pentacam CSV import (future)

## Deploy

```bash
npm run deploy:clinic   # UI
# Redeploy DO App Platform API after migration
```
