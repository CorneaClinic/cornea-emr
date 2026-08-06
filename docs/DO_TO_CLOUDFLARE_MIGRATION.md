# DigitalOcean → Cloudflare Migration Report

**Product:** VisionEMR Tertiary Cornea Institute Platform (`cornea-emr`)  
**Status:** Phase 1 complete — **audit only**. No production resources deleted or cut over.  
**Date:** 2026-08-01  
**Constraint:** Live system with patient PHI — zero-downtime staged migration required.

---

## Executive verdict

| Layer | Today | Cloudflare target | Migrate now? |
|-------|--------|-------------------|--------------|
| Clinic UI | **Already on Cloudflare Workers + Assets** | Keep (optionally GitHub Actions auto-deploy) | Stage 1 polish only |
| API | DigitalOcean App Platform (Node/Express) | **Cloudflare Containers** (reuse Express) — not pure Workers | Stage 2 |
| Database | DO Managed PostgreSQL 16 | **Keep Postgres external**; optional Hyperdrive if API moves to Workers later | Stage 3: stay on DO or move host — **do not use D1** |
| Media | DO Spaces (`corneaclinic-storage`, sgp1) | **Cloudflare R2** (S3-compatible; code already ready) | Stage 4 |
| Rate limits | DO Managed Valkey/Redis | Upstash Redis / CF-compatible Redis / in-Worker Durable Object counters | Stage 6 |
| DNS / WAF | Cloudflare (`visionemr.net`) | Keep + harden Access / Turnstile / WAF | Stages 9–11 |

**Critical finding:** Front-end migration is largely **done**. Cost and risk concentrate on **API + Postgres + Spaces + Valkey**.

---

## Phase 1 — Current infrastructure audit

### Architecture (current)

```text
┌─────────────────────────────────────────────────────────────────┐
│ Cloudflare (visionemr.net)                                      │
│  DNS · WAF · Bot Fight · TLS                                    │
│  Workers + Assets: cornea-emr                                   │
│    https://corneaclinic.visionemr.net/Cornea                    │
│    wrangler.toml → apps/clinic (clinic-worker.js + static)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (CORS, SameSite=None cookies)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ DigitalOcean                                                    │
│  App Platform: cornea-emr-api (blr)                             │
│    https://corneaclinic-2zfpt.ondigitalocean.app                │
│    also APP_PUBLIC_URL=https://api.visionemr.net                │
│    Node 20+ Express · migrate-cli then index.js · port 3000     │
│  Managed PostgreSQL 16: cornea-emr-db                           │
│  Spaces: corneaclinic-storage @ sgp1.digitaloceanspaces.com     │
│  Managed Valkey: REDIS_URL (shared rate limits)                 │
└─────────────────────────────────────────────────────────────────┘

Browser IndexedDB ←→ CorneaSync push/pull/wait ←→ Postgres
Clinical media ←→ S3 SDK ←→ Spaces
```

### What is hosted where

| Service | Provider | Evidence |
|---------|----------|----------|
| Clinic static + edge worker | Cloudflare Workers | `wrangler.toml`, `npm run deploy:clinic` |
| Express API | DO App Platform | `.do/app.yaml`, `deploy_on_push: true` |
| PostgreSQL | DO Managed DB | `.do/app.yaml` `cornea-db`, `DATABASE_URL` |
| Object storage | DO Spaces | `MEDIA_S3_*` in app.yaml |
| Redis/Valkey | DO Managed Valkey | `REDIS_URL`, `setup:do-valkey` |
| Droplet | Not primary | Docs prefer App Platform over Droplet |
| Cloudflare Tunnel | Legacy/local | `infra/cloudflared-config.yml` (clinic-PC era) |
| GitHub Actions | CI / health / e2e | Does **not** deploy clinic or API |

### Frontend

- Path: `apps/clinic/`
- Deploy: Workers Assets (`[assets] directory = ./apps/clinic`)
- Offline: IndexedDB + PHI encryption — **not** a classic PWA service worker
- CSP worker injects nonces; API allowlist includes DO app + `api.visionemr.net`

### Backend

- Path: `apps/api/` — Express ESM, `node src/index.js`
- Health: `/health/live`, `/health`, `/health/ready`
- Instance: `basic-xxs`, count 1, region `blr`
- Auto-deploy on GitHub `main` push via App Platform

