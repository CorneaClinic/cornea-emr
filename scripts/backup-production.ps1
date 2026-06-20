# Cornea EMR — backup the LIVE cloud database (DigitalOcean PostgreSQL).
# Requires apps/api/.env.production with DATABASE_URL from the DO control panel.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-production.ps1

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ProdEnv = Join-Path $RepoRoot 'apps\api\.env.production'
$Example = Join-Path $RepoRoot 'apps\api\.env.production.example'

if (-not (Test-Path $ProdEnv)) {
    Write-Host ""
    Write-Host "Production backup is not configured yet."
    Write-Host ""
    Write-Host "1. DigitalOcean -> Databases -> your cluster -> Connection details"
    Write-Host "2. Copy the connection string (postgresql://...)"
    Write-Host "3. Save as: apps\api\.env.production"
    Write-Host "   DATABASE_URL=postgresql://doadmin:PASSWORD@host:25060/defaultdb?sslmode=require"
    Write-Host ""
    if (Test-Path $Example) {
        Write-Host "See template: apps\api\.env.production.example"
    }
    exit 1
}

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-db.ps1') `
    -EnvFile $ProdEnv `
    -OutputSubdir 'production'
