# G1 - prepare local PostgreSQL and run full backup restore drill.
#
# Requires: PostgreSQL 18 installed, service running (Administrator to start).
#
# Usage (PowerShell as Administrator for first run):
#   net start postgresql-x64-18
#   powershell -ExecutionPolicy Bypass -File scripts\setup-restore-drill-local.ps1
#
# Optional:
#   -PostgresPassword 'your-postgres-superuser-password'
#   -SkipFreshBackup

param(
    [string]$PostgresPassword = $env:POSTGRES_PASSWORD,
    [string]$DbPassword = 'cornea_dev',
    [switch]$SkipFreshBackup
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiRoot = Join-Path $RepoRoot 'apps\api'
$LocalEnv = Join-Path $ApiRoot '.env.local'
$PgService = 'postgresql-x64-18'

Write-Host ''
Write-Host '=== G1 full restore drill setup ===' -ForegroundColor Cyan

$svc = Get-Service -Name $PgService -ErrorAction SilentlyContinue
if (-not $svc) {
    throw "PostgreSQL service '$PgService' not found. Install PostgreSQL 18 first."
}
if ($svc.Status -ne 'Running') {
    Write-Host "PostgreSQL is stopped. Start it (Administrator):" -ForegroundColor Yellow
    Write-Host "  net start $PgService"
    Write-Host ''
    try {
        Start-Service $PgService -ErrorAction Stop
        Write-Host "Started $PgService." -ForegroundColor Green
    } catch {
        throw "Cannot start PostgreSQL - run this script from an elevated PowerShell: net start $PgService"
    }
}

if (-not $PostgresPassword) {
    Write-Host ''
    Write-Host 'PostgreSQL superuser password required (from PostgreSQL 18 install).' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'PowerShell:'
    Write-Host "  `$env:POSTGRES_PASSWORD='YourRealPassword'"
    Write-Host '  npm run drill:restore-local'
    Write-Host ''
    Write-Host 'CMD (Command Prompt):'
    Write-Host '  set POSTGRES_PASSWORD=YourRealPassword'
    Write-Host '  npm run drill:restore-local'
    Write-Host ''
    Write-Host 'Or pass password directly (PowerShell or CMD):'
    Write-Host '  npm run drill:restore-local -- -PostgresPassword YourRealPassword'
    Write-Host ''
    Write-Host 'Skip cloud backup if you already have a fresh .dump:'
    Write-Host '  npm run drill:restore-local -- -PostgresPassword YourRealPassword -SkipFreshBackup'
    exit 1
}

Write-Host 'Creating local DB user/database (if needed)...'
$env:POSTGRES_PASSWORD = $PostgresPassword
$env:DB_PASSWORD = $DbPassword
Push-Location $RepoRoot
try {
    node scripts/setup-local-db.js
    if ($LASTEXITCODE -ne 0) {
        throw "setup-local-db.js failed - check POSTGRES_PASSWORD (the password you chose when installing PostgreSQL 18, not the placeholder text)."
    }
} finally {
    Pop-Location
}

$localUrl = "postgres://cornea:$DbPassword@127.0.0.1:5432/cornea_emr"
@"
# Local PostgreSQL for backup restore drills - DO NOT COMMIT.
DATABASE_URL=$localUrl
"@ | Set-Content -Path $LocalEnv -Encoding UTF8
Write-Host "Wrote $LocalEnv"

$drillArgs = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', (Join-Path $PSScriptRoot 'backup-restore-drill.ps1'),
    '-EnvFile', (Join-Path $ApiRoot '.env.production')
)
if ($SkipFreshBackup) { $drillArgs += '-SkipFreshBackup' }

$env:PGPASSWORD = $PostgresPassword
$drillArgs += '-PostgresUser', 'postgres'

& powershell @drillArgs
exit $LASTEXITCODE