### Database

- PostgreSQL 16, ~29 migrations, ~36 tables
- Sync tables: `client_mutations`, `sync_cursors`, `sync_conflicts`, `sync_logs`
- PG is **source of truth**; clinic IndexedDB is offline cache + outbound queue

### Authentication

- JWT access (~15m) + HttpOnly refresh cookie (`cornea_refresh_token`)
- Production: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=none` (cross-origin clinic→API)
- Roles + fine-grained permissions; optional OIDC + LDAP
- Secrets: `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`

### Storage / media

- `@aws-sdk/client-s3` via `s3Provider.js`
- Path pattern: `{clinicId}/{category}/{year}/{month}/{assetId}/{filename}`
- Docs already document R2 as drop-in via same env vars (`docs/CLINICAL_MEDIA_PLATFORM.md`)

### Cloud sync

- `POST /api/v1/sync/push`, `GET /pull`, `GET /wait` (long-poll ~30s), status/logs/conflict resolve
- Client: `cornea-sync-client.js`

### Environment variables (names only)

See `apps/api/.env.example` and `.do/app.yaml`. Key groups: `DATABASE_URL`, JWT/auth cookies, `CORS_ORIGIN`, `APP_PUBLIC_URL`, `CLINIC_PUBLIC_URL`, `MEDIA_*`, `REDIS_URL`, SMTP, SSO (`SSO_*`), rate-limit vars.

### GitHub

| Workflow | Deploys? |
|----------|----------|
| `ci.yml` | No — tests |
| `e2e-nightly.yml` | No |
| `production-health.yml` | No — probes DO health |
| Clinic | Manual `wrangler deploy` |
| API | DO App Platform `deploy_on_push` |

### Monthly cost contributors (estimate — verify in DO billing)

| Item | Typical order of magnitude* |
|------|----------------------------|
| App Platform `basic-xxs` | Low tens of USD |
| Managed PostgreSQL 16 | Often largest line item |
| Spaces + egress | Storage + bandwidth |
| Managed Valkey 1GB | Low tens of USD |
| Cloudflare Workers Assets | Often within free/paid Workers plan |
| Cloudflare DNS/WAF | Zone plan dependent |

\*Exact invoices vary by region and usage — pull DigitalOcean Billing → Usage and Cloudflare Billing before Stage 14.

---

## Phase 2 — Cloudflare compatibility matrix

| Cloudflare product | Fit for VisionEMR | Recommendation |
|--------------------|-------------------|----------------|
| **Workers + Assets** | Clinic UI already here | Keep; add CI deploy |
| **Pages** | Overlap with Workers Assets | **Do not migrate Pages** — already on Workers (CF recommends Workers over new Pages) |
| **Workers (API)** | Express, `pg`, multer, redis, ldapjs, long-poll | **Not suitable as-is** |
| **Containers** | Run existing Node Docker image | **Preferred API host on CF** |
| **D1** | SQLite; not Postgres; no full PG feature set | **Do not migrate EMR DB to D1** |
| **Hyperdrive** | Speeds Workers→Postgres | Only if API rewritten for Workers; optional later |
| **R2** | S3-compatible; Spaces → R2 documented | **Primary media target** |
| **KV** | Session/cache/feature flags | Optional; not primary PHI store |
| **Durable Objects** | Sync coordination / rate-limit counters | Optional Stage 6 |
| **Queues** | Async media processing, emails | Optional |
| **Turnstile** | Login bot protection | Stage 11 |
| **Images** | Thumbnail variants | Optional for teaching library |
| **Zero Trust / Access** | Admin UI / ops | Stage 11 (staff tools, not patient clinic) |
| **Tunnel** | Legacy local API | Keep only for disaster/local; not primary prod |

---

## Phase 3 — Zero-downtime migration strategy

### Stage 1 — Static frontend (mostly complete)

| | |
|--|--|
| **Prerequisites** | Confirm `npm run deploy:clinic` green; CSP allowlist for dual API origins |
| **Work** | Optional GitHub Action: deploy Worker on `main`; dual-API allowlist during cutover |
| **Risks** | Low — already production |
| **Rollback** | Redeploy previous Worker version via Wrangler/dashboard |
| **Testing** | Staging smoke + Ctrl+F5 clinic load |

### Stage 2 — Backend API

| | |
|--|--|
| **Prerequisites** | Dockerfile verified; Container registry via Wrangler; secrets mirrored |
| **Work** | Deploy Express on **Cloudflare Containers** behind Worker route `api.visionemr.net`; keep DO App Platform live |
| **Risks** | Cold start; long-poll behavior; cookie domain; health checks |
| **Rollback** | DNS/route back to `*.ondigitalocean.app` |
| **Testing** | `npm run debug:deep`, Playwright staging smoke, sync push/pull |

**Why not pure Workers?** Express + `pg` pool + multer + redis + ldapjs + 30s long-poll are Node/container patterns. A full rewrite would be multi-month and high clinical risk.

### Stage 3 — Database

| | |
|--|--|
| **Prerequisites** | Full encrypted backup + restore drill; connection allowlists |
| **Work** | **Recommended:** keep Managed Postgres (DO or another PG host). Optionally Hyperdrive only after Worker rewrite. |
| **Do not** | Convert to D1 (SQLite dialect, size/CPU limits, no PG extensions/features used by EMR) |
| **Risks** | Highest PHI risk of any stage |
| **Rollback** | Point `DATABASE_URL` back; never delete old cluster until ≥1 week verified |
| **Testing** | Backup restore drill, sync matrix, registry CRUD |

### Stage 4 — Media (Spaces → R2)

| | |
|--|--|
| **Prerequisites** | R2 bucket + API tokens; dual-write or Sippy/Super Slurper |
| **Work** | (1) Super Slurper / rclone copy Spaces→R2 (2) Sippy for on-demand fill (3) Flip `MEDIA_S3_*` to R2 endpoint (4) Verify checksums vs `media_assets` |
| **Risks** | ETag differences with Sippy; incomplete copy |
| **Rollback** | Revert `MEDIA_S3_*` to Spaces; keep Spaces read-only ≥1 week |
| **Testing** | Upload slit-lamp image, DICOM, teaching media; download content |

### Stage 5 — Authentication

| | |
|--|--|
| **Prerequisites** | Same `JWT_SECRET` / `SECRETS_ENCRYPTION_KEY` on new API |
| **Work** | Preserve cookie names, `SameSite=None`, `Secure`; update `APP_PUBLIC_URL` / CORS |
| **Risks** | Session invalidation if secrets change; SSO redirect URIs |
| **Rollback** | Old API + secrets |
| **Testing** | Login, refresh, logout, password reset, role matrix |

### Stage 6 — Background jobs / Redis

| | |
|--|--|
| **Prerequisites** | Rate-limit behavior documented |
| **Work** | Replace Valkey with Upstash Redis or DO-compatible Redis reachable from Containers; or DO counters with care |
| **Risks** | Multi-instance rate-limit bypass if in-memory only |
| **Testing** | `/health` redis mode; 429 behavior |

### Stage 7 — Monitoring

| | |
|--|--|
| **Work** | Update `production-health.yml` probes to new API URL; Wrangler tail / Workers Observability; keep DO health until decommission |
| **Testing** | Hourly health job green for 7 days |

---

## Phase 4 — Frontend migration

**Status:** Complete on Workers Assets.

Recommended polish (non-blocking):

1. GitHub Action: `npm run deploy:clinic` on `main` (with Wrangler secrets).
2. Keep `run_worker_first = true` for CSP.
3. During API cutover, CSP `connect-src` must allow **both** old and new API hosts.
4. Offline IndexedDB path unchanged — no PWA SW required for parity.

---

## Phase 5 — Backend migration

**Recommendation:** Cloudflare **Containers** running existing `apps/api/Dockerfile`.

| Option | Pros | Cons |
|--------|------|------|
| Containers + Worker route | Reuse Express; lowest rewrite risk | Newer CF product; cold starts |
| Stay on DO App Platform | Known-good | Does not meet “all on Cloudflare” goal |
| Rewrite as Workers | Edge scale | Months of work; long-poll redesign; Hyperdrive + driver changes |

Reuse existing API routes; only change hosting + env + CORS/cookie domain as needed.

---

## Phase 6 — Database migration

**Decision: Do not migrate to D1.**

Reasons:

- Application is PostgreSQL-native (`pg`, migrations, transactions, sync revisions).
- D1 is SQLite with different limits and dialect.
- EMR needs durable transactional integrity for visits/media/audit.

**Plan:**

1. Keep Postgres as system of record.
2. Short term: leave on DO Managed PG while API moves (private networking / trusted sources / Cloudflare IP allowlist as applicable).
3. Medium term: evaluate Neon/RDS/DO PG + Hyperdrive **only if** API moves to Workers.
4. Always: encrypted backup before any host change; restore drill; dual-run ≥1 week.

---

## Phase 7 — Media storage (Spaces → R2)

### Migration script outline

```bash
# 1) Create R2 bucket cornea-emr-media
# 2) Bulk copy (Super Slurper dashboard OR rclone)
rclone sync spaces:corneaclinic-storage r2:cornea-emr-media --checksum

