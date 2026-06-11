# Expose Cornea UI + API on the Tailscale network only (not public).
# Prerequisites: Tailscale installed and signed in on this PC.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup-tailscale-serve.ps1

$ErrorActionPreference = 'Stop'

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
    Write-Error 'Tailscale not found. Run scripts\install-tailscale.ps1 first.'
    exit 1
}

$status = & tailscale status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Tailscale is not connected. Sign in via the system tray icon first.'
    exit 1
}

Write-Host '=== Tailscale serve — clinic UI + API (tailnet only) ===' -ForegroundColor Cyan
Write-Host ''

& tailscale serve --bg http://127.0.0.1:8080
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& tailscale serve --bg --service=api http://127.0.0.1:3000
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Serve status:' -ForegroundColor Green
& tailscale serve status

Write-Host ''
Write-Host 'Invite remote users:  https://login.tailscale.com/admin/users'
Write-Host 'They must install Tailscale and accept the invite.'
Write-Host ''
Write-Host 'Update apps/api/.env with the HTTPS URLs shown above:'
Write-Host '  CORS_ORIGIN=<clinic-serve-url>,http://127.0.0.1:8080'
Write-Host '  APP_PUBLIC_URL=<api-serve-url>'
Write-Host 'Then restart:  Start-ScheduledTask CorneaEMR-API'
Write-Host ''
Write-Host 'Full guide: docs/PRIVATE_REMOTE_ACCESS.md'
