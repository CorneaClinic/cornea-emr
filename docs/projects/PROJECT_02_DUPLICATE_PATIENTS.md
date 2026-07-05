# Project 2 — Duplicate Patient Prevention

**Status:** Complete  
**Started:** 5 July 2026  
**Roadmap:** [PRODUCTION_READINESS_ROADMAP.md](../PRODUCTION_READINESS_ROADMAP.md)

---

## Objective

Prevent accidental duplicate patient registration at front desk by checking MRN, national ID, name similarity, DOB/age, phone, and sex before save. Provide merge workflow for admin/clinical leads.

**Readiness lift:** +8% patient safety (target)

---

## Deliverables

| Item | Status |
|------|--------|
| Migration `024_patient_duplicate_prevention.sql` (national_id column) | Done |
| `duplicatePatientService.js` — scoring + find + merge | Done |
| API `POST /api/v1/patients/duplicates/check` | Done |
| API `POST /api/v1/patients/merge` (admin/consultant/ophthalmologist) | Done |
| Clinic duplicate panel in patient registration form | Done |
| Save guard on new visits (`CorneaDuplicatePatients.checkBeforeSave`) | Done |
| Unit tests `duplicate-patients.test.js` | Done |

---

## Match rules

| Signal | Severity | Action |
|--------|----------|--------|
| Exact MRN | **block** | Must open existing record or confirm distinct patient |
| Exact national ID | **block** | Same |
| Score ≥ 75 (name + phone/DOB/sex) | **high** | Confirm dialog before save |
| Score 50–74 | **medium** | Panel warning only |
| Score 30–49 | **low** | Informational |

---

## API

### Check duplicates

```http
POST /api/v1/patients/duplicates/check
Authorization: Bearer …
Content-Type: application/json

{
  "mrn": "CC-2024-001",
  "fullName": "Jane Doe",
  "phone": "+91 9876543210",
  "nationalId": "12345-6789012-3",
  "sex": "Female",
  "age": 45,
  "ageUnit": "years"
}
```

### Merge patients

Requires role `admin`, `cornea_consultant`, or `ophthalmologist`.

```http
POST /api/v1/patients/merge
{
  "targetPatientId": "uuid-to-keep",
  "sourcePatientId": "uuid-to-absorb",
  "keepMrn": "CC-2024-001",
  "confirm": true
}
```

Moves visits, appointments, and registry links; deletes source patient; audit logged.

---

## Clinic UI

- **National ID** optional field on Patient Information card
- **Duplicate panel** appears above demographics when matches found
- **Open record** loads existing visit from local IndexedDB or sets patient ID for history
- Works offline (local IndexedDB scan) and online (API check)

---

## Validation

```powershell
npm run test --prefix apps/api -- duplicate-patients
```

Manual: New Patient → enter ID matching existing patient → panel shows blocker → save blocked until confirmed.

---

## Rollback

1. Revert API + clinic commits
2. Migration 024 is additive (`national_id` nullable) — safe to leave in place
3. Disable UI by removing `cornea-duplicate-patients.js` script tag

---

## Clinical impact

**Positive:** Reduces wrong-chart risk at registration; supports merge for historical duplicates.  
**Neutral:** Existing patients unchanged; edit flow unchanged.

---

*Next: Project 3 — Offline data security*
