# Emergency: DigitalOcean locked → Cloudflare rebuild

**Date:** 2026-08-06  
**Status:** DigitalOcean team **locked**. **Decision (2026-08-06):** clinic was experimental only — **patient records do not matter**. Do **not** restore DO dumps; follow **[FRESH_CLOUDFLARE_STACK.md](./FRESH_CLOUDFLARE_STACK.md)** (empty Neon + R2 + Containers).

---

## Current reality (verified)

| Component | Status |
|-----------|--------|
| Clinic UI `corneaclinic.visionemr.net` | **Up** (Cloudflare Workers) |
| API `corneaclinic-2zfpt.ondigitalocean.app` | **Down** — DNS fails |
| DO account API | Reachable but `status: locked` |
| Spaces / Managed PG / Valkey | **Inaccessible** while locked |
| Local production dumps | **Ignored** for rebuild (experimental data) |

---

## Path forward (greenfield)

1. Create empty Postgres (Neon) → `CF_DATABASE_URL`
2. R2 bucket `cornea-emr-media` ✅ already created
3. Deploy `apps/api-cf` via **Deploy API (Cloudflare)** GitHub Action
4. Seed admin → deploy clinic (`DEFAULT_API_BASE` already points at workers.dev)

DO unlock is optional cleanup only — not required for EMR to come back.

For the older “rescue PHI from DO” plan, see git history of this file; it is no longer the active plan.

---

## What Cloudflare already covers vs what you must rebuild

| Already on Cloudflare | Must rebuild elsewhere |
|-----------------------|------------------------|
| Clinic static UI + edge Worker | Express API compute |
| DNS / WAF for clinic | PostgreSQL (patient source of truth) |
| R2 staging bucket | Redis (optional) |
| | Clinical media history (Spaces) |

---

## Data loss risk

- **Best case:** DO unlock → fresh dump → full restore.  
- **Likely interim:** Restore from local `backups/production` (may be days/weeks behind live).  
- **Devices:** Clinic PCs that used the app may still hold recent visits in IndexedDB; after new API is up, sync may push pending queues — treat carefully (conflicts).  
- **Media:** Without Spaces access, historical images may be missing until Spaces is exported or files re-uploaded.

---

## Do / don’t

- **Do** open DO support ticket first.  
- **Do** keep clinic Worker as-is (UI still loads).  
- **Do** restore Postgres from backup onto a new host before rewriting the app.  
- **Don’t** migrate EMR data to D1.  
- **Don’t** delete local `backups/` folders.  
- **Don’t** expect Spaces keys or App Platform console while locked.

---

## Immediate ask for the operator

Reply with which you want to execute next:

1. **Help draft DO support ticket** (billing unlock / data export).  
2. **Start Track B now** — restore latest local dump to a new Postgres and run API (local or Cloudflare Container).  
3. **Both** — ticket text + begin restore inventory.
