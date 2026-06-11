# Runs the Cornea EMR API in production mode (no file watcher).
# Used by the Windows scheduled task / manual production startup.

$ErrorActionPreference = 'Stop'

$ApiDir = Join-Path $PSScriptRoot '..\apps\api'
Set-Location $ApiDir

if (-not (Test-Path '.env')) {
    Write-Error 'Missing apps\api\.env - copy .env.example and configure for production.'
    exit 1
}

# Load .env into the process environment (simple KEY=VALUE parser).
Get-Content '.env' | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
}

if (-not $env:NODE_ENV) { $env:NODE_ENV = 'production' }

$port = if ($env:PORT) { $env:PORT } else { '3000' }
Write-Host "Starting Cornea EMR API (NODE_ENV=$($env:NODE_ENV)) on port $port..."
node src/index.js
