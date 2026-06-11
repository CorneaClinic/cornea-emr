# Register Caddy HTTPS reverse proxy to start at user logon.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install-caddy-service.ps1

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

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

$ScriptPath = Join-Path $PSScriptRoot 'start-caddy.ps1'
$TaskName   = 'CorneaEMR-Caddy'

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Script not found: $ScriptPath"
    exit 1
}

$caddy = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $caddy) {
    $portable = Join-Path $PSScriptRoot '..\tools\caddy\caddy.exe'
    if (Test-Path $portable) { $caddy = Get-Item $portable }
}
if (-not $caddy) {
    Write-Error "Caddy not installed. Run: winget install CaddyServer.Caddy  OR  scripts\install-caddy.ps1"
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'Caddy HTTPS reverse proxy for Cornea Clinic (clinic.local / api.local)' `
    -Force | Out-Null

Write-Host ('Registered scheduled task ''' + $TaskName + ''' - Caddy starts at logon.')
Write-Host ('Start now:  Start-ScheduledTask -TaskName ''' + $TaskName + '''')