# 3) Optional: Sippy for residual on-demand copy
npx wrangler r2 bucket sippy enable cornea-emr-media

# 4) Flip API env (no code change if s3Provider already used):
# MEDIA_STORAGE_PROVIDER=s3
# MEDIA_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# MEDIA_S3_BUCKET=cornea-emr-media
# MEDIA_S3_ACCESS_KEY_ID=...
# MEDIA_S3_SECRET_ACCESS_KEY=...
# MEDIA_S3_REGION=auto
```

### Integrity

- Compare object keys to `media_assets` rows.
- Spot-check SHA/size for clinical + research + eye-bank categories.
- Run clinic upload/download E2E after flip.

---

## Phase 8 — Authentication

- Copy secrets **out-of-band** (password manager / CF Secrets Store) — never commit.
- Keep JWT/cookie settings identical during dual-run.
- Update OIDC redirect URIs when `APP_PUBLIC_URL` changes.
- LDAP remains Node-side (Containers OK; Workers would need redesign).

---

## Phase 9 — API / routing / CORS

1. Point `api.visionemr.net` → Cloudflare Container/Worker route (or CNAME to CF).
2. Set `CORS_ORIGIN` to include `https://corneaclinic.visionemr.net`.
3. Update clinic defaults / CSP allowlist.
4. Rate limiting via Redis URL on new host.
5. Keep DO URL as failover origin until Stage 15 gate.

