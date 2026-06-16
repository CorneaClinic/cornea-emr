# VPS deployment — 24/7 API without the clinic PC

Run **PostgreSQL + API** on a cloud VPS so `https://api.visionemr.net` stays online when the clinic computer is off. The clinic UI stays on **Cloudflare Workers** (`https://corneaclinic.visionemr.net`).

## Architecture

```
Browser  →  corneaclinic.visionemr.net  (Cloudflare Workers — static UI)
         →  api.visionemr.net            (Cloudflare Tunnel or Caddy on VPS → Docker API → Postgres)
Clinic PC (optional)  →  start-clinic.bat for local offline use only
```

| Component | Where it runs |
|-----------|----------------|
| Clinic UI | Cloudflare Workers (already deployed) |
| API + PostgreSQL | Ubuntu VPS (this guide) |
| Cloudflare Tunnel | VPS (recommended) **or** Caddy + Let's Encrypt |
| Clinic PC | Optional — local offline EMR only |

**Minimum VPS:** 2 vCPU, 2 GB RAM, 40 GB SSD (e.g. Hetzner CX22, DigitalOcean Basic, Linode Nanode).

---

## Part A — Prepare on the clinic PC (one time)

### 1. Export the current database

```powershell
cd cornea-emr
powershell -ExecutionPolicy Bypass -File scripts\export-db-for-vps.ps1
```

This creates `backups/vps-migration_<timestamp>.dump`. Copy it to the VPS (SCP, SFTP, or cloud storage).

### 2. Generate production secrets (if not already done)

```powershell
cd apps\api
node ..\..\scripts\generate-secrets.js
```

Save the output — you will paste `JWT_SECRET` and `SECRETS_ENCRYPTION_KEY` into the VPS `infra/.env`.

**Important:** If you migrate an existing database, keep the **same** `JWT_SECRET` and `SECRETS_ENCRYPTION_KEY` from the clinic PC `apps/api/.env` so existing sessions and encrypted fields remain valid.

---

## Part B — Set up the VPS (Ubuntu 22.04 / 24.04)

SSH into the VPS as root or a sudo user.

### 1. Bootstrap Docker and clone the repo

```bash
curl -fsSL https://raw.githubusercontent.com/CorneaClinic/cornea-emr/main/scripts/vps/bootstrap-ubuntu.sh | bash
# Or, after cloning:
git clone https://github.com/CorneaClinic/cornea-emr.git
cd cornea-emr
bash scripts/vps/bootstrap-ubuntu.sh
```

### 2. Configure environment

```bash
cd infra
cp .env.example .env
nano .env
```

Set at minimum:

```env
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<same-as-clinic-pc-or-new-from-generate-secrets.js>
SECRETS_ENCRYPTION_KEY=<same-as-clinic-pc-or-new>
CORS_ORIGIN=https://corneaclinic.visionemr.net,http://127.0.0.1:8080
APP_PUBLIC_URL=https://api.visionemr.net
AUTH_COOKIE_SECURE=true
API_PORT=3000

# SMTP — required for password reset emails
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password
SMTP_FROM=Cornea Clinic <your-email@outlook.com>
```

### 3. Start API + PostgreSQL

```bash
cd ~/cornea-emr/infra
docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api   # wait for "listening"
curl -s http://127.0.0.1:3000/health/live
```

### 4. Restore clinic data (migrate from PC)

Copy the `.dump` file to the VPS, then:

```bash
bash ~/cornea-emr/scripts/vps/restore-backup-on-vps.sh ~/vps-migration_2026-06-16.dump
```

**Or** seed a fresh clinic (empty database):

```bash
docker compose -f docker-compose.prod.yml exec api node src/db/seed-cli.js
# Save the printed admin password immediately.
```

---

## Part C — Expose `api.visionemr.net` (pick one)

### Option 1 — Cloudflare Tunnel on VPS (recommended)

Same pattern as the clinic PC, but the tunnel runs on the VPS 24/7.

```bash
# On VPS
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel login
bash ~/cornea-emr/scripts/vps/setup-api-tunnel.sh api.visionemr.net
sudo systemctl enable --now cornea-emr-tunnel
```

Then **on the clinic PC**, stop the old tunnel so DNS is not split:

```powershell
Stop-ScheduledTask -TaskName 'CorneaEMR-CloudflareTunnel'
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
```

Test: `curl https://api.visionemr.net/health/live`

### Option 2 — Caddy + public IP (no cloudflared on VPS)

1. Cloudflare DNS: `api` → A record → VPS public IP (grey cloud / DNS only for Let's Encrypt, or use Cloudflare origin cert).
2. Open firewall: `sudo ufw allow 80,443/tcp`
3. Install Caddy and use `infra/Caddyfile.vps` (see file comments).

---

## Part D — Verify end-to-end

```bash
curl https://api.visionemr.net/health/ready
```

From a browser:

1. Open `https://corneaclinic.visionemr.net`
2. Cloud Sign In → API URL `https://api.visionemr.net`
3. Sign in with your clinic admin email/password

---

## Part E — Decommission clinic PC as server (optional)

Once the VPS is stable:

| Task | Command |
|------|---------|
| Stop API on PC | `Stop-ScheduledTask -TaskName 'CorneaEMR-API'` |
| Stop tunnel on PC | `Stop-ScheduledTask -TaskName 'CorneaEMR-CloudflareTunnel'` |
| Keep local EMR | Still use `apps/clinic/start-clinic.bat` for offline work |

The clinic PC can stay off; cloud sign-in uses the VPS only.

---

## Backups on VPS

Daily cron (edit `crontab -e`):

```cron
0 2 * * * cd /home/ubuntu/cornea-emr/infra && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U cornea -Fc cornea_emr_v1 > /var/backups/cornea_$(date +\%F).dump
```

Copy dumps off the VPS (S3, Backblaze, another region).

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `530` / error 1033 on API | Tunnel not running on VPS: `sudo systemctl status cornea-emr-tunnel` |
| CORS error in browser | `CORS_ORIGIN` must include `https://corneaclinic.visionemr.net` |
| Login works locally, not public | `APP_PUBLIC_URL=https://api.visionemr.net`, cookies secure |
| Empty patients after migrate | Re-run restore script; confirm dump file is custom format (`pg_restore`) |
| Invalid credentials after migrate | Use same DB users as before; reset with `docker compose exec api node src/db/reset-admin-password-cli.js` |

---

## Security checklist

- [ ] Strong `POSTGRES_PASSWORD`, `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`
- [ ] PostgreSQL **not** exposed to the internet (Docker prod compose default)
- [ ] API only on `127.0.0.1:3000` when using Cloudflare Tunnel (`docker-compose.vps.yml`)
- [ ] SMTP configured for password reset
- [ ] Daily encrypted off-site backups
- [ ] SSH key login only; disable password auth on VPS
- [ ] Consider Cloudflare Access in front of the clinic UI for extra login layer

See also: [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md), [PUBLIC_INTERNET_ACCESS.md](PUBLIC_INTERNET_ACCESS.md).
