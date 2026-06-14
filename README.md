# Cornea EMR

Production ophthalmology EMR platform (offline-first, multi-clinic).

## Documentation

- [Migration Blueprint](docs/MIGRATION_BLUEPRINT.md) — legacy field inventory
- [Production Architecture](docs/PRODUCTION_ARCHITECTURE.md) — target system design
- [Production Deploy](docs/PRODUCTION_DEPLOY.md) — HTTPS, Windows service, Docker, SMTP

## Backend foundation (v0.2)

Node.js + Express API with PostgreSQL, structured logging, migrations, and Docker.

### Folder structure (`apps/api`)

```
apps/api/
├── Dockerfile
├── package.json
├── .env.example
├── scripts/
│   ├── e2e-sync-test.js       # End-to-end sync verification (npm run verify:sync)
│   └── verify-live.js         # Live API + ICD verification (npm run verify:api)
└── src/
    ├── index.js               # Entry point
    ├── app.js                 # Express app factory (Helmet, CORS, pino-http)
    ├── server.js              # HTTP server + graceful shutdown
    ├── config/env.js          # Validated environment variables
    ├── core/                  # Logger, errors, validation, crypto, permissions
    │   └── middleware/        # authenticate, authorize, rateLimit, errors, upload
    ├── db/
    │   ├── pool.js            # PostgreSQL connection pool
    │   ├── migrate.js         # Migration runner
    │   ├── seed-cli.js        # First clinic + admin (npm run seed)
    │   ├── reset-admin-password-cli.js  # npm run reset-admin-password
    │   └── migrations/        # 000_foundation … 011_kp_sync_indexes
    ├── routes/                # auth, patients, visits, prescriptions, followups,
    │                          # keratoplasty, tissues, sync, icd, media, admin, health
    └── services/              # Business logic + audit writes
```

### Quick start (local PostgreSQL)

```powershell
cd apps\api
copy .env.example .env
# generate JWT_SECRET / SECRETS_ENCRYPTION_KEY:
node ..\..\scripts\generate-secrets.js
npm install
npm run migrate
npm run seed     # prints the initial admin password once
npm run dev
```

Health: http://127.0.0.1:3000/health

### Frontend (`apps/clinic`)

Offline-first browser EMR (`Cornea.html` + JavaScript modules). Local dev server:

```powershell
npm run clinic:dev
# → http://127.0.0.1:8080/Cornea.html
```

Day-to-day startup: double-click `apps/clinic/start-clinic.bat` — it starts the API, the clinic UI server, and opens the app in the browser.

### Cloudflare deploy (static UI)

```powershell
npm install
npm run deploy:clinic
```

Requires Cloudflare Workers configured for this repo. Static assets are served from `apps/clinic/` (`wrangler.toml`).

### Verification

```powershell
cd apps\api
npm run verify:api    # health, login, ICD status + live WHO search
npm run verify:sync   # full end-to-end sync test suite
```

### Docker

```powershell
cd infra
docker compose up -d --build
docker compose exec api node src/db/migrate-cli.js
```

### Backups

A daily backup of the database runs via the Windows scheduled task `CorneaEMR-DailyBackup` (1:00 PM, runs when the machine is on). Dumps are written to `backups/` (last 30 kept).

**Off-site copies:** set `offsiteDir` in `scripts/backup-config.json` (e.g. a USB drive, network share, or OneDrive folder). Every dump is then AES-256 encrypted and copied there automatically. The key lives in `backup-encryption.key` (repo root, gitignored) — **keep a copy of this key somewhere safe** (password manager, printout, USB kept elsewhere); off-site backups cannot be decrypted without it.

```json
{ "offsiteDir": "E:\\clinic-backups" }
```

Run a backup manually:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
```

Restore a backup (works with plain `.dump` and encrypted `.dump.enc`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-backup.ps1 backups\<file>.dump
powershell -ExecutionPolicy Bypass -File scripts\restore-backup.ps1 "E:\clinic-backups\<file>.dump.enc"
```
