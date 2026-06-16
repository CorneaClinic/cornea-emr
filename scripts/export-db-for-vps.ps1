# Export PostgreSQL database from the clinic PC for VPS migration.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\export-db-for-vps.ps1
#
# Output: backups/vps-migration_<timestamp>.dump

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile  = Join-Path $RepoRoot 'apps\api\.env'
$BackupDir = Join-Path $RepoRoot 'backups'

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

& (Join-Path $PSScriptRoot 'backup-db.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$latest = Get-ChildItem $BackupDir -Filter '*.dump' |
    Where-Object { $_.Name -notlike 'vps-migration_*' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $latest) {
    Write-Error 'No backup file found after pg_dump.'
    exit 1
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$dest = Join-Path $BackupDir "vps-migration_$stamp.dump"
Copy-Item -Path $latest.FullName -Destination $dest -Force

Write-Host ''
Write-Host '=== VPS migration export ready ===' -ForegroundColor Green
Write-Host "File: $dest"
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  1. Copy this file to your VPS (scp, SFTP, etc.)'
Write-Host '  2. Follow docs/VPS_DEPLOY.md on the VPS'
Write-Host '  3. bash scripts/vps/restore-backup-on-vps.sh /path/to/vps-migration_*.dump'
