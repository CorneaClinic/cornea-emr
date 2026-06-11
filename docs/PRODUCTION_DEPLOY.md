# Production deployment guide

This guide covers running Cornea EMR on a dedicated clinic PC or a VPS with HTTPS, persistent API process, email password reset, and Docker.

## Checklist

| Item | Local clinic PC | VPS / cloud |
|------|-----------------|-------------|
| Strong secrets in `.env` | Required | Required |
| `NODE_ENV=production` | Required | Required |
| API as background service | Scheduled task (below) | Docker or systemd |
| HTTPS | Optional (Caddy) | Required (Caddy / nginx) |
| SMTP for password reset | Recommended | Required |
| Off-site encrypted backups | `scripts/backup-config.json` | Same + cloud bucket |
| Daily DB backup task | `CorneaEMR-DailyBackup` | cron / scheduled task |

---

## 1. Configure production environment

```powershell
cd cornea-emr\apps\api
copy .env.example .env
node ..\..\scripts\generate-secrets.js   # paste output into .env
```

Set at minimum:

```env
NODE_ENV=production
AUTH_COOKIE_SECURE=true
AUTH_EXPOSE_REFRESH_IN_BODY=false
APP_PUBLIC_URL=https://api.local          # or your public API URL
CORS_ORIGIN=https://clinic.local          # comma-separated clinic UI origins
```

### SMTP (password reset emails)

Without SMTP, reset tokens are created but **no email is sent** (logged as a warning).

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configure-smtp-outlook.ps1
cd apps\api
npm run test:smtp -- your-email@outlook.com
```

Or set manually in `apps/api/.env`:

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password
SMTP_FROM="Cornea Clinic <your-email@outlook.com>"
```

### One-time admin setup (hosts, Caddy trust, scheduled tasks)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-production-admin.ps1
```

Approve the UAC prompt when it appears.

---

## 2. Run API as a background service (Windows)

**One-time registration** — starts the API at every logon in production mode:

```powershell
powershell -ExecutionPolicy Bypass -File cornea-emr\scripts\install-api-service.ps1
```

Manual control:

```powershell
Start-ScheduledTask -TaskName 'CorneaEMR-API'
Stop-ScheduledTask  -TaskName 'CorneaEMR-API'
```

The task runs `scripts/run-production-api.ps1` (`node src/index.js`, no file watcher).

---

## 3. HTTPS with Caddy (optional, recommended)

```powershell
winget install CaddyServer.Caddy
```

Add to `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 clinic.local api.local
```

Trust Caddy's local CA (once):

```powershell
caddy trust
```

Start the proxy:

```powershell
powershell -ExecutionPolicy Bypass -File cornea-emr\scripts\start-caddy.ps1
```

| URL | Backend |
|-----|---------|
| https://clinic.local | Clinic UI (:8080) |
| https://api.local | API (:3000) |

Update `.env` and sign in via Cloud with API URL `https://api.local`.

---

## 4. One-click production startup

Double-click `cornea-emr/start-production.bat` — starts the production API, clinic UI server, and opens the browser.

For daily use after installing the scheduled task, only the clinic UI server is needed (`Cornea Clinic file/start-clinic.bat`).

---

## 5. Docker (VPS)

```powershell
cd cornea-emr\infra
copy .env.example .env
# fill POSTGRES_PASSWORD, JWT_SECRET, SECRETS_ENCRYPTION_KEY, CORS_ORIGIN, APP_PUBLIC_URL

docker compose -f docker-compose.prod.yml up -d --build
```

Production compose differences:

- `NODE_ENV=production`
- Postgres **not** exposed to the host
- Migrations run automatically on API start
- Refresh tokens in httpOnly cookies only (`AUTH_EXPOSE_REFRESH_IN_BODY=false`)

Seed once:

```powershell
docker compose -f docker-compose.prod.yml exec api node src/db/seed-cli.js
```

---

## 6. Backups

Local + optional off-site encrypted copies — see [README](../README.md#backups).

Set `offsiteDir` in `scripts/backup-config.json` and keep `backup-encryption.key` somewhere safe.

---

## 7. CI and tests

```powershell
cd apps\api
npm test              # unit tests (password policy, health/live)
npm run verify:sync   # full sync E2E against running API
npm run verify:api    # live API + ICD checks
```

GitHub Actions (`.github/workflows/ci.yml`) runs migrations, unit tests, and E2E sync on push/PR.

---

## 8. Security reminders

- Never commit `.env`, `backup-encryption.key`, or `backups/*.dump`
- Rotate `JWT_SECRET` only with a planned session logout (invalidates all tokens)
- Use explicit `CORS_ORIGIN` — never `*` in production
- Place the API behind HTTPS before exposing beyond localhost
- Keep PostgreSQL off the public internet (Docker prod compose does this by default)
