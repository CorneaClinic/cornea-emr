# Security Baseline (G6)

**Cornea Clinic EMR — stabilization gate G6**

---

## Gate status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Rate limiting on auth + API | **Active** | `rateLimit.js` + `auth.js` + `app.js` |
| Shared store (multi-instance) | **Ready** | Set `REDIS_URL` on DigitalOcean API |
| Pen-test scope defined | **Done** | Scope below |
| Pen-test remediation | **In progress** | `docs/PENTEST_REMEDIATION.md`; `npm run pentest:self-check` |
| Formal pen-test scheduled | **Jul 2026** | `docs/PENTEST_ENGAGEMENT.md` — test window Jul 21–25 |
| Formal pen-test executed | Pending | After vendor report + re-test |

**G6 PASS (code):** Redis-backed limiter ships in `main`; production PASS when `REDIS_URL` is set on DO and deploy is healthy.

---

## Current controls (production)

| Control | Status | Notes |
|---------|--------|-------|
| JWT access + refresh (httpOnly cookie) | Active | `AUTH_EXPOSE_REFRESH_IN_BODY=false` on DO |
| Login rate limit (IP + email) | Active | 20/IP, 10/email per 15 min |
| Password reset rate limit | Active | 10/IP per hour |
| Global API rate limit (IP) | Active | 300 req/min/IP on `/api/v1/*` |
| **Redis rate limit store** | **When `REDIS_URL` set** | Shared across redeploys/instances; in-memory fallback if Redis down |
| CORS allowlist | Active | Explicit clinic origin only |
| RBAC per route | Active | `requirePermission` on registries, admin, media |
| Audit log (append-only) | Active | Auth + mutations |
| SMTP TLS | Active | Gmail / provider |
| Secrets in DO env | Active | Not in git |

---

## Redis setup (DigitalOcean)

1. Create **Managed Redis** or **Valkey** in the same region as the API (e.g. `sgp1`).
2. Add the API App Platform app as a **trusted source** (or use VPC if configured).
3. Copy the connection string (`rediss://...` with TLS).
4. DigitalOcean → **cornea-emr-api** → Settings → Environment variables:

   | Variable | Value |
   |----------|--------|
   | `REDIS_URL` | `rediss://default:PASSWORD@host:25061` |

5. Redeploy API. Logs should show: `Redis connected — shared rate limits active`.
6. Without `REDIS_URL`, limits remain in-memory (acceptable for single instance; not G6 production-complete).

**Local dev:** leave `REDIS_URL` unset — in-memory limits apply automatically.

---

## Rate limit configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `RATE_LIMIT_LOGIN_MAX_PER_IP` | 20 | Login attempts per IP / 15 min |
| `RATE_LIMIT_LOGIN_MAX_PER_EMAIL` | 10 | Login attempts per email / 15 min |
| `RATE_LIMIT_RESET_MAX_PER_IP` | 10 | Password reset requests / hour |
| `RATE_LIMIT_API_MAX_PER_IP` | 300 | All `/api/v1/*` requests / min / IP |
| `REDIS_URL` | (unset) | Shared counter store |
| `REDIS_CONNECT_TIMEOUT_MS` | 5000 | Connect timeout |

Redis key prefix: `cornea:rl:<namespace>:<key>` (namespaces: `login-ip`, `login-email`, `reset-ip`, `api-v1`).

---

## Known gaps (post-G6)

| Gap | Risk | Remediation |
|-----|------|-------------|
| No WAF beyond Cloudflare defaults | DDoS / scraping | Cloudflare rules review |
| Formal pen-test not yet run | Unknown edge cases | Schedule per scope below |
| In-memory fallback if Redis fails | Brief limit reset | Monitor Redis; DO managed HA |

---

## Penetration test scope (Q3 2026 target)

**In scope**

- `/api/v1/auth/*` — login, refresh, password reset, session fixation
- Tenant isolation — clinic A cannot read clinic B patients/visits/registries
- `/api/v1/sync/push` — idempotency, revision bypass, oversized payloads
- Media upload — MIME validation, signed URL expiry, cross-clinic object access
- RBAC — receptionist vs admin vs consultant endpoints
- CORS + cookie flags on production
- Rate limit bypass (IP rotation, `X-Forwarded-For` spoofing behind trusted proxy)

**Out of scope (unless agreed)**

- Social engineering, physical access
- Third-party Gmail / DO / Cloudflare infrastructure
- Client-side offline IndexedDB encryption (not implemented)

**Deliverable:** report with Critical/High/Medium/Low; Critical/High closed before feature freeze lift.

**Vendor options:** OWASP ASVS L2 checklist, or contracted web app pen-test (3–5 days).

---

## Operator checklist (quarterly)

- [ ] `REDIS_URL` set on production API (G6 complete)
- [ ] Review production user roles (least privilege)
- [ ] Rotate `JWT_SECRET` / SMTP app password if compromised
- [ ] Confirm `DIGITALOCEAN_API_TOKEN` and backup encryption key stored off-site
- [ ] Re-run `npm run debug:global` with DO token
- [ ] Review failed login / audit log spikes
- [ ] Pen-test scheduled or completed per scope above

---

## Related

- `docs/PRODUCTION_STABILIZATION_ROADMAP.md` — Gate G6 exit criteria
- `apps/api/src/core/middleware/rateLimit.js`
- `apps/api/src/core/redis.js`
