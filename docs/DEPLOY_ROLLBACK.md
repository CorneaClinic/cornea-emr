# Deploy & rollback runbook

**Cornea Clinic EMR — production**

| Component | Host | Deploy | Rollback |
|-----------|------|--------|----------|
| Clinic UI | Cloudflare Workers | `npm run deploy:clinic` | Script or dashboard (below) |
| API | DigitalOcean App Platform | Auto on `main` push | DO release rollback |
| PostgreSQL | DO Managed DB | Migrations via API deploy | DO point-in-time backup / restore |

Production URLs:

- Clinic: https://corneaclinic.visionemr.net/Cornea
- API: https://corneaclinic-2zfpt.ondigitalocean.app

---

## Before every deploy

1. **CI green** on the commit you are deploying — [Actions](https://github.com/CorneaClinic/cornea-emr/actions)
2. `npm run test:unit` and `npm run verify:sync-matrix` locally if you skipped CI
3. Note the **current good commit** (`git log -1 --oneline`) for rollback
4. API: confirm DO auto-deploy from GitHub is enabled on `main`
5. Clinic: `npm run deploy:clinic` only after UI files change under `apps/clinic/`

---

## Rollback clinic UI (Cloudflare Workers)

### Option A — Script (recommended)

Deploy the clinic assets from a known-good git commit **without** moving the `main` branch:

```powershell
cd C:\Users\Hp\Documents\trae_projects\cornea-emr

# List recent commits that touched apps/clinic
powershell -ExecutionPolicy Bypass -File scripts\rollback-clinic.ps1 -List

# Roll back UI to that commit (e.g. before a bad deploy)
powershell -ExecutionPolicy Bypass -File scripts\rollback-clinic.ps1 -Commit 9989779
```

Or: `npm run rollback:clinic -- -Commit 9989779`

Users must **hard refresh** (`Ctrl+Shift+R`) after rollback.

### Option B — Cloudflare dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → `cornea-emr`
2. **Deployments** → select previous **Version** → **Rollback to this version**

### Option C — Revert in git + redeploy

```powershell
git revert HEAD   # or revert specific commit
git push origin main
npm run deploy:clinic
```

Use when the fix should stay on `main`, not only on Workers.

---

## Rollback API (DigitalOcean App Platform)

The API redeploys automatically when `main` is pushed (GitHub integration).

### Option A — DO release rollback (fastest)

1. [DigitalOcean](https://cloud.digitalocean.com) → **Apps** → `cornea-emr-api` (or your app name)
2. **Activity** tab → find last **successful** deployment before the incident
3. **⋯** → **Rollback to this deployment**

No git change required. Use for bad env vars, crash loops, or bad API code already on DO.

### Option B — Git revert + push

```powershell
git log -5 --oneline
git revert <bad-commit-sha>
git push origin main
```

Wait for DO build (~3–8 min). Watch **Runtime logs** for `Listening` / migration success.

### Option C — Bad database migration

**Do not** rollback the app alone if a migration partially applied.

1. Stop traffic: scale app to 0 instances temporarily (DO → Settings) **or** fix forward
2. Restore DB from backup — see `docs/BACKUP_RECOVERY.md`
3. Deploy fixed migration or re-run from known-good commit

---

## Rollback decision matrix

| Symptom | Likely layer | First action |
|---------|--------------|--------------|
| Blank Keratoplasty / KC tabs, JS errors in console | Clinic UI | `rollback-clinic.ps1` or CF version rollback |
| 401/500 on all API calls | API | DO deployment rollback |
| Login OK but sync 409 storms | Data / sync | See `INCIDENT_RESPONSE.md` §2 — usually not a deploy rollback |
| Images missing after deploy | API media env | Check `MEDIA_STORAGE_PROVIDER=s3`; rollback API if env regression |
| Only one user affected | Client cache | Hard refresh; not a server rollback |

---

## Staging E2E (nightly live smoke)

Workflow: `.github/workflows/e2e-nightly.yml` (02:00 UTC daily).

| Secret / variable | Purpose |
|-------------------|---------|
| `STAGING_E2E_EMAIL` | Production/staging login email |
| `STAGING_E2E_PASSWORD` | Password for that account |
| `STAGING_CLINIC_URL` (optional var) | Default: production clinic URL |
| `STAGING_API_URL` (optional var) | Default: production API URL |

### One-time setup (GitHub CLI)

```powershell
cd C:\Users\Hp\Documents\trae_projects\cornea-emr
gh secret set STAGING_E2E_EMAIL --body "your-clinic-user@email.com"
gh secret set STAGING_E2E_PASSWORD --body "YourSecurePassword"
# Optional overrides:
gh variable set STAGING_CLINIC_URL --body "https://corneaclinic.visionemr.net/Cornea"
gh variable set STAGING_API_URL --body "https://corneaclinic-2zfpt.ondigitalocean.app"
```

Local run (same tests as nightly staging job):

```powershell
$env:STAGING_E2E_EMAIL = "your@email.com"
$env:STAGING_E2E_PASSWORD = "YourPassword"
npm run smoke:staging
```

Or: `powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e.ps1 -Email ... -Password ...` (prints `gh` commands if `gh` is missing).

---

## Post-rollback verification

```powershell
npm run health:production
```

Manual:

- [ ] Cloud login at clinic URL
- [ ] Keratoplasty tabs switch
- [ ] KC registry loads
- [ ] Visit save / sync push (test patient)

Log outcome in `backups/ops-smoke-test.log` or team channel.

---

## Related docs

- `docs/INCIDENT_RESPONSE.md` — symptom-based triage
- `docs/BACKUP_RECOVERY.md` — database restore
- `docs/DIGITALOCEAN_APP_PLATFORM.md` — API deploy details
- `docs/PRODUCTION_DEPLOY.md` — initial production setup
