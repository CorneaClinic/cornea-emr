# Create / reset the production E2E monitor user and print GitHub secret values.
#
# Prerequisites:
#   - apps/api/.env.production with DATABASE_URL (DigitalOcean)
#   - scripts/do-db-config.json + DIGITALOCEAN_API_TOKEN (for firewall IP update)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e-user.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e-user.ps1 -SkipFirewallUpdate
#   powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e-user.ps1 -Password 'YourSecurePassword1!'

param(
    [string]$EnvFile = '',
    [string]$Password = '',
    [switch]$SkipFirewallUpdate
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiRoot = Join-Path $RepoRoot 'apps\api'
if (-not $EnvFile) {
    $EnvFile = Join-Path $ApiRoot '.env.production'
}

if (-not (Test-Path $EnvFile)) {
    Write-Host ''
    Write-Host "Missing $EnvFile"
    Write-Host 'Copy DATABASE_URL from DigitalOcean → Databases → Connection details.'
    Write-Host ''
    exit 1
}

if (-not $SkipFirewallUpdate -and (Test-Path (Join-Path $PSScriptRoot 'do-db-config.json'))) {
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'update-do-db-trusted-ip.ps1')
}

$env:ENV_FILE = $EnvFile
if ($Password) {
    $env:STAGING_E2E_PASSWORD = $Password
}

Push-Location $ApiRoot
try {
    node scripts/setup-staging-e2e-user.js
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
    Remove-Item Env:\ENV_FILE -ErrorAction SilentlyContinue
    if ($Password) { Remove-Item Env:\STAGING_E2E_PASSWORD -ErrorAction SilentlyContinue }
}
