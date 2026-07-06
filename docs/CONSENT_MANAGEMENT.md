# Consent Management

**Cornea Clinic EMR — VisionEMR**  
**Version:** 1.0 (Project 9)  
**Effective:** 2026-07-06

---

## Purpose

Document how informed consent is captured, stored, and reviewed across cornea subspecialty workflows.

---

## General treatment consent

- Registration and ongoing care imply **institutional consent for treatment** per clinic admission policy (paper or external EMR if applicable).
- Cloud sign-in and data processing are covered by clinic privacy notice and workforce confidentiality agreements.

---

## Laser refractive

**Module:** `apps/clinic/cornea-laser-refractive.js`

| Element | Implementation |
|---------|----------------|
| Procedure-specific checklist | Consent tab with topics and risks |
| Signed record | `workup.consent.signed`, `signedAt`, procedure name |
| Print | Consent print template via `data-lr-print="consent"` |
| Audit | Visit save/sync records consent state in visit JSON |

**Operator:** Ensure consent is signed before operative tab is completed; print and file per clinic SOP.

---

## Keratoplasty & surgical procedures

- OR schedule (`cornea-or-schedule.js`) includes `consent` flag on cases.
- Keratoplasty register links pre-op work-up; confirm consent documented in visit or paper file.

---

## Teaching cases

**Module:** `apps/clinic/cornea-teaching-library.js` + API `teaching-cases`

| Requirement | Action |
|-------------|--------|
| Patient identification removed | Use anonymised publish workflow |
| Explicit consent for teaching use | Document in case metadata before `publish` |
| Withdrawal | Unpublish and archive per governance request |

---

## Research & export

- FHIR/cohort exports default to **anonymize=true** (`/api/v1/fhir-export`).
- IRB approval required for identifiable research exports (institutional process).

---

## Future enhancements

- Global consent registry table (all procedure types)
- Consent expiry and re-consent reminders
- Digital signature capture with witness

---

## Operator

1. Verify laser consent signed before laser operative documentation.
2. Monthly: sample 5 teaching cases for consent metadata.
3. `npm run verify:medicolegal` — confirms consent modules present.

---

## Related

- `docs/DATA_RETENTION_POLICY.md`
- `docs/CLINICAL_GOVERNANCE.md`
- `apps/clinic/CHANGELOG-laser-refractive-module.md`
