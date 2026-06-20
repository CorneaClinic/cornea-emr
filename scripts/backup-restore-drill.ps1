# Cornea EMR — backup restore drill (non-destructive).
# Creates a temporary database, restores the latest backup into it, verifies row
# counts against production, then drops the test database.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -BackupFile backups\file.dump
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -PostgresUser postgres
#
# If the app user (cornea) lacks CREATEDB, pass -PostgresUser postgres and set
# PGPASSWORD for that superuser, or run from an elevated psql session once:
#   ALTER USER cornea CREATEDB;

param(
    [string]$BackupFile = '',
    [string]$PostgresUser = '',
    [string]$EnvFile = '',
    [switch]$SkipFreshBackup
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    $EnvFile = Join-Path $RepoRoot 'apps\api\.env'
}
$BackupDir = Join-Path $RepoRoot 'backups'
$ConfigFile = Join-Path $PSScriptRoot 'backup-config.json'
$TestDb = 'cornea_emr_restore_drill'

function Write-Step([string]$Message) {
    Write-Output ""
    Write-Output "=== $Message ==="
}

function Get-PgBin {
    $pgRoot = 'C:\Program Files\PostgreSQL'
    if (-not (Test-Path $pgRoot)) {
        throw 'PostgreSQL not found under C:\Program Files\PostgreSQL'
    }
    foreach ($v in (Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending)) {
        $bin = Join-Path $v.FullName 'bin'
        if (Test-Path (Join-Path $bin 'psql.exe')) { return $bin }
    }
    throw 'psql.exe not found'
}

function Parse-DatabaseUrl {
    $line = (Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
    if (-not $line) { throw 'DATABASE_URL not found in apps/api/.env' }
    $url = ($line -split '=', 2)[1].Trim()
    if ($url -notmatch '^postgres(ql)?://(?<user>[^:@/]+)(:(?<pass>[^@/]*))?@(?<dbhost>[^:/]+)(:(?<port>\d+))?/(?<db>[^?]+)') {
        throw 'Could not parse DATABASE_URL'
    }
    return @{
        User = $Matches['user']
        Pass = $Matches['pass']
        Host = $Matches['dbhost']
        Port = if ($Matches['port']) { $Matches['port'] } else { '5432' }
        Db   = $Matches['db']
    }
}

function Invoke-Pg([string]$Exe, [hashtable]$Db, [string[]]$PgArgs, [string]$Password) {
    $prev = $env:PGPASSWORD
    if ($Password) { $env:PGPASSWORD = $Password }
    try {
        & $Exe @PgArgs
        if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Exe)) failed (exit $LASTEXITCODE)" }
    } finally {
        if ($null -eq $prev) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
        else { $env:PGPASSWORD = $prev }
    }
}

Write-Step 'Backup restore drill'
$db = Parse-DatabaseUrl
$pgBin = Get-PgBin
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$dropdb = Join-Path $pgBin 'dropdb.exe'
$pgRestore = Join-Path $pgBin 'pg_restore.exe'

Write-Output "Production database: $($db.Db) on $($db.Host):$($db.Port) (user: $($db.User))"

if (-not $SkipFreshBackup) {
    Write-Step 'Fresh backup'
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-db.ps1') | Out-Host
}

if (-not $BackupFile) {
    $BackupFile = Get-ChildItem $BackupDir -Filter '*.dump' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
    throw 'No backup .dump file found'
}
Write-Output "Using backup: $BackupFile ($((Get-Item $BackupFile).Length) bytes)"