---

## Phase 10 — Performance (baseline approach)

| Metric | How to measure |
|--------|----------------|
| Current API latency | `curl` `/health/live` + authenticated sync pull from clinic region |
| After CF | Same probes to new origin |
| Cold starts | First request after idle Container |
| Bandwidth | Spaces egress vs R2 (R2 has no egress fees to internet in CF model — verify current pricing) |
| Long-poll | Compare `/sync/wait` completion under load |

Record baselines in `docs/go-live-reports/` before cutover.

---

## Phase 11 — Security

| Control | Action |
|---------|--------|
| HTTPS | Cloudflare edge TLS (already) |
| Headers | Keep clinic-worker CSP/nonce |
| Secrets | CF secrets / DO secrets; rotate after migration |
| WAF | Review `docs/CLOUDFLARE_WAF_REVIEW.md`; tune for API host |
| Turnstile | Optional on Cloud Sign In |
| Zero Trust Access | Protect staging/admin tooling, not primary EMR patients |
| Rate limits | Redis-backed (G6) must remain after Valkey move |
| DDoS | Cloudflare default on proxied hostnames |

---

## Phase 12 — Testing checklist

Before production DNS cutover:

- [ ] Patient registration / New Visit save
- [ ] Patient search / Patient Records (names decrypt)
- [ ] Clinical notes + print
- [ ] Clinical media upload/view
- [ ] Appointments
- [ ] Patient flow board
- [ ] KC / Dry Eye / Keratitis registries
- [ ] Keratoplasty + tissue
- [ ] Eye bank workflows
- [ ] Research overview
- [ ] Auth login/refresh/logout/roles
- [ ] Offline save + reconnect sync
- [ ] Sync push/pull/wait (no stuck pending)
- [ ] `npm run debug:deep` (authenticated)
- [ ] Playwright `smoke:staging` / production-validation
- [ ] Backup restore drill still valid against PG

---

## Phase 13 — Cost comparison (directional)

