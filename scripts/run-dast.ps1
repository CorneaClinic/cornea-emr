# Cornea EMR — OWASP ZAP DAST runner (Windows)
param(
    [switch]$PassiveOnly,
    [switch]$SetupUsersOnly
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
    if ($SetupUsersOnly) {
        node scripts/dast/setup-dast-users.mjs
        exit $LASTEXITCODE
    }

    if ($PassiveOnly) {
        $env:DAST_ACTIVE_SCAN = 'false'
    }

    node scripts/dast/run-dast.mjs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