Write-Step 'Off-site decrypt check'
$config = @{}
if (Test-Path $ConfigFile) {
    $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
}
$encName = (Split-Path $BackupFile -Leaf) + '.enc'
$encPath = if ($config.offsiteDir) { Join-Path $config.offsiteDir $encName } else { $null }
if ($encPath -and (Test-Path $encPath)) {
    $decrypted = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'restore-backup.ps1') $encPath -DecryptOnly |
        Select-Object -Last 1
    Write-Output $decrypted
    if ($decrypted -match 'Decrypted to: (.+)$') {
        $tempDump = $Matches[1].Trim()
        if (Test-Path $tempDump) {
            $localSize = (Get-Item $BackupFile).Length
            $decSize = (Get-Item $tempDump).Length
            if ($localSize -ne $decSize) {
                throw "Decrypt size mismatch: local=$localSize decrypted=$decSize"
            }
            Write-Output 'Off-site decrypt OK (size matches local dump)'
            Remove-Item $tempDump -Force
        }
    }
} else {
    Write-Output "No matching off-site file at: $encPath (skipping decrypt check)"
}

Write-Step 'Backup catalog (pg_restore --list)'
$toc = & $pgRestore -l $BackupFile
$toc | Select-Object -First 12 | ForEach-Object { Write-Output $_ }
$tocCount = ($toc | Measure-Object -Line).Lines
Write-Output "... ($tocCount TOC lines)"

Write-Step "Restore into test database '$TestDb'"
$adminUser = if ($PostgresUser) { $PostgresUser } else { $db.User }
$adminPass = $db.Pass

try {
    Invoke-Pg $dropdb $db @('-h', $db.Host, '-p', $db.Port, '-U', $adminUser, '--if-exists', $TestDb) $adminPass
} catch {
    if ($PostgresUser) { throw }
    Write-Output "App user cannot drop/create databases; retry with -PostgresUser postgres"
    throw
}

try {
    Invoke-Pg $createdb $db @('-h', $db.Host, '-p', $db.Port, '-U', $adminUser, '-O', $db.User, $TestDb) $adminPass
} catch {
    if ($PostgresUser) { throw }
    Write-Output ""
    Write-Output "BLOCKED: user '$($db.User)' needs CREATEDB, or run:"
    Write-Output "  powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -PostgresUser postgres"
    Write-Output "  (set PGPASSWORD for postgres superuser first)"
    exit 2
}

try {
    $prev = $env:PGPASSWORD
    $env:PGPASSWORD = $db.Pass
    & $pgRestore -h $db.Host -p $db.Port -U $db.User -d $TestDb --no-owner --no-acl $BackupFile 2>&1 | Out-Null
    Write-Output "pg_restore exit: $LASTEXITCODE"
    if ($null -eq $prev) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    else { $env:PGPASSWORD = $prev }

    Write-Step 'Row counts (production vs restored)'
    $tables = @('users', 'patients', 'visits', 'schema_migrations')
    $allOk = $true
    foreach ($table in $tables) {
        $prod = Invoke-Pg $psql $db @('-h', $db.Host, '-p', $db.Port, '-U', $db.User, '-d', $db.Db, '-t', '-A', '-c', "SELECT count(*) FROM $table;") $db.Pass
        $test = Invoke-Pg $psql $db @('-h', $db.Host, '-p', $db.Port, '-U', $db.User, '-d', $TestDb, '-t', '-A', '-c', "SELECT count(*) FROM $table;") $db.Pass
        $ok = if ($prod -eq $test) { 'OK' } else { 'MISMATCH'; $allOk = $false }
        Write-Output "  $table : prod=$prod restored=$test [$ok]"
    }
    if (-not $allOk) { throw 'Row count mismatch between production and restored database' }

    Write-Step 'Cleanup test database'
    Invoke-Pg $dropdb $db @('-h', $db.Host, '-p', $db.Port, '-U', $adminUser, $TestDb) $adminPass

    Write-Output ""
    Write-Output 'DRILL PASSED: backup, decrypt, catalog, restore, and verification succeeded.'
} catch {
    try {
        Invoke-Pg $dropdb $db @('-h', $db.Host, '-p', $db.Port, '-U', $adminUser, '--if-exists', $TestDb) $adminPass
    } catch { /* ignore cleanup failure */ }
    throw
}
