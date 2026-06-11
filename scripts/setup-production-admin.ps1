# One-time production setup — requires Administrator (UAC prompt).
# Registers scheduled tasks, updates hosts file, trusts Caddy local CA.
#
# Usage:
#   Double-click setup-production-admin.bat
#   or: powershell -ExecutionPolicy Bypass -File scripts\setup-production-admin.ps1

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Requesting Administrator privileges (UAC)... Click Yes on the prompt.'
    $proc = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', $scriptPath
    )
    exit $proc.ExitCode
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '=== Cornea EMR production setup (Administrator) ===' -ForegroundColor Cyan

# 1. Hosts file
& (Join-Path $PSScriptRoot 'setup-hosts.ps1')

# 2. Trust Caddy local CA (if Caddy is installed)
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')
$caddy = Get-Command caddy -ErrorAction SilentlyContinue
if ($caddy) {
    Write-Host 'Trusting Caddy local CA (for https://clinic.local)...'
    & caddy trust 2>&1 | Write-Host
} else {
    Write-Host 'Caddy not in PATH yet — restart terminal after install, then run: caddy trust' -ForegroundColor Yellow
}

# 3. Scheduled tasks
try {
    & (Join-Path $PSScriptRoot 'install-api-service.ps1')
    & (Join-Path $PSScriptRoot 'install-caddy-service.ps1')
    Start-ScheduledTask -TaskName 'CorneaEMR-API' -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName 'CorneaEMR-Caddy' -ErrorAction SilentlyContinue
} catch {
    Write-Host "Scheduled tasks could not be registered: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host 'Run these manually in this Admin window:' -ForegroundColor Yellow
    Write-Host "  & '$PSScriptRoot\install-api-service.ps1'"
    Write-Host "  & '$PSScriptRoot\install-caddy-service.ps1'"
}

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host '  https://clinic.local/Cornea.html'
Write-Host '  https://api.local/health/live'
Write-Host ''
Write-Host 'Closing in 8 seconds...'
Start-Sleep -Seconds 8
