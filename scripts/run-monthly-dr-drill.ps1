# Cornea EMR - monthly DR drill (Project 5)
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Test-IsPlaceholderPassword([string]$Value) {
    if (-not $Value) { return $true }
    return $Value -match 'REPLACE_WITH|your[_-]?postgres|changeme|^password$|^xxx+$'
}

function Test-LocalCorneaCanCreateDb {
    $localEnv = Join-Path $RepoRoot 'apps\api\.env.local'
    if (-not (Test-Path $localEnv)) { return $false }
    $line = Get-Content $localEnv | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) { return $false }
    $url = ($line -split '=', 2)[1].Trim()
    if ($url -notmatch '^postgres(ql)?://(?<user>[^:@/]+)(:(?<pass>[^@/]*))?@(?<dbhost>[^:/]+)(:(?<port>\d+))?/(?<db>[^?]+)') {
        return $false
    }
    $pgRoot = 'C:\Program Files\PostgreSQL'
    if (-not (Test-Path $pgRoot)) { return $false }
    $psql = Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if (-not $psql) { return $false }
    $prev = $env:PGPASSWORD
    if ($Matches['pass']) { $env:PGPASSWORD = $Matches['pass'] }
    try {
        $flag = & $psql -h $Matches['dbhost'] -p $(if ($Matches['port']) { $Matches['port'] } else { '5432' }) `
            -U $Matches['user'] -d postgres -t -A -c "SELECT rolcreatedb FROM pg_roles WHERE rolname='$($Matches['user'])';"
        return ($flag -eq 't')
    } catch {
        return $false
    } finally {
        if ($null -eq $prev) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
        else { $env:PGPASSWORD = $prev }
    }
}

$localConfig = Join-Path $PSScriptRoot 'postgres-drill.local.ps1'
$hasPostgresPassword = $false
if (Test-Path $localConfig) {
    . $localConfig
    if ($script:PostgresDrillPassword -and -not (Test-IsPlaceholderPassword $script:PostgresDrillPassword)) {
        $hasPostgresPassword = $true
    }
}
if (-not $hasPostgresPassword -and $env:POSTGRES_PASSWORD -and -not (Test-IsPlaceholderPassword $env:POSTGRES_PASSWORD)) {
    $hasPostgresPassword = $true
}

$corneaCanCreateDb = Test-LocalCorneaCanCreateDb

if (-not $hasPostgresPassword -and -not $corneaCanCreateDb) {
    Write-Host ''
    Write-Host 'Monthly drill needs local PostgreSQL admin access (one-time setup).' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Option B (recommended): grant CREATEDB to cornea, then drills work without storing postgres password:'
    Write-Host "  `$env:POSTGRES_PASSWORD='YourPostgres18InstallPassword'"
    Write-Host '  node scripts/grant-cornea-createdb.js'
    Write-Host ''
    Write-Host 'Option A: save postgres password in gitignored config:'
    Write-Host '  Copy-Item scripts\postgres-drill.local.ps1.example scripts\postgres-drill.local.ps1'
    Write-Host '  notepad scripts\postgres-drill.local.ps1   # replace placeholder with real install password'
    Write-Host ''
    Write-Host 'Then: npm.cmd run drill:monthly'
    Write-Host ''
    exit 1
}

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-restore-drill.ps1') `
    -EnvFile (Join-Path $RepoRoot 'apps\api\.env.production') `
    -SkipFreshBackup
