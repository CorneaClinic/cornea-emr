# Download portable Caddy for Windows into cornea-emr/tools/caddy/
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-caddy.ps1

$ErrorActionPreference = 'Stop'

$ToolsDir = Join-Path $PSScriptRoot '..\tools\caddy'
$ZipPath  = Join-Path $env:TEMP 'caddy_windows_amd64.zip'
$Url      = 'https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip'

New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null

Write-Host "Downloading Caddy from GitHub..."
Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing

Write-Host "Extracting to $ToolsDir ..."
Expand-Archive -Path $ZipPath -DestinationPath $ToolsDir -Force
Remove-Item $ZipPath -Force

$CaddyExe = Join-Path $ToolsDir 'caddy.exe'
if (-not (Test-Path $CaddyExe)) {
    Write-Error "caddy.exe not found after extract"
    exit 1
}

Write-Host "Caddy installed: $CaddyExe"
& $CaddyExe version
