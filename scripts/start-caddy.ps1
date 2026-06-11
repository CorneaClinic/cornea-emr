# Start Caddy HTTPS reverse proxy (optional — requires Caddy installed).
# winget install Caddy.Caddy

$ErrorActionPreference = 'Stop'

$Caddyfile = Join-Path $PSScriptRoot '..\infra\Caddyfile'

$Caddy = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $Caddy) {
    $portable = Join-Path $PSScriptRoot '..\tools\caddy\caddy.exe'
    if (Test-Path $portable) { $Caddy = Get-Item $portable }
}

if (-not $Caddy) {
    Write-Error @"
Caddy is not installed. Install with:
  winget install CaddyServer.Caddy
  or: powershell -ExecutionPolicy Bypass -File scripts\install-caddy.ps1

Then add to C:\Windows\System32\drivers\etc\hosts (as Administrator):
  127.0.0.1 clinic.local api.local

Trust local certificates (once, as Administrator):
  caddy trust
"@
    exit 1
}

$CaddyExe = if ($Caddy.Source) { $Caddy.Source } else { $Caddy.FullName }

Write-Host "Starting Caddy with $Caddyfile"
Write-Host "  Clinic UI: https://clinic.local"
Write-Host "  API:       https://api.local"
& $CaddyExe run --config $Caddyfile
