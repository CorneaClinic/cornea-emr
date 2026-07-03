# Appointments & recall (Phase 4 P5)

Institute-wide day scheduling and a follow-up recall queue derived from visit follow-up dates.

## API endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/v1/appointments/day/:date` | `appointments:read` | Day schedule (`YYYY-MM-DD`) |
| `GET` | `/api/v1/appointments/recall-queue` | `appointments:read` | Due follow-ups + scheduled recalls |
| `GET` | `/api/v1/appointments/:id` | `appointments:read` | Single appointment |
| `POST` | `/api/v1/appointments` | `appointments:write` | Book appointment |
| `PATCH` | `/api/v1/appointments/:id` | `appointments:write` | Update status, time, etc. |
| `DELETE` | `/api/v1/appointments/:id` | `appointments:write` | Cancel (sets `status=cancelled`) |

### Recall queue query

| Param | Default | Notes |
|-------|---------|-------|
| `days` | `30` | Look ahead 1–180 days for due follow-ups |

**Due follow-ups** — visits with a `followups.follow_up_date` on or before `today + days` where the patient has no active appointment (`scheduled`, `confirmed`, `arrived`) on or after that due date.

**Scheduled recalls** — appointments with `appointment_type=recall` in the same window.

## Clinic UI

**Appointments** tab (roles with `appointments_recall` section):

1. **Day schedule** — date picker, book/edit modal, mark **Arrived**
2. **Recall queue** — patients due for follow-up; **Schedule** pre-fills a recall appointment
3. **OR schedule** — theatre day list (separate module; requires `or_scheduling`)

Requires cloud sign-in for server-backed schedule and recall queue. Local IndexedDB cache is read-only when offline; writes are blocked with the appointments offline banner (see `SYNC_ARCHITECTURE.md`).

## Appointment types & statuses

| Type | Use |
|------|-----|
| `visit` | Routine clinic visit |
| `recall` | Follow-up from recall queue |
| `procedure` | Procedure slot |
| `review` | Review / results visit |

| Status | Meaning |
|--------|---------|
| `scheduled` | Booked |
| `confirmed` | Patient confirmed |
| `arrived` | Checked in |
| `completed` | Visit done |
| `cancelled` | Cancelled |
| `no_show` | Did not attend |

## Roles

| Role | Appointments tab |
|------|------------------|
| Receptionist | Read + write |
| Nurse / optometrist / consultant | Read + write |
| Admin | Full access |

## Verification

- Unit: `apps/api/tests/appointments.test.js`
- E2E: `e2e/appointments.spec.js` (API CRUD, recall queue, UI smoke)
- Offline: `e2e/registry-offline.spec.js` (appointments panel)

## Production smoke

1. Sign in at [corneaclinic.visionemr.net/Cornea](https://corneaclinic.visionemr.net/Cornea)
2. **Appointments** → book a test slot for today
3. **Recall queue** → confirm due follow-ups appear (requires visits with follow-up dates)
4. Hard refresh after clinic deploy (`Ctrl+Shift+R`)

API deploy runs migration `020_appointments_recall.sql` automatically on DigitalOcean push to `main`.
