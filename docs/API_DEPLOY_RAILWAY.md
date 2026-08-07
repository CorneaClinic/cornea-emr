# Deploy API without Cloudflare Containers

Cloudflare **Containers** need Workers Paid (blocked by payment).  
Keep **clinic UI** on Cloudflare Workers (free). Host the **Express API** elsewhere.

Neon Postgres + R2 media already work — only the Node process moves.

## Recommended: Railway

Best fit: Docker, always-on, GitHub deploy, HTTPS URL, external Neon/R2.

### One-time setup

1. Sign up: https://railway.app (GitHub login as CorneaClinic / visionemr).
2. **New Project** → **Deploy from GitHub** → `CorneaClinic/cornea-emr`.
3. Set **Root Directory** to `apps/api` (uses `Dockerfile` + `railway.toml`).
4. **Variables** (Settings → Variables):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | Neon URL (`sslmode=require`) — already migrated + seeded |
| `JWT_SECRET` | same as GitHub `CF_JWT_SECRET` / Worker secret |
| `SECRETS_ENCRYPTION_KEY` | same as `CF_SECRETS_ENCRYPTION_KEY` |
| `CORS_ORIGIN` | `https://corneaclinic.visionemr.net,http://127.0.0.1:8080` |
| `CLINIC_PUBLIC_URL` | `https://corneaclinic.visionemr.net` |
| `APP_PUBLIC_URL` | your Railway public URL (set after first deploy) |
| `AUTH_COOKIE_SECURE` | `true` |
| `AUTH_COOKIE_SAME_SITE` | `none` |
| `DB_CONNECTION_TIMEOUT_MS` | `90000` |
| `MEDIA_STORAGE_PROVIDER` | `s3` |
| `MEDIA_S3_BUCKET` | `cornea-emr-media` |
| `MEDIA_S3_ENDPOINT` | `https://f2c41820d69631f2365f03a76922e190.r2.cloudflarestorage.com` |
| `MEDIA_S3_REGION` | `auto` |
| `MEDIA_S3_FORCE_PATH_STYLE` | `true` |
| `MEDIA_S3_ACCESS_KEY_ID` | R2 API token (when ready) |
| `MEDIA_S3_SECRET_ACCESS_KEY` | R2 secret |

5. Generate a public domain: Settings → Networking → **Generate Domain**.
6. Set `APP_PUBLIC_URL` to that `https://….up.railway.app` URL and redeploy.
7. Smoke: `https://YOUR-URL/health/live` → expect JSON/ok.
8. Tell the agent the URL — we update clinic `DEFAULT_API_BASE` + CSP and `npm run deploy:clinic`.

Optional: Cloudflare DNS `api.visionemr.net` CNAME → Railway hostname, then use that as `APP_PUBLIC_URL` / clinic default.

### GitHub auto-deploy (optional)

Create a Railway project token + service ID, then set repo secrets:

- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_ID`

Workflow: `.github/workflows/deploy-api-railway.yml`.

---

## Alternative: Render

Blueprint: `render.yaml` at repo root.

- Connect GitHub → New Blueprint → select this repo.
- Fill `DATABASE_URL`, `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `APP_PUBLIC_URL` (after first URL is assigned).
- Use **Starter** (or higher). Free tier **sleeps** — bad for clinic sync/long-poll.

---

## Alternative: Fly.io / cheap VPS

- **Fly.io**: `fly launch` from `apps/api` (Dockerfile). Good if you already use Fly.
- **VPS**: existing guide `docs/VPS_DEPLOY.md` (Hetzner etc.) + Cloudflare Tunnel to `api.visionemr.net`.

---

## What stays on Cloudflare (no Paid Containers)

| Piece | Status |
|-------|--------|
| Clinic UI Workers Assets | Keep |
| R2 `cornea-emr-media` | Keep |
| DNS / WAF for `visionemr.net` | Keep |
| `apps/api-cf` Containers gateway | **Paused** until Paid works |

---

## Already done (reuse)

- Neon DB: schema migrated (29 files), admin seeded (`visionemr.somtec@gmail.com`)
- JWT / encryption secrets exist in GitHub + Cloudflare Worker (copy into Railway vars)
- Clinic code points at dead/incomplete workers.dev API — **update after Railway URL exists**
