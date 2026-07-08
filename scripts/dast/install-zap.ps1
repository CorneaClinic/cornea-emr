# Installs OWASP ZAP via winget (pulls Eclipse Temurin JRE 17 as dependency).
# Run from an elevated PowerShell, or approve each UAC prompt when winget asks.
$ErrorActionPreference = 'Stop'

function Install-WingetPackage {
    param([string]$Id, [string]$Label)
    Write-Host "Installing $Label ($Id)..."
    winget install --id $Id -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget install $Id failed (exit $LASTEXITCODE). Approve the UAC prompt or run PowerShell as Administrator."
    }
}

try {
    Install-WingetPackage -Id 'ZAP.ZAP' -Label 'OWASP ZAP'
} catch {
    Write-Host $_.Exception.Message
    Write-Host ''
    Write-Host 'Manual install:'
    Write-Host '  1. Open PowerShell as Administrator'
    Write-Host '  2. winget install ZAP.ZAP'
    Write-Host '  3. Restart terminal, then: npm run dast:scan'
    exit 1
}

$zapBat = 'C:\Program Files\ZAP\Zed Attack Proxy\zap.bat'
if (Test-Path $zapBat) {
    Write-Host "ZAP installed: $zapBat"
} else {
    $alt = Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Filter zap.bat -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($alt) {
        Write-Host "ZAP installed: $($alt.FullName)"
        Write-Host "Set ZAP_PATH=$($alt.FullName)"
    } else {
        Write-Host 'ZAP installed but zap.bat not found at default path - set ZAP_PATH manually.'
    }
}

Write-Host 'Restart the terminal, then run: npm run dast:scan'
