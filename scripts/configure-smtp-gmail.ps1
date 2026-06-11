# Configure Gmail SMTP in apps/api/.env (interactive).
# Requires a Google App Password: https://myaccount.google.com/apppasswords
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\configure-smtp-gmail.ps1

$ErrorActionPreference = 'Stop'

$EnvFile = Join-Path $PSScriptRoot '..\apps\api\.env'
if (-not (Test-Path $EnvFile)) {
    Write-Error "Not found: $EnvFile"
    exit 1
}

Write-Host 'Gmail SMTP uses an App Password (not your normal Google password).'
Write-Host 'Create one at: https://myaccount.google.com/apppasswords'
Write-Host 'Google Account must have 2-Step Verification enabled first.'
Write-Host ''

$email = Read-Host 'Gmail address (SMTP_USER and SMTP_FROM)'
$secure = Read-Host 'Google App Password (16 characters)' -AsSecureString
$pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$from = Read-Host "From display name [Cornea Clinic]"
if (-not $from) { $from = 'Cornea Clinic' }

$lines = Get-Content $EnvFile
$map = @{
    'SMTP_HOST'   = 'smtp.gmail.com'
    'SMTP_PORT'   = '587'
    'SMTP_SECURE' = 'false'
    'SMTP_USER'   = $email
    'SMTP_PASS'   = $pass
    'SMTP_FROM'   = "`"$from <$email>`""
}

$out = @()
$seen = @{}
foreach ($line in $lines) {
    if ($line -match '^\s*(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|SMTP_FROM)\s*=') {
        $key = $Matches[1]
        $out += "$key=$($map[$key])"
        $seen[$key] = $true
    } else {
        $out += $line
    }
}

foreach ($key in $map.Keys) {
    if (-not $seen[$key]) { $out += "$key=$($map[$key])" }
}

Set-Content -Path $EnvFile -Value $out -Encoding UTF8
Write-Host 'SMTP settings saved.' -ForegroundColor Green

$testTo = Read-Host 'Send test email to this address (Enter to skip)'
if ($testTo) {
    $apiDir = Join-Path $PSScriptRoot '..\apps\api'
    Push-Location $apiDir
    try {
        & node scripts/test-smtp.js $testTo
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
        Pop-Location
    }
} else {
    Write-Host 'Test later with:'
    Write-Host "  cd apps\api && npm run test:smtp -- $email"
}
