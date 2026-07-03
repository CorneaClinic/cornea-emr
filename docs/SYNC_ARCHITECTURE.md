# Cornea EMR — Synchronization Architecture

PostgreSQL is the **source of truth**. IndexedDB (`CorneaClinicDB`) is an **offline cache** and **outbound mutation queue**. Existing local data is preserved and migrated into the sync queue on first cloud enable.

## Topology

```
┌─────────────────┐     save/load      ┌──────────────────┐
│   Cornea.html   │ ◄────────────────► │ IndexedDB cache  │
│   (UI layer)    │                    │ patients/kp/sync │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │ CorneaApi + CorneaSync               │ sync_queue
         ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│              POST /api/v1/sync/push                      │
│              GET  /api/v1/sync/pull                      │
└────────────────────────┬────────────────────────────────┘
                         ▼
              ┌──────────────────────┐
              │     PostgreSQL       │
              │  visits, patients,   │
              │  kp_*, client_mutations │
              └──────────────────────┘
```

## IndexedDB schema (v4)

| Store | Purpose |
|-------|---------|
| `patients` | Visit cache (legacy flat documents + sync metadata) |
| `kpPatients` | Keratoplasty patient cache |
| `kpTissues` | Corneal tissue cache |
| `sync_queue` | Outbound pending mutations |
| `sync_meta` | Device id, pull cursor, last sync time |
| `sync_logs` | Client-side sync activity log (last 500 entries) |

### Record sync metadata (on cached entities)

| Field | Purpose |
|-------|---------|
| `uuid` | Server entity id |
| `revision` | Optimistic lock version from server |
| `sync_status` | `synced`, `pending`, `pending_upload`, `conflict`, `error` |
| `client_mutation_id` | Idempotency key |
| `updated_at` | Server timestamp after sync |

## Outbound queue entry

| Field | Description |
|-------|-------------|
| `mutation_id` | UUID (idempotent push key) |
| `entity_type` | `visit`, `kp_patient`, `kp_tissue`, `kp_reserve` |
| `operation` | `upsert`, `delete`, `reserve` |
| `payload` | Full document for upsert |
| `base_revision` | Expected server revision |
| `local_id` | IndexedDB auto-increment id |
| `attempts` | Retry counter |
| `status` | `pending`, `error`, `conflict`, `failed` |

## Client flow (local-first)

1. **Save** → write IndexedDB immediately → enqueue mutation → UI returns
2. **Background drain** → `POST /sync/push` batch (max 25)
3. **On success** → update local record with server `uuid`, `revision`, `sync_status: synced`
4. **On conflict (409)** → mark queue item `conflict`, apply server state to cache, show badge
5. **On network/5xx error** → exponential backoff retry (max 8 attempts)
6. **Pull** → `GET /sync/pull?cursor=` → merge inbound changes into cache
7. **Reconnect** → `online` event triggers drain + pull

## Server tables (migration `008_sync_infrastructure.sql`)

