# Incident Response Runbook

**Cornea Clinic EMR — production**

Use this when the clinic UI, API, sync, or backups behave unexpectedly.

---

## Severity guide

| Level | Examples | Response |
|-------|----------|----------|
| **P1** | Cannot sign in (all users); data loss suspected; API down > 15 min | Immediate — clinic lead + dev |
| **P2** | One module broken (e.g. Keratoplasty tabs); sync stuck; backup failed 2+ days | Same day |
| **P3** | Single-user issue; slow performance; non-critical email failure | Next business day |

---

## 1. Login / cloud sign-in down

1. Check API: `GET https://corneaclinic-2zfpt.ondigitalocean.app/health/live`
2. Check clinic: open https://corneaclinic.visionemr.net/Cornea?cloud=1 — browser console for errors
3. **Offline fallback:** users can choose **Continue offline** (local IndexedDB only on that device)
4. DigitalOcean → App Platform → `cornea-emr-api` → Runtime logs
5. Rollback: redeploy previous API release or revert last clinic Wrangler deploy

---

## 2. Sync stuck / conflicts

1. User: Settings → sync status badge; note pending count
2. Dev: `GET /api/v1/sync/status` with user token (open conflicts)
3. Common causes: stale revision (409), network drop, duplicate local IDs
4. See `docs/SYNC_ARCHITECTURE.md` — server wins on conflict; user re-edits if needed
5. Nuclear option (single device): clear sync queue after confirming cloud has latest data

---

## 3. API 5xx / timeouts

1. DO dashboard → app health, DB connection pool
2. Check managed Postgres CPU/storage; trusted sources if clinic PC backup fails
3. Restart app instance (DO → Deploy → Force rebuild) only if logs show crash loop
4. GitHub **Production Health** workflow — last hourly run

---

## 4. Keratoplasty / module script errors

1. Browser console — look for `SyntaxError` or undefined globals
2. Hard refresh (`Ctrl+Shift+R`) after clinic deploy
3. CI **clinic-globals** job catches duplicate store name collisions
4. Fix + `npm run deploy:clinic`

---

## 5. Backup failure

1. Read `backups/production/backup.log` (last 5 lines)
2. Often: IP not in DO **Trusted sources** — run `scripts/update-do-db-trusted-ip.ps1`
3. Manual backup: `powershell -File scripts/backup-production.ps1`
4. Verify off-site `.enc` in configured off-site folder

---

## 6. Password reset email not received

1. Confirm SMTP env on DO (`SMTP_HOST`, `SMTP_USER`, `SMTP_FROM`)
2. `cd apps/api && npm run test:smtp` (with production env locally — do not commit)
3. Check spam; reset link must use production API URL (not localhost)
4. `npm run verify:password-reset -- user@email.com`

---

## Escalation contacts

| Role | Action |
|------|--------|
| Clinic lead | Go/no-go on downtime, patient communication |
| Dev / ops | DO, Cloudflare, DB, deploys |
| DigitalOcean support | Managed DB / App Platform outages |

---

## Post-incident

1. Log in `backups/ops-smoke-test.log` or team channel: date, symptom, root cause, fix
2. Add regression test if repeatable (Playwright or `verify:sync-matrix`)
3. Update this runbook if steps were wrong or missing
