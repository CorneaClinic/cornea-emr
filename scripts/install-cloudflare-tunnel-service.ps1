# Run Cloudflare Tunnel at logon (public internet access).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install-cloudflare-tunnel-service.ps1
#
# Requires infra\cloudflared-config.yml (run setup-cloudflare-tunnel.ps1 first).

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Requesting Administrator privileges (UAC)...'
    $proc = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $scriptPath
    )
    exit $proc.ExitCode
}

$Config = Join-Path $PSScriptRoot '..\infra\cloudflared-config.yml'
$TaskName = 'CorneaEMR-CloudflareTunnel'

if (-not (Test-Path $Config)) {
    Write-Error "Config not found: $Config`nRun scripts\setup-cloudflare-tunnel.ps1 first."
    exit 1
}

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Error 'cloudflared not in PATH. Run scripts\install-cloudflared.ps1'
    exit 1
}

$CaddyExe = $cloudflared.Source
$ConfigFull = (Resolve-Path $Config).Path

$action = New-ScheduledTaskAction `
    -Execute $CaddyExe `
    -Argument "tunnel --config `"$ConfigFull`" run"

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'Cloudflare Tunnel — public HTTPS for Cornea Clinic' `
    -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

Write-Host "Registered and started scheduled task '$TaskName'." -ForegroundColor Green
Write-Host 'Tunnel runs at every logon while this PC is on.'
