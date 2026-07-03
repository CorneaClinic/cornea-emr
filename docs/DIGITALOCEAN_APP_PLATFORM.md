# DigitalOcean App Platform deployment

Use this if you deploy via **Apps** (not a Droplet). The clinic UI stays on Cloudflare Workers; only the API + PostgreSQL run on DigitalOcean.

## Why your first deploy did not start

The build log showed:

- `no default process type` / `may not specify any way to start a node process`

DigitalOcean built the **repo root** (`package.json` with only Wrangler). The API lives in **`apps/api`** and must be the component source directory.

## Fix in the dashboard (existing app)

1. Open [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Select your app → **Settings** → **Components** → edit the **Web Service**
3. Set:

| Setting | Value |
|---------|--------|
| **Source directory** | `apps/api` |
| **Build command** | `npm install` |
| **Run command** | `node src/db/migrate-cli.js && node src/index.js` |
| **HTTP port** | `3000` |
| **Health check path** | `/health/live` |

4. **Resources** → **Create Database** → PostgreSQL 16 (if not added yet). Attach it to the web service so `DATABASE_URL` is injected.

5. **Settings** → **App-Level Environment Variables** (or component env):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Same as clinic PC `apps/api/.env` (SECRET) |
| `SECRETS_ENCRYPTION_KEY` | Same as clinic PC (SECRET) |
| `CORS_ORIGIN` | `https://corneaclinic.visionemr.net,http://127.0.0.1:8080` |
| `APP_PUBLIC_URL` | `https://api.visionemr.net` |
| `CLINIC_PUBLIC_URL` | `https://corneaclinic.visionemr.net` (password reset email links) |
| `AUTH_COOKIE_SECURE` | `true` |
| `AUTH_COOKIE_SAME_SITE` | `none` | Required for cross-origin cloud sign-in (clinic on Cloudflare, API on DO) |
| `AUTH_EXPOSE_REFRESH_IN_BODY` | `false` |

### Clinical image storage (required for photo sync)

Photo uploads use **DigitalOcean Spaces** (S3-compatible). Set these at **App level** (Settings → App-Level Environment Variables):

| Variable | Example | Notes |
|----------|---------|--------|
| `MEDIA_STORAGE_PROVIDER` | `s3` | Run time |
| `MEDIA_S3_BUCKET` | `corneaclinic-storage` | **Exact name** — a typo like `EDIA_S3_BUCKET` breaks uploads |
| `MEDIA_S3_ENDPOINT` | `https://sgp1.digitaloceanspaces.com` | Match your Spaces region |
| `MEDIA_S3_REGION` | `sgp1` | |
| `MEDIA_S3_ACCESS_KEY_ID` | (secret) | Spaces API key |
| `MEDIA_S3_SECRET_ACCESS_KEY` | (secret) | Spaces secret |
| `MEDIA_S3_FORCE_PATH_STYLE` | `false` | For DO Spaces |

Create the bucket in [Spaces](https://cloud.digitalocean.com/spaces) before first upload. If uploads fail with `MEDIA_S3_BUCKET is required`, run `scripts/fix-do-media-bucket-env.ps1` or fix the variable name in the dashboard.

### Rate limiting (G6 — Managed Valkey)

Shared rate-limit counters require **Managed Valkey** (Redis-compatible) in the **same region as Postgres** (`sgp1`).

**Automated (recommended):**

```powershell
# DIGITALOCEAN_API_TOKEN must be set (user env var)
npm run setup:do-valkey
```

This creates `cornea-emr-valkey` (if missing), allows the App Platform app as a trusted source, and sets `REDIS_URL` (secret) on the API.

**Manual:** Databases → Create → **Valkey** → `sgp1` → `db-s-1vcpu-1gb` → Trusted sources → add your App → copy `rediss://` URI → App env `REDIS_URL`.

After deploy, API logs should show: `Redis connected - shared rate limits active`.

Managed PostgreSQL on DigitalOcean uses SSL. The API auto-configures SSL for `*.ondigitalocean.com` hosts. If you still see `SELF_SIGNED_CERT_IN_CHAIN`, add:

| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Run time | No |

6. **Save** → **Deploy**

7. After deploy succeeds, open **Console** on the `api` component and run once:

```bash
node src/db/seed-cli.js
```

Save the printed admin password. Or restore a clinic PC dump (see [VPS_DEPLOY.md](VPS_DEPLOY.md) restore section — use `psql`/`pg_restore` against the managed DB connection string).

## Public URL

App Platform gives a URL like `https://cornea-emr-api-xxxxx.ondigitalocean.app`.

Either:

- **Cloudflare**: CNAME `api.visionemr.net` → that hostname (with SSL in Cloudflare), or
- **Custom domain** in App Platform → add `api.visionemr.net`

Update `APP_PUBLIC_URL` and clinic sign-in API URL to match.

Stop the clinic PC tunnel when the new API is live:

```powershell
Stop-ScheduledTask -TaskName 'CorneaEMR-CloudflareTunnel' -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName 'CorneaEMR-API' -ErrorAction SilentlyContinue
```

## App spec (automated)

The repo includes `.do/app.yaml`. To recreate the app from spec:

1. Apps → **Create App** → **GitHub** → `CorneaClinic/cornea-emr`
2. Choose **Edit your App Spec** and paste from `.do/app.yaml`
3. Set secret env vars in the UI before first deploy

## App Platform vs Droplet

| | App Platform | Droplet + Docker |
|--|--------------|------------------|
| Ops | Managed, simpler | You maintain the VM |
| Postgres | Managed DB addon | Container on same VM |
| Cost | App + DB monthly | Single Droplet |
| Guide | This file | [VPS_DEPLOY.md](VPS_DEPLOY.md) |

Both work. Use one path only — do not run API on both the Droplet and App Platform.
