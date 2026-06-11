# Configure Outlook SMTP in apps/api/.env (interactive).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\configure-smtp-outlook.ps1

$ErrorActionPreference = 'Stop'

$EnvFile = Join-Path $PSScriptRoot '..\apps\api\.env'
if (-not (Test-Path $EnvFile)) {
    Write-Error "Not found: $EnvFile"
    exit 1
}

$email = Read-Host 'Outlook email address (SMTP_USER and SMTP_FROM)'
$secure = Read-Host 'Outlook password or App Password' -AsSecureString
$pass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$from = Read-Host "From display name [Cornea Clinic]"
if (-not $from) { $from = 'Cornea Clinic' }

$domain = ($email -split '@')[-1].ToLower()
$isPersonal = $domain -in @('hotmail.com', 'outlook.com', 'live.com', 'msn.com')
$smtpHost = if ($isPersonal) { 'smtp-mail.outlook.com' } else { 'smtp.office365.com' }

if ($isPersonal) {
    Write-Host ''
    Write-Host 'Note: Microsoft often disables SMTP password login for personal' -ForegroundColor Yellow
    Write-Host '@hotmail.com / @outlook.com mailboxes (error 535 5.7.139). If the test' -ForegroundColor Yellow
    Write-Host 'fails, use Gmail with an App Password or a Microsoft 365 business mailbox.' -ForegroundColor Yellow
    Write-Host ''
}

$lines = Get-Content $EnvFile
$map = @{
    'SMTP_HOST'   = $smtpHost
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
