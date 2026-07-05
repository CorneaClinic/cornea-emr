# Project 4 — Registry Concurrency

**Status:** Complete  
**Scope:** Record locks + optimistic concurrency for KC, keratitis, dry eye, and keratoplasty registries.

---

## What shipped

### Database
- Migration `025_registry_record_locks.sql` — extends `record_edit_locks.entity_type` CHECK to include `kc_patient`, `keratitis_case`, `dry_eye_case` (plus existing `visit`, `kp_patient`, `kp_tissue`).

### API
| Area | Change |
|------|--------|
| `recordLockService.js` | Exported `ENTITY_TYPES`; audit log on admin **force-acquire** |
| `record-locks.js` | Read/write permissions for KC, keratitis, dry eye registries |
| `keratitisRegistryService.js` | `updateKeratitisCase` with `baseRevision` → 409 on conflict |
| `dryEyeRegistryService.js` | `updateDryEyeCase` with `baseRevision` → 409 on conflict |
| `eyeBankTraceabilityService.js` | `updateQuarantine` checks `baseRevision` |

### Clinic
- `cornea-record-lock.js` — generic `acquireEntityLock`, `beforeEditEntity`, `beforeSaveEntity`, `handleSaveConflict`; release on registry modals close
- **KC** — lock on edit modal; revision check + 409 handling on save
- **Keratitis** — PUT updates when cloud UUID exists; lock + revision flow
- **Dry eye** — PUT updates (replaces MVP create-only); lock + revision flow
- **Keratoplasty** — lock on KP patient / tissue edit modals

---

## Behaviour

1. **Edit lock** — Opening a synced registry record in cloud mode acquires a 5-minute lock (renewed every 90s). Another user sees conflict dialog: Cancel, View read-only, or Take over (admin only on server).
2. **Optimistic concurrency** — Saves send `baseRevision`. Server returns **409** if the cloud copy changed; clinic shows a refresh message.
3. **Stale warning** — Before save, clinic compares local revision with GET; user can cancel if cloud is newer.
4. **Audit** — Admin force-acquire writes `record_edit_lock` / `force_acquire` audit entry.

---

## Entity types

| Entity type | Registry | Revision API |
|-------------|----------|--------------|
| `visit` | EMR visits | `GET /api/v1/visits/:id` |
| `kc_patient` | KC & CXL | `GET /api/v1/kc-registry/:id` |
| `keratitis_case` | Ulcer keratitis | `GET /api/v1/keratitis-registry/:id` |
| `dry_eye_case` | Dry eye / OSD | `GET /api/v1/dry-eye-registry/:id` |
| `kp_patient` | Keratoplasty patients | `GET /api/v1/keratoplasty-patients/:id` |
| `kp_tissue` | Corneal tissue / eye bank | `GET /api/v1/corneal-tissues/:id` |

---

## Testing

```powershell
npm test --prefix apps/api -- registry-concurrency
```

E2E: extend `e2e/registry-workflows.spec.js` for keratitis PUT and `kc_patient` lock acquire (requires live API).

---

## Rollback

1. Revert clinic + API deploy.
2. Migration 025 is additive (CHECK widen only); rollback requires restoring the old CHECK if new types were used in production locks.

---

## Readiness impact

Estimated **+5% clinical readiness** — concurrent registry editing with conflict detection across major cornea registries.
