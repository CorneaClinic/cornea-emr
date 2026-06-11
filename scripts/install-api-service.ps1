# Register Cornea EMR API to start automatically at user logon (production mode).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install-api-service.ps1
#
# Remove:
#   Unregister-ScheduledTask -TaskName 'CorneaEMR-API' -Confirm:$false

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

$ScriptPath = Join-Path $PSScriptRoot 'run-production-api.ps1'
$TaskName   = 'CorneaEMR-API'

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Script not found: $ScriptPath"
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
    -Description 'Cornea EMR API (production, NODE_ENV=production)' `
    -Force | Out-Null

Write-Host ('Registered scheduled task ''' + $TaskName + ''' - API starts at logon.')
Write-Host ('Start now:  Start-ScheduledTask -TaskName ''' + $TaskName + '''')
Write-Host ('Stop:       Stop-ScheduledTask -TaskName ''' + $TaskName + '''')
