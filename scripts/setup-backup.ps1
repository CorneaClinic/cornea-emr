# Cornea EMR — one-time backup & recovery setup (Windows).
# - Verifies pg_dump, folders, encryption key, off-site path
# - Registers daily scheduled tasks (local + production if configured)
# - Optional restore drill
#
# Run as Administrator (recommended for scheduled tasks):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-backup.ps1

param(
    [switch]$SkipDrill,
    [switch]$RunBackupNow
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Scripts = $PSScriptRoot
$BackupDir = Join-Path $RepoRoot 'backups'
$ConfigFile = Join-Path $Scripts 'backup-config.json'
$KeyFile = Join-Path $RepoRoot 'backup-encryption.key'
$ProdEnv = Join-Path $RepoRoot 'apps\api\.env.production'

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "=== $msg ===" -ForegroundColor Cyan
}

Write-Step 'Cornea EMR backup setup'

# pg_dump
$pgDump = $null
$pgRoot = 'C:\Program Files\PostgreSQL'
if (Test-Path $pgRoot) {
    foreach ($v in (Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending)) {
        $c = Join-Path $v.FullName 'bin\pg_dump.exe'
        if (Test-Path $c) { $pgDump = $c; break }
    }
}
if (-not $pgDump) {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { $pgDump = $cmd.Source }
}
if (-not $pgDump) {
    throw 'Install PostgreSQL client tools (pg_dump). Download from postgresql.org or use the same installer as your local server.'
}
Write-Host "pg_dump: $pgDump"

# Folders
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BackupDir 'production') -Force | Out-Null
if (Test-Path $ConfigFile) {
    $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    if ($cfg.offsiteDir) {
        New-Item -ItemType Directory -Path $cfg.offsiteDir -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $cfg.offsiteDir 'production') -Force | Out-Null
        Write-Host "Off-site: $($cfg.offsiteDir)"
    }
} else {
    Write-Host 'WARN: scripts/backup-config.json missing — no off-site copies until you set offsiteDir.'
}

# Encryption key
if (-not (Test-Path $KeyFile)) {
    Write-Host 'Generating backup-encryption.key ...'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $Scripts 'backup-db.ps1') | Out-Null
}
if (Test-Path $KeyFile) {
    Write-Host "Encryption key: $KeyFile"
    Write-Host 'IMPORTANT: Copy backup-encryption.key to a password manager or USB kept elsewhere.' -ForegroundColor Yellow
}

function Register-DailyTask {
    param(
        [string]$Name,
        [string]$ScriptPath,
        [string]$Time = '13:00'
    )
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At $Time
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings `
        -Description 'Cornea EMR automated PostgreSQL backup' -Force | Out-Null
    Write-Host "Scheduled task: $Name (daily $Time)"
}

function Register-MonthlyDrillTask {
    $drillScript = Join-Path $Scripts 'backup-restore-drill.ps1'
    $wrapper = Join-Path $Scripts 'run-monthly-dr-drill.ps1'
    @"
# Cornea EMR — monthly DR drill (Project 5)
`$ErrorActionPreference = 'Stop'
`$RepoRoot = Split-Path -Parent `$PSScriptRoot
Set-Location `$RepoRoot
& powershell -ExecutionPolicy Bypass -File `"$drillScript`" -EnvFile `"`$RepoRoot\apps\api\.env.production`" -SkipFreshBackup
"@ | Set-Content -Path $wrapper -Encoding UTF8
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$wrapper`""
    $trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 4 -DaysOfWeek Sunday -At '03:30'
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
    Register-ScheduledTask -TaskName 'CorneaEMR-MonthlyDRDrill' -Action $action -Trigger $trigger -Settings $settings `
        -Description 'Cornea EMR monthly backup restore drill (Project 5)' -Force | Out-Null
    Write-Host 'Scheduled task: CorneaEMR-MonthlyDRDrill (every 4 weeks Sunday 03:30)'
}

Write-Step 'Scheduled tasks'
Register-DailyTask -Name 'CorneaEMR-DailyBackup' `
    -ScriptPath (Join-Path $Scripts 'backup-db.ps1') `
    -Time '13:00'

if (Test-Path $ProdEnv) {
    Register-DailyTask -Name 'CorneaEMR-ProductionBackup' `
        -ScriptPath (Join-Path $Scripts 'backup-production.ps1') `
        -Time '02:00'
    Write-Host 'Production cloud backup: configured (.env.production found)'
} else {
    Write-Host 'Production cloud backup: NOT configured — create apps\api\.env.production (see .env.production.example)'
}

Register-MonthlyDrillTask

if ($RunBackupNow) {
    Write-Step 'Running local backup now'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $Scripts 'backup-db.ps1')
    if (Test-Path $ProdEnv) {
        Write-Step 'Running production backup now'
        & powershell -ExecutionPolicy Bypass -File (Join-Path $Scripts 'backup-production.ps1')
    }
}

if (-not $SkipDrill) {
    Write-Step 'Restore drill (local backup)'
    Write-Host 'If this fails with CREATEDB, run once in psql as postgres:'
    Write-Host '  ALTER USER cornea CREATEDB;'
    Write-Host ''
    try {
        & powershell -ExecutionPolicy Bypass -File (Join-Path $Scripts 'backup-restore-drill.ps1') -SkipFreshBackup
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        Write-Host 'Drill incomplete — backups still run; fix CREATEDB when convenient.'
    }
}

Write-Step 'Done'
Write-Host @"

Backup locations:
  Local DB:       backups\*.dump
  Cloud DB:       backups\production\*.dump  (after .env.production is set)
  Off-site:       see scripts\backup-config.json offsiteDir (+ \production)

DigitalOcean also keeps managed DB snapshots (Control Panel -> Databases -> Backups).

Docs: docs\BACKUP_RECOVERY.md

"@
