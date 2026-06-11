# IndexedDB → PostgreSQL Migration Tool

Safe one-way migration from the legacy Cornea Clinic browser app (`CorneaClinicDB`) to PostgreSQL. **IndexedDB is never modified or deleted.**

## What it does

| Step | Description |
|------|-------------|
| **Read** | Reads all clinical IndexedDB stores: `patients`, `kpPatients`, `kpTissues` |
| **Export** | Builds a checksum-verified JSON bundle (SHA-256 per store + full bundle) |
| **Upload** | Imports into PostgreSQL via CLI or admin API |
| **Verify** | Compares before/after record counts; fails on import errors |
| **Duplicates** | Detects duplicates within export and against existing DB rows |
| **Report** | Writes JSON + Markdown migration report |

## Components

| File | Purpose |
|------|---------|
| `apps/api/src/services/migrationService.js` | Core migration logic |
| `apps/api/src/db/migrate-indexeddb-cli.js` | CLI entry point |
| `apps/api/src/routes/migration.js` | Admin API (`/api/v1/admin/migration/*`) |
| `scripts/migrate-indexeddb.js` | Repo-root CLI wrapper |
| `scripts/import-legacy-json.js` | Legacy script name → same CLI |
| `Cornea Clinic file/cornea-migration-tool.js` | Browser exporter |
| `Cornea Clinic file/migrate.html` | Standalone migration UI |

## Prerequisites

```bash
cd cornea-emr/apps/api
npm install
npm run migrate    # applies all migrations (000 … 011)
npm run seed       # default clinic + admin
npm run dev        # port 3000
```

Ensure `DATABASE_URL` points to `cornea_emr_v1` (not legacy `cornea_emr`).

## Option A — Browser UI (recommended)

1. Open `Cornea Clinic file/migrate.html` in the same browser profile that has Cornea Clinic data.
2. Click **Read & Export IndexedDB** (or load a saved `.json`).
3. Connect with your admin credentials (sign in via the Cloud Sign In dialog — use the password from `npm run seed` or `npm run reset-admin-password`).
4. Run **Dry-run analyze** to preview duplicates and DB overlap.
5. Click **Import to PostgreSQL** (skips existing records by default).
6. Review the migration report on screen.

Download the `.json` backup before importing — keep it as your archive.

## Option B — CLI

```bash
# Dry-run (no writes)
cd cornea-emr/apps/api
npm run migrate:idb -- ../../path/to/CorneaClinic_Migration.json --dry-run

# Import (skip existing)
npm run migrate:idb -- ../../path/to/export.json

# Force-update existing records
npm run migrate:idb -- ../../path/to/export.json --force-update
```

Reports are written to `cornea-emr/migrations/reports/migration-report-<timestamp>.{json,md}`.

From repo root:

```bash
node scripts/migrate-indexeddb.js path/to/export.json --dry-run
node scripts/import-legacy-json.js path/to/export.json   # same CLI
```

## Option C — Admin API

Requires admin JWT.

```http
POST /api/v1/admin/migration/analyze
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "bundle": { "patients": [...], "kpPatients": [...], "kpTissues": [...] } }
```

```http
POST /api/v1/admin/migration/import
Authorization: Bearer <accessToken>

{
  "bundle": { ... },
  "dryRun": false,
  "skipExisting": true,
  "forceUpdate": false
}
```

Response includes `data` (structured report) and `markdown` (human-readable report).

## Export bundle format

```json
{
  "version": "1.0",
  "exportedAt": "2026-05-29T12:00:00.000Z",
  "source": "CorneaClinicDB",
  "dbVersion": 4,
  "checksums": {
    "patients": "<sha256>",
    "kpPatients": "<sha256>",
    "kpTissues": "<sha256>",
    "bundle": "<sha256>"
  },
  "counts": { "visits": 120, "kpPatients": 5, "kpTissues": 3 },
  "patients": [],
  "kpPatients": [],
  "kpTissues": []
}
```

Legacy exports (plain JSON array of visit records) are also accepted.

## No data loss guarantees

- **IndexedDB**: read-only; export never deletes or overwrites local data.
- **Import**: each record runs in its own transaction; one failure does not roll back others.
- **Skip existing**: default `skipExisting: true` prevents overwriting migrated rows.
- **Checksums**: export integrity verified before import proceeds.
- **Verification**: post-import count check; CLI exits non-zero on failure.
- **Audit**: completion logged to `sync_logs`.

## Duplicate handling

| Type | Behavior |
|------|----------|
| Duplicate local ID in export | Reported; import still attempts each row |
| Duplicate UUID in export | Reported |
| Record already in PostgreSQL | Skipped (default) or updated (`--force-update`) |

Match keys: `legacy_local_id`, visit UUID, `kp_patient_id`, `kp_tissue_id`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty export | Open `migrate.html` in browser with existing Cornea Clinic data |
| Checksum mismatch | Re-export; file may be corrupted or edited |
| Validation failed | Fix missing `patientId` (MRN) on visit records |
| 401 on API | Login first; admin role required |
| Payload too large | Migration routes accept up to 50 MB JSON |
