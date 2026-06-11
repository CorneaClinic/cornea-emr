# Private remote access (invite-only)

Give **specific people** access over the internet **without** opening the clinic to the world.

Both options below keep PostgreSQL off the internet. Staff still sign in to Cornea EMR with their own username and password.

---

## Choose an approach

| Approach | Best for | Public? |
|----------|----------|---------|
| **Tailscale** (recommended) | 1–10 trusted people (colleague, locum, IT) | No — only invited devices |
| **Cloudflare Tunnel + Access** | Browser-only access, email allowlist | No — blocked unless email is allowed |

Do **not** use plain port forwarding on your router without an access gate — that is effectively public.

---

## Option A — Tailscale (recommended)

Tailscale builds a **private encrypted network**. Only people you invite can reach your clinic PC.

### On the clinic PC

1. Install Tailscale:
   ```powershell
   winget install Tailscale.Tailscale
   ```
   Or: `scripts\install-tailscale.ps1`

2. Sign in and join your tailnet (use a clinic Google/Microsoft account or Tailscale login).

3. Start Cornea as usual (`start-clinic.bat` — API + UI server).

4. Expose the UI and API **only inside the tailnet**:
   ```powershell
   tailscale serve --bg http://127.0.0.1:8080
   tailscale serve --bg --service=api http://127.0.0.1:3000
   ```
   Or run: `scripts\setup-tailscale-serve.ps1`

5. Note your machine name in the Tailscale admin console, e.g. `clinic-pc.tailxxxxx.ts.net`.

### Invite the other person

1. Open [Tailscale admin → Users](https://login.tailscale.com/admin/users).
2. **Invite external user** → enter their email.
3. They install Tailscale on their laptop/phone and accept the invite.

### What they open

In their browser (while Tailscale is connected on their device):

```
https://clinic-pc.tailxxxxx.ts.net/Cornea.html
```

Cloud Sign In → API URL:

```
https://clinic-pc.tailxxxxx.ts.net:443   (UI serve URL)
```

For the API service, Tailscale shows the exact HTTPS URL in:

```powershell
tailscale serve status
```

Update `apps/api/.env` when using Tailscale HTTPS hostnames:

```env
CORS_ORIGIN=https://clinic-pc.tailxxxxx.ts.net,http://127.0.0.1:8080
APP_PUBLIC_URL=https://api.clinic-pc.tailxxxxx.ts.net
```

(Use the URLs from `tailscale serve status` — then restart the API task.)

### Remove access later

- Remove the user in Tailscale admin, or
- Run `tailscale serve reset` on the clinic PC.

---

## Option B — Cloudflare Tunnel + Access (email allowlist)

Use a domain on Cloudflare, but **block everyone** except named emails **before** they see Cornea.html.

1. Follow `docs/PUBLIC_INTERNET_ACCESS.md` to create the tunnel (hostnames + `.env`).
2. In [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Access** → **Applications**:
   - Add application: `clinic.yourdomain.com`
   - Policy: **Allow** → emails `colleague@example.com`, `you@clinic.com`
   - Default: **Block** all others
3. Optionally add the same policy for `api.yourdomain.com`.

Only allowlisted emails pass Cloudflare; everyone else gets a login wall. The clinic app login is still required afterward.

---

## Security checklist (invite-only)

- [ ] Invite only people who may see patient data (locum, partner clinic, IT).
- [ ] Give each person their **own** EMR account (not shared admin).
- [ ] Use strong passwords; disable accounts when access is no longer needed.
- [ ] Keep daily backups and off-site copies.
- [ ] Do **not** share admin credentials.

---

## What we do not recommend

| Method | Why |
|--------|-----|
| Router port forward to :8080 | Anyone on the internet can reach the login page |
| `cloudflared` quick tunnel + sharing URL | URL can leak; no allowlist |
| Disabling app authentication | Never |

---

## Related docs

- Local production setup: `PRODUCTION_DEPLOY.md`
- Public internet (open to world): `PUBLIC_INTERNET_ACCESS.md` — **not** what you want for invite-only access
