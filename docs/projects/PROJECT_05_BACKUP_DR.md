# Project 5 — Backup & Disaster Recovery

**Status:** Complete  
**Scope:** Automated backup verification, restore testing, media backup checks, recovery reports, dashboard, monthly drills.

---

## What shipped

### Verification & reporting
| Component | Purpose |
|-----------|---------|
| `scripts/verify-backup-dr.mjs` | Eight checks (B1–B8); writes `backups/dr-reports/latest.json` |
| `scripts/lib/backup-dr-checks.mjs` | Shared helpers (tested) |
| `scripts/generate-dr-dashboard.mjs` | HTML dashboard → `backups/dr-reports/index.html` |
| `scripts/log-dr-drill.mjs` | Append drill result to `backups/dr-drill.log` |
| `scripts/backup-post-verify.ps1` | Post-dump catalog + off-site size check (auto from `backup-db.ps1`) |

### API (cloud media DR)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/admin/dr/status` | Media stats + integrity sample (requires `audit:read`) |

### Automation
- `CorneaEMR-MonthlyDRDrill` scheduled task (via `setup-backup.ps1`) — every 4 weeks Sunday 03:30
- `backup-restore-drill.ps1` logs PASS to `dr-drill.log` on success

### npm scripts
```powershell
npm run verify:backup-dr    # full verification + JSON report
npm run dr:dashboard        # regenerate HTML dashboard
npm run drill:monthly       # manual monthly drill (production env)
npm run drill:log-pass      # record drill PASS manually
```

---

## Checks (B1–B8)

| ID | Check |
|----|-------|
| B1 | Production `backup.log` OK within 48h |
| B2 | Latest `.dump` in `backups/production/` |
| B3 | `pg_restore -l` catalog valid |
| B4 | Off-site `.dump.enc` matches dump size |
| B5 | `backup-encryption.key` present |
| B6 | Restore drill PASS within 30 days |
| B7 | Windows scheduled tasks (`CorneaEMR-*`) |
| B8 | Cloud media integrity sample (needs `SEED_ADMIN_PASSWORD`) |

---

## Operator workflow

1. **Daily:** `CorneaEMR-ProductionBackup` task (clinic PC)
2. **Weekly:** Review `backups/production/backup.log`
3. **Monthly:** `npm run drill:monthly` or wait for `CorneaEMR-MonthlyDRDrill`
4. **Anytime:** `npm run verify:backup-dr` → open `backups/dr-reports/index.html`

---

## RPO / RTO targets

| Metric | Target |
|--------|--------|
| RPO | 24 hours (daily backup + DO managed snapshots) |
| RTO | 4 hours (documented restore procedure) |
| Drill interval | 30 days |

---

## Rollback

Revert scripts and API route; scheduled tasks can be removed from Task Scheduler. No database migration.

---

## Readiness impact

Estimated **+8% operational readiness** — automated verification, drill logging, media integrity API, and ops dashboard.
