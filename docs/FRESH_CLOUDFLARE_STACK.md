# Fresh Cloudflare stack (experimental clinic — no DO data restore)

Patient/historical DO data is **out of scope**. Build empty EMR on Cloudflare.

## Target architecture

```text
Browser → corneaclinic.visionemr.net (Workers Assets) ✅ already live
       → cornea-emr-api.*.workers.dev (Worker → Container Express)  ← new
              → Neon (or other) PostgreSQL  ← new empty DB + migrations + seed
              → R2 bucket cornea-emr-media  ✅ created
```

## Done in repo

- [x] R2 bucket `cornea-emr-media` (+ staging bucket)
- [x] `apps/api-cf` — Container gateway Worker
- [x] GitHub Action `.github/workflows/deploy-api-cloudflare.yml` (builds with Docker in CI)
- [x] Clinic defaults / CSP updated to Cloudflare API hostname

## Your steps (in order)

### 1) Create empty Postgres (Neon free is fine)

1. https://console.neon.tech → New project → copy connection string (`sslmode=require`).
2. Store as GitHub secret `CF_DATABASE_URL` (and locally for seed).

Cloudflare does **not** host Postgres; Neon + optional Hyperdrive later is the supported pattern. **Do not use D1.**

### 2) Create R2 API token (media)

Dashboard → R2 → Manage API Tokens → Object Read & Write scoped to `cornea-emr-media`.  
Secrets: `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`.

### 3) Generate app secrets

```powershell
# 32+ char random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set GitHub secrets:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Workers + Containers deploy |
| `CLOUDFLARE_ACCOUNT_ID` | `f2c41820d69631f2365f03a76922e190` |
| `CF_DATABASE_URL` | Neon URL |
| `CF_JWT_SECRET` | JWT signing |
| `CF_SECRETS_ENCRYPTION_KEY` | App crypto |
| `CF_R2_ACCESS_KEY_ID` | R2 S3 key |
| `CF_R2_SECRET_ACCESS_KEY` | R2 S3 secret |
| `CF_SEED_ADMIN_EMAIL` | First admin email |
| `CF_SEED_ADMIN_PASSWORD` | First admin password (strong) |

### 4) Deploy API via GitHub Actions

Actions → **Deploy API (Cloudflare)** → Run workflow  
(or push changes under `apps/api/**` / `apps/api-cf/**`).

Confirm: `https://cornea-emr-api.visionemr-somtec.workers.dev/health/live`

### 5) Seed admin (first boot)

Container entrypoint already runs migrations. Seed once:

```powershell
# After API is healthy — use wrangler containers ssh OR run seed against Neon locally:
cd apps/api
$env:DATABASE_URL = "<neon url>"
$env:SEED_ADMIN_EMAIL = "admin@..."
$env:SEED_ADMIN_PASSWORD = "..."
$env:ALLOW_PRODUCTION_SEED = "true"
npm run seed
```

### 6) Deploy clinic UI

```powershell
npm run deploy:clinic
```

Sign in at https://corneaclinic.visionemr.net/Cornea with the seeded admin.  
Clear old `localStorage` API base if the login modal still shows DigitalOcean.

### 7) Optional DNS

Cloudflare DNS: `api.visionemr.net` → Worker `cornea-emr-api` (custom domain).  
Then update `APP_PUBLIC_URL` / clinic defaults to that hostname.

## Local prerequisites

- **Docker Desktop** required only for *local* `wrangler deploy` of Containers. CI provides Docker.
- No DigitalOcean account needed for this path.

## DigitalOcean

Account is locked — ignore for this rebuild. Cancel/close later after Cloudflare stack is stable.