| Table | Purpose |
|-------|---------|
| `client_mutations` | Idempotent push replay log |
| `sync_cursors` | Per-device pull position |
| `sync_conflicts` | Open conflict registry |
| `sync_logs` | Server-side push/pull audit trail |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/sync/push` | Apply mutation batch |
| GET | `/api/v1/sync/pull` | Delta feed since cursor |
| GET | `/api/v1/sync/status` | Open conflicts + cursor info |
| GET | `/api/v1/sync/logs` | Server sync logs (admin) |
| POST | `/api/v1/sync/resolve-conflict` | Mark conflict resolved |

## Conflict detection

Push rejected when `base_revision ≠ server.revision`. Response:

```json
{
  "status": "conflict",
  "details": {
    "serverRevision": 3,
    "serverState": { "...legacy flat document..." }
  }
}
```

Client applies server state to cache and flags the queue item. User resolves via UI (future) or accepts server copy automatically.

## Legacy data migration

On first cloud bootstrap (`CorneaSync.migrateExistingRecords`):

- Existing `patients` / `kpPatients` / `kpTissues` rows without `sync_status` are tagged `pending_upload`
- Each is enqueued as an `upsert` mutation with `base_revision: 0`
- **No data is deleted** — IndexedDB contents are preserved

## Files

| File | Role |
|------|------|
| `Cornea Clinic file/cornea-sync-client.js` | Queue, pull, retry, logs, badge |
| `Cornea Clinic file/cornea-api-adapter.js` | Local-first patches to UI globals |
| `apps/api/src/services/syncService.js` | Push/pull engine |
| `apps/api/src/services/sync-mappers.js` | Legacy ↔ PostgreSQL mapping |
| `apps/api/src/routes/sync.js` | REST surface |

## Offline guarantee

All read/write UI paths operate against IndexedDB when cloud mode is enabled. Network is only required for background sync — **offline functionality is preserved**.

## Registry sync policy (G5)

Not all clinical data uses the sync queue. This is intentional during Phase 2 stabilization.

| Data domain | Client path | Server path | Offline queue | Conflict policy |
|-------------|-------------|-------------|---------------|-----------------|
| Visits / patients | `CorneaSync` queue | `POST /sync/push` | Yes | Server revision wins; client shows conflict badge |
| KP patients / tissues | `CorneaSync` queue | `POST /sync/push` | Yes | Same as visits |
| KC / CXL registry | Direct REST | `/api/v1/kc-registry` | No* | `baseRevision` on update → 409 Conflict |
| Keratitis registry | Direct REST | `/api/v1/keratitis-registry` | No* | Online required for write |
| Dry eye / OSD registry | Direct REST | `/api/v1/dry-eye-registry` | No* | Online required for write |
| OR scheduling | Direct REST | `/api/v1/or-schedule` | No* | Online required for write |
| Eye bank traceability | Direct REST | `/api/v1/eye-bank/*` | No* | Linked to KP tissue UUID |
| Graft outcomes | Direct REST | `/api/v1/kp-graft-outcomes` | No* | Per-module REST semantics |
| Appointments / recall | Direct REST | `/api/v1/appointments` | No* | Online required for write |
| Clinical media | Upload queue + REST | `/api/v1/media` | Partial | Retry on reconnect |

\*Offline reads may use IndexedDB cache where implemented; writes require connectivity.

**Verification:** `npm run verify:sync-matrix` (CI) exercises sync entities (visit, kp_patient, kp_tissue) plus KC, keratitis, dry eye, OR, and eye bank REST create/read.

**Future (Phase 2.1):** extend `sync_queue` for registries OR formalize online-only registry UX when offline.

### Phase 2.1 — Client write path inventory (M2.1)

| Domain | Client module | Write operations | Sync queue |
|--------|---------------|------------------|------------|
| Visits / patients | `cornea-sync-client.js`, `patient-form.js` | save visit, enqueue upsert | Yes |
| KP patients / tissues | `cornea-sync-client.js`, `cornea-keratoplasty.js` | KP register save | Yes |
| KC / CXL registry | `cornea-kc-cxl.js` | POST/PUT `/kc-registry`, topography, CXL | No — direct REST |
| Keratitis registry | `cornea-keratitis.js` | POST/PUT `/keratitis-registry` | No |
| Dry eye / OSD | `cornea-dry-eye.js` | POST/PUT `/dry-eye-registry` | No |
| OR scheduling | `cornea-or-scheduling.js` | POST/PUT `/or-schedule` | No |
| Eye bank | `cornea-eye-bank.js` | custody / chain REST | No |
| Record locks | `cornea-record-lock.js` | acquire / renew / release | N/A (coordination only) |
| Clinical media | `cornea-media-upload.js` | upload queue + REST | Partial |

**Regression coverage (G4):** Playwright `registry-workflows.spec.js` (KC CRUD + record lock API), `kc-registry-ui.spec.js` (KC tab panels), `registry-offline.spec.js` (offline banner + disabled saves).

### Phase 2.1 M2.2 — Online-only policy (implemented July 2026)

**Decision:** Option A — registries that use direct REST require **internet while signed in to cloud**. Pure offline (local) clinic mode continues to use IndexedDB only.

| Registry | Module | Offline in cloud mode |
|----------|--------|------------------------|
| KC & CXL | `cornea-kc-cxl.js` | Read cached data; **writes blocked** + banner |
| Keratitis | `cornea-keratitis.js` | Read cached data; **writes blocked** + banner |
| Dry eye, OR, eye bank, appointments | respective modules | *Planned — same pattern* |

Shared helper: `cornea-registry-online.js` (`CorneaRegistryOnline.requireCloudOnline`).

**Next milestone (M2.3):** document conflict resolution per registry in this file. **M2.4:** offline→reconnect integration test in Playwright.

