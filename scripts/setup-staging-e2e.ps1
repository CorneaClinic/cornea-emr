# Print or run GitHub setup for nightly staging E2E secrets.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e.ps1 -Email you@clinic.com -Password 'YourPassword'
#   powershell -ExecutionPolicy Bypass -File scripts\setup-staging-e2e.ps1 -Email you@clinic.com -Password '...' -Apply

param(
    [Parameter(Mandatory)]
    [string]$Email,
    [Parameter(Mandatory)]
    [string]$Password,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '=== Staging E2E secrets (e2e-nightly.yml) ===' -ForegroundColor Cyan
Write-Host ''

if ($Apply) {
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) {
        Write-Host 'gh CLI not found. Install GitHub CLI or set secrets in the repo UI.' -ForegroundColor Red
        Write-Host 'https://github.com/CorneaClinic/cornea-emr/settings/secrets/actions'
        exit 1
    }
    gh secret set STAGING_E2E_EMAIL --body $Email
    gh secret set STAGING_E2E_PASSWORD --body $Password
    Write-Host 'Secrets set. Trigger: GitHub Actions -> E2E Nightly -> Run workflow' -ForegroundColor Green
} else {
    Write-Host 'Run with -Apply after reviewing, or paste into GitHub -> Settings -> Secrets -> Actions:'
    Write-Host ''
    Write-Host "  STAGING_E2E_EMAIL    = $Email"
    Write-Host '  STAGING_E2E_PASSWORD = (hidden)'
    Write-Host ''
    Write-Host '  gh secret set STAGING_E2E_EMAIL --body "' + $Email + '"'
    Write-Host "  gh secret set STAGING_E2E_PASSWORD --body '<password>'"
    Write-Host ''
    Write-Host 'Local test:'
    Write-Host "  `$env:STAGING_E2E_EMAIL='$Email'"
    Write-Host '  $env:STAGING_E2E_PASSWORD=''...'''
    Write-Host '  npm run smoke:staging'
}

Write-Host ''
