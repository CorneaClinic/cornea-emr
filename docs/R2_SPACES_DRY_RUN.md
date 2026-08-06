# Stage 4 dry-run: DigitalOcean Spaces → Cloudflare R2

**Goal:** Prove object copy + integrity **without** changing production `MEDIA_*` on App Platform.  
**Status:** Tooling ready. R2 must be enabled on the Cloudflare account before the first copy.

---

## Blocker cleared (2026-08-01)

- R2 enabled on Cloudflare account `f2c41820d69631f2365f03a76922e190`
- Staging bucket created: **`cornea-emr-media-staging`**
- Wrangler OAuth R2 put/get probe succeeded (`_migration-probe/probe.txt`)

### If you cannot create Spaces Access Keys

Your DigitalOcean **team role** likely cannot manage Spaces keys (API returned `403`; control panel shows no permission). That is normal for non-Owner members.

**Do this instead (no Spaces keys required):**

1. Ask the DigitalOcean **Owner / billing admin** either to:
   - grant you Spaces manage permission, **or**
   - create a Limited **Read** key on bucket `corneaclinic-storage` and send you Access+Secret securely  
2. **Or** run the API-mediated dry-run (uses Cloud Sign In; API already talks to Spaces):

```powershell
cd c:\Users\Hp\Documents\trae_projects\cornea-emr
$env:AUTH_EMAIL = "your-clinic-login@email"
$env:AUTH_PASSWORD = "your-password"
npm run migrate:r2:via-api
```

Do not paste the password into chat. Tell me when the env vars are set (or paste only the summary lines).

---

### Remaining for object copy (Spaces path — optional)

You **cannot** read the existing App Platform `MEDIA_S3_*` secrets again (DigitalOcean never shows secret values after save).  
Spaces keys are also **not** under **API → Tokens** — that is a different product.

#### Create a new Spaces Access Key (Owner/admin only)

1. Open [Spaces Object Storage](https://cloud.digitalocean.com/spaces).
2. Click the **Access Keys** tab (top of the Spaces page — not “API” in the left nav).
3. Click **Create Access Key**.
4. Prefer **Limited** access → bucket `corneaclinic-storage` → **Read** (enough for dry-run).
5. Name it e.g. `cornea-r2-migration-readonly`.
6. Click **Create** — **copy Access Key + Secret Key immediately** (secret is shown once).

Then:

```powershell
$env:MEDIA_S3_ACCESS_KEY_ID = "<Access Key>"
$env:MEDIA_S3_SECRET_ACCESS_KEY = "<Secret Key>"
npm run migrate:r2:list
npm run migrate:r2:dry-run
```

R2 API tokens are **optional** — both dry-run scripts use Wrangler OAuth for R2 by default.

---

## Credentials

### Spaces (source — read-only)

From DigitalOcean → Spaces → API keys, or existing App Platform secrets:

| Env | Example |
|-----|---------|
| `MEDIA_S3_ACCESS_KEY_ID` / `SPACES_ACCESS_KEY_ID` | Spaces key |
| `MEDIA_S3_SECRET_ACCESS_KEY` / `SPACES_SECRET_ACCESS_KEY` | Spaces secret |
| `MEDIA_S3_BUCKET` | `corneaclinic-storage` (default) |
| `MEDIA_S3_ENDPOINT` | `https://sgp1.digitaloceanspaces.com` |

### R2 (destination — staging only)

1. Dashboard → R2 → **Manage R2 API Tokens** → Create token (Object Read & Write, scope staging bucket).
2. Note **Access Key ID**, **Secret Access Key**, and Account ID (`f2c41820d69631f2365f03a76922e190`).

| Env | Value |
|-----|--------|
| `R2_ACCESS_KEY_ID` | from token |
| `R2_SECRET_ACCESS_KEY` | from token |
| `R2_BUCKET` | `cornea-emr-media-staging` (default) |
| `CLOUDFLARE_ACCOUNT_ID` | `f2c41820d69631f2365f03a76922e190` |

---

## Commands

```powershell
cd c:\Users\Hp\Documents\trae_projects\cornea-emr

# 1) List only (needs Spaces creds; no R2 writes)
npm run migrate:r2:list

# 2) Copy up to 25 objects into staging R2 + size/sha check
npm run migrate:r2:dry-run

# Custom limit / prefix
node scripts/r2-spaces-dry-run.mjs --limit 50 --prefix "clinic-id/"
```

**Do not** set production App Platform `MEDIA_S3_*` to R2 until:

- Dry-run summary shows `Failed: 0`
- A second full sync (Super Slurper / rclone / larger `--limit`) is verified
- Clinic media upload/download tested against a **staging** API instance

---

## Rollback / safety

- Staging bucket name must **not** be the production Spaces bucket.
- Production App Platform env stays on Spaces until Phase 14 cutover.
- Keep Spaces online ≥7 days after any future production flip.

---

## After dry-run passes

1. Optional: enable [Sippy](https://developers.cloudflare.com/r2/data-migration/sippy/) on a prod-candidate R2 bucket for on-demand fill.
2. Optional: Super Slurper full Spaces → R2 migration.
3. Only then: Stage 2 canary API + staging `MEDIA_S3_*` pointed at R2.
