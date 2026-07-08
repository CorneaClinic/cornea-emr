# OWASP ZAP DAST — Cornea EMR

Repeatable Dynamic Application Security Testing against the **local/staging stack only**. Active scans are **blocked** on production URLs to avoid mutating live PHI.

---

## Prerequisites

1. **Java 17+** and **OWASP ZAP 2.14+** — [zaproxy.org/download](https://www.zaproxy.org/download/)
   - Windows one-liner: `powershell -ExecutionPolicy Bypass -File scripts/dast/install-zap.ps1`
   - Or: `winget install Microsoft.OpenJDK.17` then `winget install ZAP.ZAP`
   - Set `ZAP_PATH` if not in default location (e.g. `C:\Program Files\ZAP\Zed Attack Proxy\zap.bat`)
2. **Local Postgres** with test DB (`npm run docker:up`, migrations, E2E seed)
3. **API + clinic running** on `127.0.0.1:3000` and `:8080` (or Playwright webServer)

ZAP listens on **port 8090** by default (`ZAP_PORT`) so it does not conflict with the clinic on 8080.

---

## Quick start

```powershell
# Terminal 1 — database
npm run docker:up
cd apps/api && npm run migrate && node scripts/e2e-playwright-setup.js

# Terminal 2 — API (DAST database)
npm run api:dev:dast

# Terminal 3 — clinic static server
npm run clinic:dev

# Terminal 4 — DAST
npm run dast:setup-users
npm run dast:scan
```

Passive-only (no attack payloads):

```powershell
npm run dast:scan:passive
```

---

## What the scan does

| Phase | Description |
|-------|-------------|
| **Safety gate** | Refuses production hosts for active scans |
| **Users** | Creates isolated `cornea-clinic-dast` users: admin, receptionist, cornea_consultant |
| **Per role** | Login → Bearer replacer → spider + ajax spider on clinic UI |
| **API** | OpenAPI seed import → passive analysis of REST surface |
| **Upload probe** | Small text file to patient media (local DB only) |
| **Passive** | Waits for passive scan queue |
| **Active** | Low-policy active scan on clinic + API (local only) |

---

## Reports

Written to `docs/dast-reports/`:

| File | Format |
|------|--------|
| `dast-latest.json` | Machine-readable findings + fix hints |
| `dast-latest.md` | Human report with explanations |
| `dast-latest.html` | ZAP traditional HTML (when export succeeds) |
| `dast-by-role.json` | Per-role breakdown |

Each finding includes:

- Risk, URL, CWE
- Plain-language **explanation**
- **Proposed code fix** (suggested diff locations — review before merging)

---

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DAST_CLINIC_URL` | `http://127.0.0.1:8080` | Clinic UI origin |
| `DAST_API_URL` | `http://127.0.0.1:3000` | API origin |
| `DAST_PASSWORD` | `Dast-Scan-Test1!` | DAST user password (local DB) |
| `DAST_ACTIVE_SCAN` | `true` | Set `false` for passive-only |
| `DAST_ALLOW_PRODUCTION_PASSIVE` | `0` | Set `1` to allow passive baseline on prod (read-only) |
| `ZAP_PATH` | auto-detect | Path to `zap.bat` / `zap.sh` |
| `ZAP_PORT` | `8090` | ZAP daemon port |
| `DATABASE_URL` | — | Required for `dast:setup-users` |

---

## npm scripts

| Script | Action |
|--------|--------|
| `npm run dast:setup-users` | Create DAST role accounts in test DB |
| `npm run dast:scan` | Full passive + active DAST |
| `npm run dast:scan:passive` | Passive + spider only |
| `npm run test:dast` | Unit tests for safety + reporting |

---

## Production policy

- **Never** run `npm run dast:scan` (active) against `corneaclinic.visionemr.net` or DigitalOcean API.
- For production **read-only** baselines, use `dast:scan:passive` with `DAST_ALLOW_PRODUCTION_PASSIVE=1` only after change approval.
- Formal pen-test scope: `docs/PENTEST_ENGAGEMENT.md`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `OWASP ZAP not found` | Install ZAP; set `ZAP_PATH` |
| `DAST preflight failed` | Start API + clinic servers |
| `DATABASE_URL required` | Run `docker:up` + migrate |
| Spider timeout | Increase timeout in `scripts/dast/lib/zap-api.mjs` |
| Ajax spider skipped | Normal for static-heavy UI; spider still runs |

---

## Baseline (strict CSP + cleanup, 2026-07-08)

Local stack after strict nonce-based CSP (`apps/clinic/lib/csp-policy.cjs`) and static header cleanup:

| Scan | High | Medium | Low | Informational |
|------|------|--------|-----|---------------|
| Passive (3 roles) | 0 | 0 | 0 | 153 |
| Active (3 roles, pre-cleanup) | 0 | 0 | 0 | 477 |
| **Active (3 roles, post-cleanup)** | **0** | **0** | **0** | **498** |

Remaining informational alerts are expected noise:

| Alert | Count | Notes |
|-------|-------|-------|
| User Agent Fuzzer | 324 | ZAP active fuzzer; not actionable |
| Information Disclosure - Suspicious Comments | 90 | JSDoc in extracted JS modules |
| User Controllable HTML Element Attribute | 81 | GET query params matching form field names (CSP mitigates XSS) |
| Modern Web Application | 3 | SPA detection |
| ~~Content-Type Header Missing~~ | **0** | Fixed via `robots.txt` / `sitemap.xml` + error response headers |

Re-run after changes: `npm run dast:scan` (local only).

---

## Related

- Static mapping: `npm run security:owasp-report`
- Self-check: `npm run pentest:self-check`
- WAF: `docs/CLOUDFLARE_WAF_REVIEW.md`
