# Install Cloudflare Tunnel client (cloudflared).
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-cloudflared.ps1

$ErrorActionPreference = 'Stop'

$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) {
    Write-Host "cloudflared already installed: $($cmd.Source)"
    & cloudflared --version
    exit 0
}

Write-Host 'Installing cloudflared via winget...'
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cmd) {
    Write-Error 'Install finished but cloudflared not in PATH. Restart terminal and run: cloudflared --version'
    exit 1
}

Write-Host "Installed: $($cmd.Source)"
& cloudflared --version
