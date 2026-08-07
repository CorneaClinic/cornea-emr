# Fresh stack (experimental clinic — no DO data restore)

Patient/historical DO data is **out of scope**.

## Architecture (updated 2026-08-07)

Cloudflare **Containers** require Workers Paid — **blocked by payment**. Use an external API host instead.

```text
Browser → corneaclinic.visionemr.net (Workers Assets) ✅ keep
       → Railway / Render / VPS Express API          ← NEW (see API_DEPLOY_RAILWAY.md)
              → Neon PostgreSQL                        ✅ migrated + seeded
              → R2 bucket cornea-emr-media             ✅ created
```

## Status

| Piece | Status |
|-------|--------|
| Clinic UI on Cloudflare | Live |
| Neon DB | Migrated + admin seeded |
| R2 media bucket | Created (needs S3 API token for uploads) |
| Cloudflare Containers API | **Paused** (needs Paid plan) |
| Railway / Render API | **Next** — [API_DEPLOY_RAILWAY.md](./API_DEPLOY_RAILWAY.md) |

## Your next step

1. Create a [Railway](https://railway.app) project from GitHub (`apps/api` root).
2. Paste env vars from [API_DEPLOY_RAILWAY.md](./API_DEPLOY_RAILWAY.md) (reuse Neon URL + JWT secrets).
3. Generate public domain → send the URL so we point the clinic UI at it.
