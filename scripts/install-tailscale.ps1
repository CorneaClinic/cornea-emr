# Install Tailscale for private remote access.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-tailscale.ps1

$ErrorActionPreference = 'Stop'

$cmd = Get-Command tailscale -ErrorAction SilentlyContinue
if ($cmd) {
    Write-Host "Tailscale already installed: $($cmd.Source)"
    & tailscale version
    exit 0
}

Write-Host 'Installing Tailscale via winget...'
winget install --id Tailscale.Tailscale -e --accept-source-agreements --accept-package-agreements

Write-Host ''
Write-Host 'After install, sign in from the Tailscale icon in the system tray.'
Write-Host 'Then run:  scripts\setup-tailscale-serve.ps1'
Write-Host 'Invite others at:  https://login.tailscale.com/admin/users'
