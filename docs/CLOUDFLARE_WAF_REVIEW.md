# Cloudflare WAF review — Cornea Clinic EMR

**Date:** July 2026 · **ASVS:** 9.1.3 · **Mode:** Stabilization (vendor postponed)

---

## Architecture (two surfaces)

| Surface | Hostname | Edge | Who configures WAF |
|---------|----------|------|-------------------|
| **Clinic UI** | `corneaclinic.visionemr.net` | Cloudflare Workers (`cornea-emr`) | **You** — `visionemr.net` zone |
| **API** | `corneaclinic-2zfpt.ondigitalocean.app` | Cloudflare proxy (DO App Platform) | **DigitalOcean** — limited custom rules |
| **API defense (today)** | same | App Redis rate limits + Helmet + CORS | `apps/api` (G6 PASS) |

The clinic SPA is fully under your Cloudflare account. The API hostname is proxied by Cloudflare but managed by DigitalOcean — **app-level rate limiting is your primary API control** unless you add a custom API domain on your zone.

---

## External probe (automated)

```powershell
npm run check:cloudflare-waf
```

**Probe results (Jul 2026):**

| Check | Clinic UI | API |
|-------|-----------|-----|
| `Server: cloudflare` | Yes | Yes |
| `CF-RAY` present | Yes | Yes |
| TLS (HTTPS) | Yes | Yes |
| Helmet security headers | N/A (static HTML) | Yes (`csp`, `hsts`, `x-frame-options`, …) |
| App rate limits | N/A | Yes — `GET /health` → `checks.redis.mode=redis` |

---

## Part A — Clinic zone (`visionemr.net`)

