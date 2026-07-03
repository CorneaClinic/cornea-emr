# Phase 4 exit — feature readiness complete

**Cornea Clinic EMR** · July 2026  
**Prerequisite:** Phase 0 gates G1–G7 PASS (see `backups/stabilization-gates.log`)

Phase 4 delivered controlled clinical and tertiary features in priority order P1–P7. All items ship with API routes, clinic UI (where applicable), unit tests, and Playwright CI coverage.

## Deliverables

| P | Feature | API / data | Clinic UI | CI |
|---|---------|------------|-----------|-----|
| P1 | Dashboard institute KPIs | `GET /dashboard/kpis` | Dashboard KPI grid | `dashboard-kpis.spec.js` |
| P2 | Offline research summaries | Research analytics cache | Research tab badge | `research-offline.spec.js` |
| P3 | Sirius / Pentacam CSV | Parser tests | KC topo import modal | `test:topography-import` |
| P4 | FHIR R4 export | `/fhir-export/*` | Research → Export FHIR | `fhir-export.spec.js` |
| P5 | Appointments & recall | `/appointments/*` | Appointments tab | `appointments.spec.js` |
| P6 | DICOM ingest | `/dicom/parse`, `/ingest` | Clinical Media → Import DICOM | `dicom.spec.js` |
| P7 | Dry eye, OR, ectasia v2 | `/dry-eye-registry`, `/or-schedule`, `/ectasia-ai` | Dry Eye tab; OR panel | `p7-clinical-modules.spec.js` |

Operator docs: `docs/APPOINTMENTS_RECALL.md`, `docs/FHIR_EXPORT.md`, `docs/DICOM_INGEST.md`, `docs/CLINICAL_MODULES_P7.md`, `docs/PENTACAM_IMPORT.md`.

## CI baseline

- **CI run #88** green on `761f6ea` — clinic-globals, unit + sync-matrix, e2e-playwright (15 spec files)
- Nightly: `.github/workflows/e2e-nightly.yml` — local Playwright + optional live staging smoke

## Production URLs

| Component | URL |
|-----------|-----|
| Clinic | https://corneaclinic.visionemr.net/Cornea |
| API | https://corneaclinic-2zfpt.ondigitalocean.app |

## Exit verification checklist

Run locally or confirm in GitHub Actions:

```powershell
npm run health:production
npm run phase4:verified    # appends gate + Phase 4 snapshot to backups/
```

Production smoke (operator):

- [ ] Dashboard KPIs populate after cloud sign-in
- [ ] Research → cohort CSV + FHIR export download
- [ ] KC → Sirius/Pentacam CSV import preview
- [ ] Appointments → book slot; recall queue loads
- [ ] Clinical Media → DICOM import preview
- [ ] Dry Eye → new case + assessment with OSD index
- [ ] Appointments → OR schedule → book PK case
- [ ] KC / laser → ectasia v2 analysis

## Remaining ops (post–Phase 4)

| Item | Action |
|------|--------|
| Staging nightly E2E | Set `STAGING_E2E_EMAIL` / `STAGING_E2E_PASSWORD` — `npm run check:staging-e2e` |
| Backup drill | Monthly `npm run drill:restore-local` |
| Pen-test remediation | **In progress** | Wave 0–1 closed; Wave 2 vendor **postponed** — `npm run pentest:self-check` |
| Deferred backlog | Teaching library, LDAP, mobile summary, contact lens research — see roadmap |

## What Phase 4 does *not* include

- Full PACS worklist / C-STORE
- LDAP / SSO
- Galilei server-side parse (CSV import only for P3)
- Production ML model training (ectasia v2 is rule-based + registry context)

Phase 4 **lifts the stabilization feature freeze** for the P1–P7 scope only. The audit Top 20 backlog beyond P7 remains deferred until pen-test exit and operator prioritization.
