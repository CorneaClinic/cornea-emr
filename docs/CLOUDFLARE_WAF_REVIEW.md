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

| Setting | Path | Recommended |
|---------|------|-------------|
| OWASP Core Ruleset | Security → WAF → Managed rules | **Deploy** on Free plan if available; else use available managed rulesets |
| Cloudflare Managed Ruleset | Security → WAF | **On** |
| Sensitivity | WAF | Start **Medium**; tune if clinic UI breaks |

**Scope:** applies to `corneaclinic.visionemr.net` and other hostnames on the zone.

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

| # | Item | Done | Date |
|---|------|------|------|
| 1 | `npm run check:cloudflare-waf` pass | ☐ | |
| 2 | A1 SSL/TLS reviewed | ☐ | |
| 3 | A2 Bot Fight Mode on (clinic zone) | ☐ | |
| 4 | A3 WAF managed rules deployed | ☐ | |
| 5 | A5 Clinic sign-in smoke after WAF | ☐ | |
| 6 | B — API app limits confirmed (G6 redis) | ☐ | |
| 7 | ASVS 9.1.3 updated to Pass | ☐ | |

When rows 1–6 are complete, update `docs/PENTEST_ASVS_CHECKLIST.md` § 9.1.3 to **Pass** and `docs/PENTEST_REMEDIATION.md` Wave 3 WAF row to **Reviewed**.

---

## Related

- `docs/SECURITY_BASELINE.md` § Edge hardening
- `docs/STABILIZATION_MODE.md` — weekly ops
- `wrangler.toml` — clinic Worker deploy
- `scripts/cloudflare-waf-check.mjs` — automated probe
