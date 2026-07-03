# Phase 1 immediate priorities — run all verifiable gates locally.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\phase1-immediate-priorities.ps1
#
# Operator-only (require secrets / elevated shell):
#   G6  npm run setup:do-valkey          (DIGITALOCEAN_API_TOKEN)
#   G3  npm run verify:password-reset -- you@email.com
#   G1  npm run drill:restore-local -- -PostgresPassword YOUR_PG_PASSWORD
#   G7  GitHub Actions → Alert Drill → mode: fail (notification test)

param(
    [switch]$SkipE2e,
    [switch]$SetupValkey
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$failed = 0

function Step([string]$Name, [scriptblock]$Action) {
    Write-Host ''
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    try {
        & $Action
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            Write-Host "FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
            $script:failed++
        } else {
            Write-Host 'OK' -ForegroundColor Green
        }
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host ''
Write-Host 'VisionEMR Phase 1 — Immediate Priorities' -ForegroundColor Yellow
Write-Host "Repo: $RepoRoot"

if ($SetupValkey) {
    Step 'G6 — DO Valkey + REDIS_URL' {
        Push-Location $RepoRoot
        npm run setup:do-valkey
        Pop-Location
    }
}

Step 'Unit tests (G4 partial)' {
    Push-Location $RepoRoot
    npm run test:unit
    Pop-Location
}

Step 'Global debug' {
    Push-Location $RepoRoot
    npm run debug:global
    Pop-Location
}

Step 'Production health (G7 partial)' {
    & (Join-Path $PSScriptRoot 'production-health-check.ps1')
}

Step 'Log stabilization gate snapshot' {
    Push-Location $RepoRoot
    npm run phase0:status
    Pop-Location
}

if (-not $SkipE2e) {
    Step 'Playwright E2E (G4 — local, needs Docker PG via CI or manual API)' {
        Write-Host 'Skipping full Playwright here — run: npm run test:e2e (with API + PG) or rely on CI e2e-playwright job' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host '--- Operator checklist (manual) ---' -ForegroundColor Yellow
Write-Host 'G6  npm run setup:do-valkey  (if Redis check failed)'
Write-Host 'G7  GitHub → Actions → Alert Drill → Run workflow → mode: fail'
Write-Host 'G3  npm run verify:password-reset -- YOUR_PRODUCTION_EMAIL'
Write-Host 'G1  npm run drill:restore-local -- -PostgresPassword YOUR_PG_PASSWORD'
Write-Host 'G5  npm run test:sync-matrix  (API running locally or in CI)'
Write-Host ''

if ($failed -eq 0) {
    Write-Host 'PHASE 1 LOCAL CHECKS COMPLETE' -ForegroundColor Green
    exit 0
}
Write-Host "PHASE 1 LOCAL CHECKS: $failed step(s) failed" -ForegroundColor Red
exit 1