| Component | Stay on DO | Cloudflare-oriented |
|-----------|------------|---------------------|
| Clinic UI | N/A (already CF) | Workers plan |
| API compute | App Platform XXS | Containers instance hours |
| Postgres | Managed PG (keep) | Same or alternate PG host |
| Media | Spaces + egress | R2 storage (egress savings often material) |
| Redis | Valkey | Upstash / other |
| **Savings driver** | — | Spaces egress → R2; consolidating edge; optional App Platform removal |

**Do not decommission DO until savings verified against invoices after 30 days.**

---

## Phase 14 — Deployment gate

Only when:

1. All Phase 12 tests pass on Cloudflare API + R2 staging.
2. Dual-run: traffic can fail over to DO in &lt;5 minutes.
3. Monitoring green ≥24h on canary (staff accounts) then ≥7 days production.

Steps:

1. Deploy Container API (inactive route).
2. Canary subdomain `api-cf.visionemr.net`.
3. Staff validation.
4. Flip `api.visionemr.net`.
5. Flip media env to R2.
6. Monitor; keep DO App Platform + Spaces + PG online.

---

## Phase 15 — Rollback plan

| Scenario | Action |
|----------|--------|
| API errors after DNS flip | Repoint `api.visionemr.net` to DO App Platform |
| Media 404s | Restore Spaces `MEDIA_S3_*` env; disable Sippy writes if needed |
| Auth broken | Confirm secrets match; rollback API deploy |
| DB corruption (must never happen) | Restore from last verified backup — **never** delete DO PG during validation window |

**Hard rule:** Do not delete DigitalOcean App, Postgres cluster, Spaces bucket, or Valkey until:

- Cloudflare path verified **≥7 days**, and  
- Written approval from clinic owner, and  
- Final encrypted backup archived off-site.

---

## Risk register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | PHI loss during DB move | Critical | Do not move to D1; backup+drill; keep DO PG |
| R2 | Rewrite API to Workers breaks sync | High | Use Containers; no big-bang rewrite |
| R3 | Long-poll timeouts on new host | Medium | Load-test `/sync/wait`; adjust idle timeouts |
| R4 | Cookie/CORS break login | High | Dual-origin CSP; SameSite=None preserved |
| R5 | Incomplete Spaces→R2 copy | High | Checksum audit; Sippy fallback; keep Spaces |
| R6 | Rate-limit bypass without Redis | Medium | Provision Redis before cutting Valkey |
| R7 | Cold starts delay clinic | Medium | Keep min instances / health warmers |
| R8 | Accidental DO deletion | Critical | Checklist + approval gate (Phase 15) |

---

## Migration checklist (summary)

- [x] Phase 1 audit (this document)
- [x] Stage 1: GitHub workflow added (`.github/workflows/deploy-clinic.yml`) — enable after adding `CLOUDFLARE_API_TOKEN` secret
- [ ] Stage 2: Container API on canary hostname
- [ ] Stage 3: Confirm Postgres stays; backup drill
- [ ] Stage 4: **Enable R2 in CF dashboard** → create `cornea-emr-media-staging` → run `npm run migrate:r2:dry-run`
- [ ] Stage 5: Auth secrets + SSO URIs
- [ ] Stage 6: Redis replacement
- [ ] Stage 7: Health probes updated
- [ ] Phase 12 full clinical test matrix
- [ ] Phase 14 canary → production flip
- [ ] Phase 15: 7-day soak → approval → then (and only then) DO teardown

---

## Detailed changelog (planning)

| Date | Change |
|------|--------|
| 2026-08-01 | Initial audit + migration plan authored (`docs/DO_TO_CLOUDFLARE_MIGRATION.md`). No production infra modified. |
| 2026-08-01 | Stage 4: R2 enabled; bucket `cornea-emr-media-staging` created; Wrangler put/get probe OK. Spaces→R2 copy waiting on Spaces API keys in local env. |
| 2026-08-01 | Stage 1 polish: `.github/workflows/deploy-clinic.yml` (requires `CLOUDFLARE_API_TOKEN` secret). |

---

## Recommended next action (do not skip)

**Execute Stage 4 dry-run in a non-prod R2 bucket** (copy a sample of Spaces objects, point a **staging** API instance at R2) while leaving production Spaces untouched.

In parallel: provision a **canary** Cloudflare Container API that still uses **current DO Postgres** (read/write with extreme caution — prefer staging DB clone for first boots).

Do **not** change production DNS until Stage 2 canary passes Phase 12 subset.
