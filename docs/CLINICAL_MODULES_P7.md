# Clinical modules — Phase 4 P7

Dry eye / OSD registry, OR theatre scheduling, and ectasia AI v2 topography modifiers.

## Dry eye / OSD registry

### API (`/api/v1/dry-eye-registry`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/overview` | `dry_eye:read` | Case counts + mean OSD index |
| `GET` | `/` | `dry_eye:read` | Paginated case list |
| `GET` | `/:id` | `dry_eye:read` | Case + assessment history |
| `POST` | `/` | `dry_eye:write` | Enrol case (`DE-####` ID) |
| `POST` | `/:id/assessments` | `dry_eye:write` | Add visit assessment |

**OSD index** — computed server-side from TBUT, Schirmer, OSDI, DEQ-5, MGD grade, blepharitis, and severity. Mapped to Normal / Mild / Moderate / Severe.

### Clinic UI

**Dry Eye / OSD** tab — case register, assessments, offline guard (see `registry-offline.spec.js`).

Migration: `021_dry_eye_osd.sql`

---

## OR theatre schedule

### API (`/api/v1/or-schedule`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/procedure-types` | `or_schedule:read` | PK, DALK, DMEK, CXL, etc. |
| `GET` | `/day/:date` | `or_schedule:read` | Day list (`YYYY-MM-DD`) |
| `GET` | `/:id` | `or_schedule:read` | Single case |
| `POST` | `/` | `or_schedule:write` | Schedule case (`OR-####`) |
| `PATCH` | `/:id` | `or_schedule:write` | Update status, time, theatre |

### Clinic UI

**Appointments** tab → **OR schedule** sub-panel — day list, schedule case modal, offline banner.

Migration: `022_or_schedule.sql`

---

## Ectasia AI v2

### API (`/api/v1/ectasia-ai`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Topography risk + procedure ranking |
| `GET` | `/registry-insights` | Institute KC/CXL stats for ranking context |

Pass `useV2: true` or `modelVersion` containing `v2` to enable **v2 modifiers**:

- ABCD grade (A–D)
- ISV / IHA / ART biomechanical indices
- Young age + dry eye surface flags

Returns `modelVersion: ectasia-v2-topography` with `v2Enhancements` factor list.

Clinic: KC registry / laser screening UI uses v2 when selected (`cornea-ectasia-ai.js`).

---

## Verification

| Module | Unit tests | E2E |
|--------|------------|-----|
| Dry eye OSD | `p7-clinical-modules.test.js` | `p7-clinical-modules.spec.js` |
| OR schedule | sync-matrix REST checks | `p7-clinical-modules.spec.js` |
| Ectasia v2 | `p7-clinical-modules.test.js` | `p7-clinical-modules.spec.js` |

Offline policy: dry eye writes blocked offline (`e2e/registry-offline.spec.js`).

## Production smoke

1. **Dry Eye / OSD** → enrol test case → add assessment → confirm OSD index
2. **Appointments → OR schedule** → book PK case for today
3. **KC / laser screening** → run ectasia analysis with v2 enabled

API deploy runs migrations `021` and `022` on DigitalOcean push to `main`. Clinic: `npm run deploy:clinic` after UI changes.
