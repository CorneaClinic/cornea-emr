# Security Baseline (G6)

**Cornea Clinic EMR — stabilization gate G6**

---

## Current controls (production)

| Control | Status | Notes |
|---------|--------|-------|
| JWT access + refresh (httpOnly cookie) | Active | `AUTH_EXPOSE_REFRESH_IN_BODY=false` on DO |
| Login rate limit (IP + email) | Active | In-memory; 20/IP, 10/email per 15 min |
| Password reset rate limit | Active | 10/IP per hour |
| Global API rate limit (IP) | Active | 300 req/min/IP on `/api/v1/*` |
| CORS allowlist | Active | Explicit clinic origin only |
| RBAC per route | Active | `requirePermission` on registries, admin, media |
| Audit log (append-only) | Active | Auth + mutations |
| SMTP TLS | Active | Gmail / provider |
| Secrets in DO env | Active | Not in git |

---

## Known gaps (Phase 3)

| Gap | Risk | Remediation |
|-----|------|-------------|
| In-memory rate limits | Limits reset on redeploy; not shared across instances | Redis / DO Managed Redis (Phase 3.1) |
| No WAF beyond Cloudflare defaults | DDoS / scraping | Cloudflare rules review |
| Formal pen-test | Unknown edge cases | OWASP scope below — Month 4 |

---

## Penetration test scope (when scheduled)

**In scope**

- `/api/v1/auth/*` — login, refresh, password reset, session fixation
- Tenant isolation — clinic A cannot read clinic B patients/visits/registries
- `/api/v1/sync/push` — idempotency, revision bypass, oversized payloads
- Media upload — MIME validation, signed URL expiry, cross-clinic object access
- RBAC — receptionist vs admin vs consultant endpoints
- CORS + cookie flags on production

**Out of scope (unless agreed)**

- Social engineering, physical access
- Third-party Gmail / DO / Cloudflare infrastructure
- Client-side offline IndexedDB encryption (not implemented)

**Deliverable:** report with Critical/High/Medium/Low; Critical/High closed before feature freeze lift.

---

## Operator checklist (quarterly)

- [ ] Review production user roles (least privilege)
- [ ] Rotate `JWT_SECRET` / SMTP app password if compromised
- [ ] Confirm `DIGITALOCEAN_API_TOKEN` and backup encryption key stored off-site
- [ ] Re-run `npm run debug:global` with DO token
- [ ] Review failed login / audit log spikes

---

## Related

- `docs/PRODUCTION_STABILIZATION_ROADMAP.md` — Gate G6 exit criteria
- `apps/api/src/core/middleware/rateLimit.js`
