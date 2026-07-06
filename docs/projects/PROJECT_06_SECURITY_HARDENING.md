# Project 6 — Security Hardening

**Status:** Complete  
**Scope:** Auth/session review, upload virus scan hook, WAF/API domain, OWASP Top 10 report, formal pen-test reactivation prep.

---

## What shipped

### API — security posture
| Component | Purpose |
|-----------|---------|
| `apps/api/src/services/virusScanService.js` | Optional malware scan hook before media storage |
| `apps/api/src/services/securityStatusService.js` | Sessions, failed logins, rate limits, upload scan config |
| `GET /api/v1/admin/security/status` | Operator snapshot (requires `audit:read`) |

### Verification & reporting
| Component | Purpose |
|-----------|---------|
| `scripts/verify-security-hardening.mjs` | Ten checks (S1–S10); writes `docs/security-reports/latest.json` |
| `scripts/lib/security-hardening-checks.mjs` | Shared static checks (tested) |
| `scripts/generate-owasp-top10-report.mjs` | OWASP Top 10 (2021) control mapping |
| `scripts/review-auth-sessions.mjs` | Session/failed-login review via live API |

### npm scripts
```powershell
npm run verify:security          # full P6 verification + JSON report
npm run test:security-hardening  # static check unit tests
npm run security:owasp-report    # generate OWASP mapping
npm run security:auth-sessions   # live session review (needs credentials)
npm run pentest:self-check       # static remediation scan (existing)
npm run check:cloudflare-waf     # edge/WAF probe (existing)
```

---

## Virus scan hook

Configure on the API (DigitalOcean App Platform):

| Variable | Purpose |
|----------|---------|
| `MEDIA_VIRUS_SCAN_HOOK_URL` | POST endpoint for scan service |
| `MEDIA_VIRUS_SCAN_HOOK_SECRET` | Optional `Bearer` token for hook |
| `MEDIA_VIRUS_SCAN_REQUIRED` | `true` = block upload if hook fails |
| `MEDIA_VIRUS_SCAN_MAX_PAYLOAD_BYTES` | Max file size to include as base64 (default 25 MB) |
| `MEDIA_VIRUS_SCAN_TIMEOUT_MS` | Hook timeout (default 30s) |

**Hook contract (JSON):**

Request:
```json
{
  "assetId": "uuid",
  "clinicId": "uuid",
  "filename": "scan.jpg",
  "mimeType": "image/jpeg",
  "byteSize": 12345,
  "checksum": "sha256hex",
  "contentBase64": "..."
}
```

Response:
```json
{ "clean": true }
```
or
```json
{ "clean": false, "threat": "EICAR-Test-File" }
```

When `MEDIA_VIRUS_SCAN_HOOK_URL` is unset, uploads proceed without scanning (logged as `hook_not_configured`).

---

## Checks (S1–S10)

| ID | Check |
|----|-------|
| S1 | Virus scan service wired into `mediaAssetService` |
| S2 | `GET /api/v1/admin/security/status` route mounted |
| S3 | `pentest:self-check` script present |
| S4 | Cloudflare WAF probe + runbook |
| S5 | OWASP Top 10 report generator |
| S6 | Auth session review script |
| S7 | This project doc |
| S8 | Virus scan unit tests |
| S9 | Live security status API (needs `SEED_ADMIN_PASSWORD`) |
| S10 | API behind Cloudflare edge (`cf-ray`) |

---

## Operator workflow

1. **Weekly:** `npm run pentest:self-check`
2. **Monthly:** `npm run verify:security` and `npm run security:auth-sessions`
3. **Quarterly:** `npm run security:owasp-report` — archive JSON in `docs/security-reports/`
4. **When scanner available:** set `MEDIA_VIRUS_SCAN_HOOK_URL` on DO → redeploy API
5. **Pen-test reactivation:** `npm run pentest:engagement-ready` per `docs/PENTEST_ENGAGEMENT.md`

---

## WAF / edge

- Clinic UI: `https://corneaclinic.visionemr.net/Cornea` (Cloudflare)
- API: `https://corneaclinic-2zfpt.ondigitalocean.app` (Cloudflare proxy)
- Runbook: `docs/CLOUDFLARE_WAF_REVIEW.md`
- Probe: `npm run check:cloudflare-waf`

---

## Rollback

Remove virus scan env vars and revert API routes/services. No database migration. Uploads work without hook when URL is unset.

---

## Readiness impact

Estimated **+6% security readiness** — upload scan hook, operator security API, OWASP mapping, and automated verification alongside existing pentest CI.
