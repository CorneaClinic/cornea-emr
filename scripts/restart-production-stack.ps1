# Restart Cornea EMR production services (PostgreSQL, API, Cloudflare Tunnel).
# Run on the clinic PC when cloud sign-in fails with a network error.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\restart-production-stack.ps1

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
$needsAdmin = $false

function Test-Admin {
    ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host 'Requesting Administrator privileges (UAC)... Click Yes on the prompt.'
    $proc = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', $scriptPath
    )
    exit $proc.ExitCode
}

$ApiUrl = 'https://api.visionemr.net'
$LocalHealth = 'http://127.0.0.1:3000/health/live'

function Wait-HttpOk {
    param([string]$Url, [int]$Seconds = 30)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($res.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

Write-Host '=== Cornea EMR — restart production stack ===' -ForegroundColor Cyan

# PostgreSQL (Windows service name may vary by version)
$pgService = Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'postgresql*' -and $_.Status -ne 'Running' } |
    Select-Object -First 1
if ($pgService) {
    Write-Host "Starting PostgreSQL ($($pgService.Name))..."
    Start-Service $pgService.Name
    Start-Sleep -Seconds 3
}

Write-Host 'Restarting CorneaEMR-API...'
Stop-ScheduledTask -TaskName 'CorneaEMR-API' -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'CorneaEMR-API'
if (-not (Wait-HttpOk $LocalHealth)) {
    Write-Host "WARNING: Local API did not respond at $LocalHealth" -ForegroundColor Yellow
} else {
    Write-Host "Local API OK: $LocalHealth" -ForegroundColor Green
}

Write-Host 'Restarting CorneaEMR-CloudflareTunnel...'
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Stop-ScheduledTask -TaskName 'CorneaEMR-CloudflareTunnel' -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'CorneaEMR-CloudflareTunnel'
Start-Sleep -Seconds 5
if (-not (Wait-HttpOk "$ApiUrl/health/live" 60)) {
    Write-Host "WARNING: Public API did not respond at $ApiUrl/health/live" -ForegroundColor Yellow
    Write-Host 'Ensure this PC is online and cloudflared is logged in (cloudflared tunnel login).' -ForegroundColor Yellow
} else {
    Write-Host "Public API OK: $ApiUrl/health/live" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Done. Try cloud sign-in again at https://corneaclinic.visionemr.net' -ForegroundColor Cyan
