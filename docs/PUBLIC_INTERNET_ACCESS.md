# Public internet access (Cornea Clinic)

This guide exposes **Cornea.html** and the API on the public internet using **Cloudflare Tunnel** — no router port forwarding, automatic HTTPS.

## Important — read first

Cornea EMR stores **patient health data**. Putting it on the public internet means:

- Anyone can **find and attempt to log in** to your login page.
- You are responsible for **privacy and security** (access control, backups, breach response).
- Use **strong unique passwords** for every staff account; never share admin credentials.
- Prefer **Cloudflare Access** (extra login before the app) for small clinics — see below.
- Do **not** expose PostgreSQL (port 5432) to the internet — the tunnel only forwards UI + API.

Recommended minimum before going public:

1. All staff accounts have strong passwords.
2. `NODE_ENV=production` with secure cookies (already set).
3. Gmail SMTP configured for password reset.
4. Daily backups + off-site copy.
5. A domain you control (e.g. `clinic.yourdomain.com`).

---

## What you need

| Item | Example |
|------|---------|
| Domain name | `yourclinic.com` (from Namecheap, Google Domains, etc.) |
| Cloudflare account | Free — [dash.cloudflare.com](https://dash.cloudflare.com) |
| Domain DNS on Cloudflare | Point nameservers to Cloudflare |

You will create two hostnames:

| Hostname | Forwards to |
|----------|-------------|
| `clinic.yourdomain.com` | Clinic UI (`127.0.0.1:8080`) |
| `api.yourdomain.com` | API (`127.0.0.1:3000`) |

---

## Quick setup (Windows)

### 1. Install cloudflared

```powershell
winget install Cloudflare.cloudflared
```

Or run: `scripts\install-cloudflared.ps1`

### 2. Log in to Cloudflare

```powershell
cloudflared tunnel login
```

Complete the browser prompt (pick your domain).

### 3. Create the tunnel

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-cloudflare-tunnel.ps1
```

Enter your public hostnames when asked. The script:

- Creates a Cloudflare tunnel + DNS records
- Writes `infra\cloudflared-config.yml`
- Updates `apps\api\.env` (`CORS_ORIGIN`, `APP_PUBLIC_URL`)
- Updates the clinic UI default API URL

### 4. Install tunnel as a background service

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-cloudflare-tunnel-service.ps1
```

### 5. Start everything

Double-click `Cornea Clinic file\start-clinic.bat` (UI server + API + Caddy optional).

The tunnel service runs at logon and keeps public URLs live.

### 6. Open in browser (worldwide)

```
https://clinic.yourdomain.com/Cornea.html
```

Cloud Sign In should default to `https://api.yourdomain.com` after setup.

---

## Optional: Cloudflare Access (recommended)

Add an email OTP or SSO gate **before** the clinic app:

1. Cloudflare Zero Trust → Access → Applications
2. Add application for `clinic.yourdomain.com`
3. Policy: allow only your clinic staff emails

---

## Temporary demo URL (no domain)

For a **short test only** (URL changes each run):

```powershell
cloudflared tunnel --url http://127.0.0.1:8080
```

Use a **second terminal** for the API:

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Update `CORS_ORIGIN` and `APP_PUBLIC_URL` in `.env` to match the two `*.trycloudflare.com` URLs, restart the API, then sign in via Cloud with the API URL.

Not suitable for production — URLs rotate and there is no access control beyond app login.

---

## VPS alternative

For 24/7 uptime without keeping a clinic PC online, deploy to a VPS with `infra/docker-compose.prod.yml` and a reverse proxy. See `docs/PRODUCTION_DEPLOY.md`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error in browser | `CORS_ORIGIN` must include exact `https://clinic...` origin |
| Login works locally but not public | Set `APP_PUBLIC_URL` to public API URL; restart API task |
| 502 Bad Gateway | Start clinic UI (`node clinic-server.js`) and API on this PC |
| Cookies not set | `AUTH_COOKIE_SECURE=true` requires HTTPS (Cloudflare provides this) |
