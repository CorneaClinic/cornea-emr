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

Cloudflare Containers need **Workers Paid** (payment blocked). Host the API on **Railway** (or Render/VPS) instead — see [API_DEPLOY_RAILWAY.md](./API_DEPLOY_RAILWAY.md).

1. Neon Postgres ✅ empty schema + admin seed  
2. R2 bucket `cornea-emr-media` ✅  
3. Deploy Express API on Railway from `apps/api`  
4. Point clinic `DEFAULT_API_BASE` at Railway URL → `npm run deploy:clinic`

DO unlock / CF Paid are optional later.

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
