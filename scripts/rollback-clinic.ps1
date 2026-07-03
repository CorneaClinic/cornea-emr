# Roll back Cloudflare clinic UI to a previous git commit (apps/clinic only).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\rollback-clinic.ps1 -List
#   powershell -ExecutionPolicy Bypass -File scripts\rollback-clinic.ps1 -Commit 9989779
#
# Does NOT change the main branch — checks out apps/clinic from the commit, deploys, then restores.

param(
    [string]$Commit = '',
    [switch]$List
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Show-RecentClinicCommits {
    Write-Host ''
    Write-Host 'Recent commits touching apps/clinic:' -ForegroundColor Cyan
    git log -15 --oneline -- apps/clinic
    Write-Host ''
    Write-Host 'Use: npm run rollback:clinic -- -Commit <sha>' -ForegroundColor Yellow
}

if ($List -or -not $Commit) {
    Show-RecentClinicCommits
    if (-not $Commit) { exit 0 }
}

$dirty = git status --porcelain -- apps/clinic
if ($dirty) {
    Write-Host 'ERROR: apps/clinic has uncommitted changes. Commit or stash first.' -ForegroundColor Red
    exit 1
}

if (-not (git cat-file -e "${Commit}^{commit}" 2>$null)) {
    Write-Host "ERROR: Commit not found: $Commit" -ForegroundColor Red
    exit 1
}

$short = git rev-parse --short $Commit
Write-Host ''
Write-Host "Rolling back clinic UI to commit $short ..." -ForegroundColor Cyan
Write-Host (git log -1 --oneline $Commit)
Write-Host ''

try {
    git checkout $Commit -- apps/clinic
    npm run deploy:clinic
    if ($LASTEXITCODE -ne 0) { throw "wrangler deploy failed (exit $LASTEXITCODE)" }
    Write-Host ''
    Write-Host "Clinic UI deployed from commit $short." -ForegroundColor Green
    Write-Host 'Users: hard refresh (Ctrl+Shift+R) at the clinic URL.' -ForegroundColor Yellow
} finally {
    git checkout HEAD -- apps/clinic
    Write-Host 'Restored apps/clinic to current branch working tree.' -ForegroundColor DarkGray
}
