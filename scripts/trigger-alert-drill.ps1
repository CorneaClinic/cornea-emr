# G7 — Trigger GitHub Actions "Alert Drill" workflow.
#
# Prerequisites:
#   [Environment]::SetEnvironmentVariable('GITHUB_TOKEN','ghp_...','User')
#   Token needs repo scope: actions:write (classic PAT) or Actions read/write (fine-grained).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\trigger-alert-drill.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\trigger-alert-drill.ps1 -Mode pass

param(
    [ValidateSet('fail', 'pass')]
    [string]$Mode = 'fail',
    [string]$Repo = 'CorneaClinic/cornea-emr',
    [string]$WorkflowFile = 'alert-drill.yml'
)

$ErrorActionPreference = 'Stop'

$token = $env:GITHUB_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }
if (-not $token) {
    Write-Host ''
    Write-Host 'GITHUB_TOKEN not set.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Option A — GitHub UI (no token):'
    Write-Host "  https://github.com/$Repo/actions/workflows/$WorkflowFile"
    Write-Host '  Run workflow → mode:' $Mode
    Write-Host ''
    Write-Host 'Option B — PAT then re-run:'
    Write-Host "  `$env:GITHUB_TOKEN='ghp_your_token'"
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\trigger-alert-drill.ps1 -Mode $Mode"
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    Accept        = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$body = @{
    ref    = 'main'
    inputs = @{ mode = $Mode }
} | ConvertTo-Json

$uri = "https://api.github.com/repos/$Repo/actions/workflows/$WorkflowFile/dispatches"
Write-Host "Triggering Alert Drill (mode=$Mode) on $Repo..." -ForegroundColor Cyan

Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -Body $body -ContentType 'application/json'

Write-Host ''
Write-Host 'Workflow dispatched.' -ForegroundColor Green
Write-Host "Watch: https://github.com/$Repo/actions/workflows/$WorkflowFile"
if ($Mode -eq 'fail') {
    Write-Host ''
    Write-Host 'Expected: workflow FAILS intentionally — check email/GitHub notifications.'
    Write-Host 'Then re-run with -Mode pass to confirm green.'
}
