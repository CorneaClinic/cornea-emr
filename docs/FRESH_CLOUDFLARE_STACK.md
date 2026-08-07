# Fresh stack (experimental clinic — no DO data restore)

Patient/historical DO data is **out of scope**.

## Architecture (updated 2026-08-07)

```text
Browser → corneaclinic.visionemr.net (Workers Assets) ✅
       → https://cornea-emr-api-production.up.railway.app  ← Express API
              → Neon PostgreSQL ✅
              → R2 cornea-emr-media ✅
```

## Status

| Piece | Status |
|-------|--------|
| Clinic UI | Update `DEFAULT_API_BASE` → Railway URL, redeploy |
| Railway API | Domain live — confirm `/health/live` returns 200 |
| Neon | Migrated + admin seeded |
| R2 | Bucket ready |

Set Railway variable `APP_PUBLIC_URL=https://cornea-emr-api-production.up.railway.app` if not already.
