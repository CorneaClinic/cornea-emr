# Backup & recovery — Cornea EMR

Your clinic has **two** databases to protect:

| Database | Where | What it holds |
|----------|--------|----------------|
| **Local** | `127.0.0.1` (this PC) | IndexedDB sync cache / dev copy |
| **Production (cloud)** | DigitalOcean PostgreSQL | **Live patient data** for all users |

Both should be backed up. Local backup alone does **not** replace cloud backup.

---

## Quick status check

```powershell
cd C:\Users\Hp\Documents\trae_projects\cornea-emr

# Latest local backup log
Get-Content backups\backup.log -Tail 5

# Latest production backup log (after cloud backup is configured)
Get-Content backups\production\backup.log -Tail 5

# Scheduled tasks
Get-ScheduledTask -TaskName 'CorneaEMR-*' | Format-Table TaskName, State
```

Expected tasks:

- `CorneaEMR-DailyBackup` — local DB, daily ~1:00 PM
- `CorneaEMR-ProductionBackup` — cloud DB, daily ~2:00 AM (after setup)

---

## One-time setup

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-backup.ps1 -RunBackupNow
```

This verifies tools, folders, encryption key, scheduled tasks, and runs a restore drill.

### Production (cloud) backup — required for live data

1. Open [DigitalOcean](https://cloud.digitalocean.com) → **Databases** → your PostgreSQL cluster.
2. **Connection details** → choose **Public network** (not VPC / private).
   - **Public host** looks like `db-pgsql-....ondigitalocean.com` — use this for clinic PC backups.
   - **Private host** looks like `private-db-pgsql-....ondigitalocean.com` — only reachable from App Platform / Droplets in the same VPC. It will **time out** from your Windows PC.
3. **Settings** → **Trusted sources** → add your clinic PC public IP (or your App Platform app if backups run in cloud).
4. Create `apps/api/.env.production` (never commit):

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@db-pgsql-....ondigitalocean.com:25060/defaultdb?sslmode=require
```

Use the user/password from **Public network** connection details (e.g. `Corneaclinic` or `doadmin` — whichever DO shows for that endpoint).

### Dynamic IP (ISP changes your public IP often)

If `pg_dump` or `backup-production.ps1` works one day and times out the next, your IP left DigitalOcean **Trusted sources**.

**Recommended layers (use more than one):**

| Layer | What it does |
|-------|----------------|
| **A — DO managed backups** | DigitalOcean → Databases → your cluster → **Backups**. Runs automatically; no clinic PC IP needed. |
| **B — Auto-update firewall** | Script updates trusted IP before each backup (below). |
| **C — Cloud-side backup** | Run `pg_dump` from App Platform / a small Droplet in the same VPC (uses private DB host; no PC IP). |

#### B — Auto-update trusted IP (clinic PC backups)

1. DigitalOcean → **API** → **Generate New Token** (read/write).
2. Databases → your cluster → copy **cluster UUID** from the URL or Overview.
3. Copy `scripts/do-db-config.json.example` → `scripts/do-db-config.json` and set `databaseId`.
4. Store token in your Windows user environment (never commit):

```powershell
[Environment]::SetEnvironmentVariable('DIGITALOCEAN_API_TOKEN', 'dop_v1_YOUR_TOKEN', 'User')
```

5. Test:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\update-do-db-trusted-ip.ps1
```

6. `backup-production.ps1` calls this automatically when `do-db-config.json` exists.

The script **keeps** App Platform / droplet firewall rules and **replaces** `ip_addr` rules with your current public IP (+ any `extraTrustedIps` in config).

**Do not** open the database to `0.0.0.0/0` — that exposes PHI to the entire internet.

4. Test:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-production.ps1
```

5. Re-run setup to register the production scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-backup.ps1
```

### Off-site copies (already configured)

`scripts/backup-config.json` points to an encrypted off-site folder. Every dump is copied as `.dump.enc` using `backup-encryption.key`.

**Keep a copy of `backup-encryption.key` outside this PC** (password manager, USB in another location). Without it, off-site files cannot be restored.

---

## Manual backup

```powershell
# Local database
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1

# Production cloud database
powershell -ExecutionPolicy Bypass -File scripts\backup-production.ps1
```

Files are kept in `backups/` (last 30). Production dumps go to `backups/production/`.

---

## Restore drill (test without touching production)

Proves a backup file can be restored and row counts match:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1
```

If you see `permission denied to create database`, grant once (as postgres superuser):

```sql
ALTER USER cornea CREATEDB;
```

Or run: `backup-restore-drill.ps1 -PostgresUser postgres` (set `PGPASSWORD` for postgres first).

---

## Restore production (emergency)

**Warning:** This overwrites the target database.

### From a local `.dump` file

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-backup.ps1 backups\production\YOUR_FILE.dump
```

Uses `DATABASE_URL` from `apps/api/.env` by default. For cloud restore, temporarily point `.env` at production or extend the script with `-EnvFile`.

### From encrypted off-site copy

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-backup.ps1 "C:\Users\Hp\Documents\CorneaEMR-Offsite-Backups\production\YOUR_FILE.dump.enc"
```

### From DigitalOcean managed backups

Control Panel → Databases → your cluster → **Backups** → restore to a new cluster or point-in-time recovery (depends on your DO plan).

---

## Recovery checklist

1. Identify failure (API down vs data loss vs wrong edit).
2. For data loss: use **newest production** `.dump` or DO snapshot.
3. Run restore drill on a copy before overwriting live DB if unsure.
4. Restart API on DigitalOcean after DB restore.
5. Have users hard-refresh the clinic app and sign in again.

---

## What is gitignored (never commit)

- `backups/` — patient data
- `backup-encryption.key`
- `apps/api/.env.production`
