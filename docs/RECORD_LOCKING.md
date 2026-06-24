# Multi-Clinician Record Locking (Project 8)

Prevents two clinicians from editing the same cloud-synced visit at the same time. Locks expire after **5 minutes** and renew automatically while the edit modal is open.

## API (`/api/v1/record-locks`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/acquire` | Check out a record (`entityType`, `entityId`, optional `force`) |
| `POST` | `/renew` | Extend lock TTL (heartbeat every 90s from clinic) |
| `POST` | `/release` | Release on close/save |
| `GET` | `/active?entityType=visit` | List active locks for the clinic |
| `GET` | `/:entityType/:entityId` | Lock status for one entity |

**Entity types:** `visit`, `kp_patient`, `kp_tissue`

**409 Conflict** — another user holds the lock; response includes `lock.lockedByName`.

## Clinic behaviour

1. **Edit** — opening a synced visit calls `acquire`. Banner shows “You have this record checked out.”
2. **Conflict** — if locked by someone else: **Cancel**, **View read-only**, or **Take over editing** (force acquire).
3. **Save** — compares local `revision` with `GET /api/v1/visits/:uuid` before save; warns if the cloud copy is newer.
4. **Close** — releases the lock automatically.
5. **Records list** — orange lock icon when another user is editing that visit.

## Database

Migration `018_record_edit_locks.sql` — table `record_edit_locks` with unique `(clinic_id, entity_type, entity_id)`.

## Permissions

Acquire/renew require `visits:write` or `kp:write`. Release also allowed with `kp:read`. List/read require `visits:read`.
