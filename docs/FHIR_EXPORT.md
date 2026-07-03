# FHIR R4 export (Phase 4 P4 prototype)

Anonymized **FHIR R4 Bundle** export for registry cohorts and single-patient charts — intended for national registry pilots and research interchange.

## API endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/fhir-export/cohort/:type/bundle` | `research:export` | Registry cohort → `Bundle` (collection) |
| `GET` | `/api/v1/fhir-export/patients/:patientId/bundle` | `patients:read` + `visits:read` | Patient + visits → `Bundle` |

### Cohort types

`kc`, `cxl`, `keratitis`, `kp`, `kp-graft` (same as Research analytics cohorts).

### Query parameters

| Param | Default | Notes |
|-------|---------|-------|
| `anonymize` | `true` (cohort) | Strips name, DOB, phone; MRN → `ANON-{uuid}` |
| `limit` | service default | Max rows per cohort |

Response `Content-Type`: `application/fhir+json`

## Clinic UI

**Research & Outcomes** tab → **FHIR interchange (prototype)** → select cohort → **Export FHIR**.

Requires cloud sign-in and `research:export` permission (admin / senior clinical roles).

## Resource types in bundle

| Type | Source |
|------|--------|
| `Patient` | EMR patient or registry row |
| `Encounter` | Visit (patient bundle only) |
| `Condition` | Diagnosis / registry condition label |
| `Observation` | Topography metrics, progression, graft outcome |
| `Procedure` | CXL (cxl cohort) |

Profiles: `http://corneaclinic.visionemr.net/fhir/StructureDefinition/Cornea*`

## Tests

```bash
npm test --prefix apps/api -- tests/fhir-export.test.js
npm run test:e2e -- e2e/fhir-export.spec.js
```

## Files

| File | Role |
|------|------|
| `apps/api/src/services/fhirExportService.js` | Mappers + bundle builder |
| `apps/api/src/routes/fhir-export.js` | REST routes |
| `apps/clinic/cornea-research-analytics.js` | `exportCohortFhir()` UI |

## Not in scope (prototype)

- FHIR server validation (HAPI / Inferno)
- SNOMED / LOINC coded values (text-only `code.text` today)
- National MoH connector
- Bulk NDJSON export

---

*Phase 4 P4 — July 2026*
