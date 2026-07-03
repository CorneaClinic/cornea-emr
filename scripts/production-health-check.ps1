# G7 — mirror of .github/workflows/production-health.yml (run locally or from Task Scheduler).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\production-health-check.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\production-health-check.ps1 -RunStagingSmoke

param(
    [string]$ApiUrl = 'https://corneaclinic-2zfpt.ondigitalocean.app',
    [string]$ClinicUrl = 'https://corneaclinic.visionemr.net/Cornea',
    [switch]$RunStagingSmoke
)

$ErrorActionPreference = 'Stop'
$ApiUrl = $ApiUrl.TrimEnd('/')
$ClinicUrl = $ClinicUrl.TrimEnd('/')
$failed = 0

function Test-Endpoint([string]$Name, [scriptblock]$Check) {
    try {
        if (& $Check) {
            Write-Host "  OK  $Name" -ForegroundColor Green
        } else {
            Write-Host "  FAIL $Name" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host "  FAIL $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host ''
Write-Host '=== Production health check (G7) ===' -ForegroundColor Cyan
Write-Host "API:    $ApiUrl"
Write-Host "Clinic: $ClinicUrl"
Write-Host ''

Test-Endpoint 'API /health/live' {
    $apis = @(
        'https://corneaclinic-2zfpt.ondigitalocean.app',
        $ApiUrl
    ) | ForEach-Object { $_.TrimEnd('/') } | Select-Object -Unique
    foreach ($base in $apis) {
        if (-not $base) { continue }
        try {
            $r = Invoke-WebRequest -Uri "$base/health/live" -UseBasicParsing -TimeoutSec 30
            $j = $r.Content | ConvertFrom-Json
            if ($r.StatusCode -eq 200 -and $j.ok -eq $true) { return $true }
        } catch { continue }
    }
    return $false
}

Test-Endpoint 'API /health (database)' {
    $apis = @(
        'https://corneaclinic-2zfpt.ondigitalocean.app',
        $ApiUrl
    ) | ForEach-Object { $_.TrimEnd('/') } | Select-Object -Unique
    foreach ($base in $apis) {
        if (-not $base) { continue }
        try {
            $r = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing -TimeoutSec 30
            $j = $r.Content | ConvertFrom-Json
            if ($r.StatusCode -eq 200 -and $j.checks.database.ok -eq $true) { return $true }
        } catch { continue }
    }
    return $false
}

Test-Endpoint 'G6 Redis rate limits (checks.redis.mode=redis)' {
    $apis = @(
        'https://corneaclinic-2zfpt.ondigitalocean.app',
        $ApiUrl
    ) | ForEach-Object { $_.TrimEnd('/') } | Select-Object -Unique
    foreach ($base in $apis) {
        if (-not $base) { continue }
        try {
            $r = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing -TimeoutSec 30
            $j = $r.Content | ConvertFrom-Json
            if ($j.checks.redis.mode -eq 'redis' -and $j.checks.redis.ok -eq $true) { return $true }
        } catch { continue }
    }
    return $false
}

Test-Endpoint 'Clinic UI reachable' {
    $candidates = @(
        "$ClinicUrl/health.json",
        $ClinicUrl,
        "$ClinicUrl/Cornea.html",
        'https://corneaclinic.visionemr.net/Cornea/health.json',
        'https://corneaclinic.visionemr.net/Cornea',
        'https://corneaclinic.visionemr.net/Cornea/Cornea.html'
    ) | ForEach-Object { $_.TrimEnd('/') } | Where-Object { $_ } | Select-Object -Unique
    foreach ($url in $candidates) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch {
            continue
        }
    }
    return $false
}

$backupLog = Join-Path (Split-Path -Parent $PSScriptRoot) 'backups\production\backup.log'
if (Test-Path $backupLog) {
    Test-Endpoint 'Backup log (last entry OK within 48h)' {
        $lastOk = Get-Content $backupLog | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}.*\sOK:' } | Select-Object -Last 1
        if (-not $lastOk) { return $false }
        if ($lastOk -match '^(\d{4}-\d{2}-\d{2})') {
            $d = [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', $null)
            return ((Get-Date) - $d).TotalHours -le 48
        }
        return $false
    }
} else {
    Write-Host '  SKIP backup log (not found locally)' -ForegroundColor Yellow
}

if ($RunStagingSmoke) {
    Write-Host ''
    Write-Host '=== Staging smoke (Playwright) ===' -ForegroundColor Cyan
    if (-not $env:STAGING_E2E_EMAIL -or -not $env:STAGING_E2E_PASSWORD) {
        Write-Host '  SKIP - set STAGING_E2E_EMAIL and STAGING_E2E_PASSWORD' -ForegroundColor Yellow
    } else {
        Push-Location (Split-Path -Parent $PSScriptRoot)
        try {
            npm run test:e2e:staging
            if ($LASTEXITCODE -ne 0) { $failed++ }
        } finally {
            Pop-Location
        }
    }
}

Write-Host ''
if ($failed -eq 0) {
    Write-Host 'HEALTH CHECK PASSED' -ForegroundColor Green
    exit 0
}
Write-Host "HEALTH CHECK FAILED ($failed checks)" -ForegroundColor Red
exit 1
