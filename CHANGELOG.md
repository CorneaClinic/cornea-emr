# Changelog — Production Readiness

## [Unreleased] — Project 2: Duplicate Patient Prevention (2026-07-05)

### Added
- `duplicatePatientService.js` — MRN/national ID/name/phone/DOB/sex scoring, merge workflow
- API `POST /api/v1/patients/duplicates/check` and `POST /api/v1/patients/merge`
- Migration `024_patient_duplicate_prevention.sql` — optional `national_id` on patients
- Clinic `cornea-duplicate-patients.js` — registration duplicate panel + save guard
- Optional **National ID** field on patient registration form
- `docs/projects/PROJECT_02_DUPLICATE_PATIENTS.md`

### Changed
- `patientService.js`, `sync-mappers.js`, `syncService.js` — national ID support
- New visit save blocked on cross-MRN national ID duplicate; high-confidence demographic match requires confirmation

### Rollback
- Revert API + clinic commits; migration 024 is additive and safe to leave applied

---

## Project 1: Stabilization Gates (complete 2026-07-05)

### Added
- `scripts/verify-stabilization-gates.mjs` — automated G1–G7 verification (`npm run verify:gates`)
- `docs/PRODUCTION_READINESS_ROADMAP.md` — 12-project sequential readiness plan
- `docs/STABILIZATION_GATES.md` — gate definitions and operator evidence files
- `docs/projects/PROJECT_01_STABILIZATION_GATES.md` — Project 1 deliverable tracker

### Changed
- Record lock **force-acquire** restricted to `admin` role (`recordLockService.js`)
- Record lock **release** requires `kp:write` instead of `kp:read` (`record-locks.js`)

### Security
- Aligns force-lock behaviour with `docs/RECORD_LOCKING.md` (admin override only)

### Rollback
- Revert `recordLockService.js` and `record-locks.js` if lock workflow blocks clinical staff

---

## Prior releases

See git history and [BACKLOG.md](./docs/BACKLOG.md) for B1–B4 clinical backlog (contact lens research, mobile summary, teaching library, SSO).