Open [Cloudflare Dashboard](https://dash.cloudflare.com) → **visionemr.net** → complete each item.

### A1. SSL/TLS

| Setting | Path | Recommended |
|---------|------|-------------|
| Encryption mode | SSL/TLS → Overview | **Full (strict)** if any origin exists; Workers use CF edge certs automatically |
| Always Use HTTPS | SSL/TLS → Edge Certificates | **On** |
| Minimum TLS | SSL/TLS → Edge Certificates | **1.2** or higher |
| HSTS | SSL/TLS → Edge Certificates | Enable after confirming HTTPS works everywhere (include subdomains) |

### A2. Bot and DDoS

| Setting | Path | Recommended | Notes |
|---------|------|-------------|-------|
| Security Level | Security → Settings | **Medium** | Raise to High only if false positives are acceptable |
| Bot Fight Mode | Security → Bots | **On** | May challenge datacenter IPs (GitHub Actions curl); staging E2E uses Playwright (real browser) |
| Super Bot Fight Mode | Security → Bots | **Off** unless on Pro+ and tested | Can block legitimate automation |
| DDoS | Automatic | Leave managed rules on | Default L3/L7 protection |

### A3. WAF managed rules (zone)

> **Can't see "WAF" in Security?** See [Troubleshooting — no WAF menu](#troubleshooting--no-waf-menu) below.

| Setting | Path (old dashboard) | Path (new dashboard) | Free plan |
|---------|----------------------|------------------------|-----------|
| Cloudflare managed rules | Security → WAF → Managed rules | **Security** → **Settings** → filter *Web application exploits* → **Cloudflare managed ruleset** | **On by default** (Free Managed Ruleset) |
| OWASP Core | Security → WAF → Managed rules | Security → Settings → **OWASP Core** | Often **Pro+ only** — skip if unavailable |
| Custom rules (5 max) | Security → WAF → Custom rules | **Security** → **Security rules** → **Custom rules** | Available on Free |

**Free plan:** Basic WAF is often **already active** — Cloudflare deploys the Free Managed Ruleset automatically. OWASP Core is not required for stabilization.

**Scope:** applies to hostnames on the `visionemr.net` zone (including `corneaclinic.visionemr.net`).

### A4. Rate limiting (clinic — optional)

Static assets rarely need aggressive limits. If you see scraping:

| Rule | Expression | Action |
|------|------------|--------|
| Clinic path flood | `(http.host eq "corneaclinic.visionemr.net" and http.request.uri.path contains "/Cornea")` | Rate limit 600 req / 1 min / IP → Block |

### A5. Workers (`cornea-emr`)

Dashboard → **Workers & Pages** → `cornea-emr`:

| Item | Check |
|------|-------|
| Custom domain | `corneaclinic.visionemr.net` attached |
| Routes | `/Cornea*` → worker |
| Compatibility date | Matches `wrangler.toml` (`2024-06-01`) |

Optional **Transform Rules** → Modify response header (zone):

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

(Content-Security-Policy for the SPA is complex due to CDN scripts — tune separately if needed.)

### A6. Verify clinic after changes

1. Open https://corneaclinic.visionemr.net/Cornea?cloud=1 — sign in works
2. `npm run check:cloudflare-waf` — clinic checks pass
3. GitHub **E2E Nightly** — staging smoke still green (Bot Fight can block headless if misconfigured)

---

## Part B — API (`corneaclinic-2zfpt.ondigitalocean.app`)

You **cannot** apply custom Cloudflare WAF rules to `*.ondigitalocean.app` in your dashboard. Controls in place:

| Control | Status |
|---------|--------|
| TLS | Active (via CF + DO) |
| Helmet headers | Active |
| Login rate limit | 20/IP + 10/email per 15 min |
| Global API limit | 300 req/min/IP |
| Redis shared store | G6 — verify `npm run health:production` |
| CORS allowlist | Clinic origin only |
| Sync batch limit | Max 100 mutations per push |

### B1. Optional upgrade — custom API domain (future)

For full WAF on the API under **your** zone:

1. Create `api.corneaclinic.visionemr.net` (or `corneaclinic-api.visionemr.net`)
2. DigitalOcean App Platform → add custom domain → CNAME target
3. Cloudflare DNS → proxied (orange cloud) record
4. Add WAF rate rule:

```
(http.host eq "api.corneaclinic.visionemr.net" and http.request.uri.path eq "/api/v1/auth/login")
```

Action: **Block** when rate > **30 requests / 1 minute** per IP.

5. Update clinic `CORS_ORIGIN` and cloud sign-in API URL on DO
6. Re-run `npm run check:production-operator`

**Not required for stabilization** — document as Wave 3 optional.

---

## Part C — Monitoring

| Signal | Where |
|--------|-------|
| WAF events | Cloudflare → Security → Events |
| Blocked requests spike | Security → Analytics |
| API abuse | DO App Platform logs + `audit_logs` / failed login counts |
| Health | `npm run health:production` hourly (GitHub) |

---

## Sign-off checklist

**Signed off:** 2026-07-03 · **Status:** Complete (Free plan baseline)

| # | Item | Done | Date | Evidence |
|---|------|------|------|----------|
| 1 | `npm run check:cloudflare-waf` pass | Yes | 2026-07-03 | 6/6 automated checks green |
| 2 | A1 SSL/TLS reviewed | Yes | 2026-07-03 | HTTPS confirmed by probe |
| 3 | A2 Bot Fight Mode on (clinic zone) | Yes | 2026-07-03 | Dashboard screenshot — JS Detections ON |
| 4 | A3 WAF managed rules deployed | Yes | 2026-07-03 | Cloudflare Managed Ruleset **Always active** (web-app exploits, DDoS, bot, API abuse) |
| 5 | A5 Clinic sign-in smoke after WAF | Yes | 2026-07-03 | Cloud sign-in verified after Bot Fight ON |
| 6 | B — API app limits confirmed (G6 redis) | Yes | 2026-07-03 | `checks.redis.mode=redis` |
| 7 | ASVS 9.1.3 updated to Pass | Yes | 2026-07-03 | `docs/PENTEST_ASVS_CHECKLIST.md` |

When rows 1–6 are complete, update `docs/PENTEST_ASVS_CHECKLIST.md` § 9.1.3 to **Pass** and `docs/PENTEST_REMEDIATION.md` Wave 3 WAF row to **Reviewed**.

**Free plan shortcut:** If Bot Fight Mode is ON and Security → Events shows managed-rule activity (or Settings shows managed ruleset enabled), mark row 4 done even without a visible "WAF" sidebar item.

---

## Troubleshooting — no WAF menu

### 1. You must be inside the **zone**, not Workers-only

WAF is configured per **domain**, not per Worker.

| Wrong (no WAF) | Right |
|----------------|-------|
| Home → **Workers & Pages** → `cornea-emr` | Home → **Websites** / **Domains** → click **`visionemr.net`** → then **Security** |

If `visionemr.net` does **not** appear under Websites/Domains, the DNS zone is not in this Cloudflare account — only the Worker is. WAF for the clinic hostname must be set on whoever owns the zone (or add the zone to your account).

### 2. Cloudflare redesigned the dashboard (2025–2026)

The left menu may show **Security rules** instead of **WAF**:

| What you want | Try these paths |
|---------------|-----------------|
| Managed protection | **Security** → **Settings** → enable *Cloudflare managed ruleset* |
| Custom block/challenge rules | **Security** → **Security rules** → **Custom rules** → Create rule |
| Bot protection | **Security** → **Bots** → Bot Fight Mode |
| Block/challenge logs | **Security** → **Events** or **Analytics** |

Direct links (replace `ZONE_ID` after opening your zone once):

- Security settings: `https://dash.cloudflare.com/` → select account → **visionemr.net** → Security

### 3. Free plan limits

| Feature | Free plan |
|---------|-----------|
| Cloudflare Free Managed Ruleset | **Default ON** — no deploy step required |
| OWASP Core Ruleset | Often **Pro+ only** — not required for our checklist |
| Custom WAF rules | **5 rules** — under Security rules / WAF Custom rules |
| Bot Fight Mode | **Available** — Security → Bots |

### 4. Minimum checklist without a "WAF" menu

If you still cannot find WAF after opening **visionemr.net**:

1. **Security → Bots** → Bot Fight Mode **ON**
2. **SSL/TLS** → Always Use HTTPS **ON**
3. **Security → Settings** → confirm managed rules / web application exploits protection is enabled (wording varies)
4. **Security → Events** — open after 24 h; you should see `managed_challenge` or managed-rule entries if traffic is filtered
5. Run `npm run check:cloudflare-waf` + clinic sign-in smoke

That satisfies stabilization **ASVS 9.1.3** on Free plan.

---

## Related

- `docs/SECURITY_BASELINE.md` § Edge hardening
- `docs/STABILIZATION_MODE.md` — weekly ops
- `wrangler.toml` — clinic Worker deploy
- `scripts/cloudflare-waf-check.mjs` — automated probe
