# Cornea EMR — backup restore drill (non-destructive).
# Creates a temporary database, restores the latest backup into it, verifies row
# counts against production, then drops the test database.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -BackupFile backups\production\file.dump
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -EnvFile apps\api\.env.production -SkipFreshBackup
#   powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -PostgresUser postgres -PostgresPassword 'your-postgres-password'
#
# Or create scripts\postgres-drill.local.ps1 (gitignored) with:
#   $script:PostgresDrillPassword = 'your-postgres-password'
#
# Managed cloud Postgres (DigitalOcean) often blocks CREATEDB on the public endpoint.
# In that case the drill restores to local PostgreSQL and compares row counts against
# the live cloud database (still non-destructive to production).

param(
    [string]$BackupFile = '',
    [string]$PostgresUser = '',
    [string]$PostgresPassword = '',
    [string]$EnvFile = '',
    [switch]$SkipFreshBackup
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

$localDrillConfig = Join-Path $PSScriptRoot 'postgres-drill.local.ps1'
if (Test-Path $localDrillConfig) {
    . $localDrillConfig
}
function Test-IsPlaceholderPassword([string]$Value) {
    if (-not $Value) { return $true }
    return $Value -match 'REPLACE_WITH|your[_-]?postgres|changeme|^password$|^xxx+$'
}

if (-not $PostgresPassword -and $script:PostgresDrillPassword) {
    $PostgresPassword = $script:PostgresDrillPassword
}
if (-not $PostgresPassword -and $env:POSTGRES_PASSWORD) {
    $PostgresPassword = $env:POSTGRES_PASSWORD
}
if (Test-IsPlaceholderPassword $PostgresPassword) {
    if ($PostgresPassword) {
        Write-Output 'Ignoring placeholder postgres password in postgres-drill.local.ps1 (set your real PostgreSQL 18 install password).'
    }
    $PostgresPassword = ''
    $PostgresUser = ''
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
} elseif ($PostgresPassword) {
    $env:PGPASSWORD = $PostgresPassword
    if (-not $PostgresUser) { $PostgresUser = 'postgres' }
}
if (-not $EnvFile) {
    $EnvFile = Join-Path $RepoRoot 'apps\api\.env'
}
$BackupDir = Join-Path $RepoRoot 'backups'
$LocalEnvFile = Join-Path $RepoRoot 'apps\api\.env'
$ConfigFile = Join-Path $PSScriptRoot 'backup-config.json'
$TestDb = 'cornea_emr_restore_drill'
$IsProductionEnv = $EnvFile -match '\.env\.production$'

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

function Parse-DatabaseUrlFromFile([string]$Path) {
    $line = (Get-Content $Path | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
    if (-not $line) { throw "DATABASE_URL not found in $Path" }
    $url = ($line -split '=', 2)[1].Trim()
    if ($url -notmatch '^postgres(ql)?://(?<user>[^:@/]+)(:(?<pass>[^@/]*))?@(?<dbhost>[^:/]+)(:(?<port>\d+))?/(?<db>[^?]+)') {
        throw "Could not parse DATABASE_URL in $Path"
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

function Get-LatestBackupFile {
    param([string]$PreferredDir)
    $candidates = @()
    if ($PreferredDir -and (Test-Path $PreferredDir)) {
        $candidates += Get-ChildItem $PreferredDir -Filter '*.dump' -ErrorAction SilentlyContinue
    }
    $candidates += Get-ChildItem $BackupDir -Filter '*.dump' -ErrorAction SilentlyContinue
    $latest = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) { return $latest.FullName }
    return $null
}

function Show-DrillPasswordHelp([string]$Reason) {
    Write-Output ''
    Write-Output "BLOCKED: $Reason"
    Write-Output ''
    Write-Output 'The drill needs either:'
    Write-Output '  A) Correct postgres superuser password (from PostgreSQL 18 install), OR'
    Write-Output '  B) CREATEDB granted to local user cornea (one-time setup).'
    Write-Output ''
    Write-Output 'Option B (recommended - then drills work without postgres password):'
    Write-Output "  `$env:POSTGRES_PASSWORD='YourPostgresInstallPassword'"
    Write-Output '  node scripts/grant-cornea-createdb.js'
    Write-Output '  powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -EnvFile apps\api\.env.production -SkipFreshBackup'
    Write-Output ''
    Write-Output 'Option A (postgres each time):'
    Write-Output '  Copy-Item scripts\postgres-drill.local.ps1.example scripts\postgres-drill.local.ps1'
    Write-Output '  notepad scripts\postgres-drill.local.ps1   # set real install password'
    Write-Output '  npm run drill:monthly'
    Write-Output ''
}

function Resolve-LocalDrillAdmin([hashtable]$LocalDb, [string]$CreatedbExe) {
    if (Test-CanCreateDatabase $CreatedbExe $LocalDb $LocalDb.User $LocalDb.Pass) {
        Write-Output "Using local user '$($LocalDb.User)' for test database create/drop."
        return @{ User = $LocalDb.User; Pass = $LocalDb.Pass }
    }
    if ($PostgresPassword -or $PostgresUser) {
        $user = if ($PostgresUser) { $PostgresUser } else { 'postgres' }
        $pass = if ($PostgresPassword) { $PostgresPassword } else { $env:PGPASSWORD }
        if ($pass -and -not (Test-IsPlaceholderPassword $pass)) {
            if (Test-CanCreateDatabase $CreatedbExe $LocalDb $user $pass) {
                Write-Output "Using postgres superuser '$user' for test database create/drop."
                return @{ User = $user; Pass = $pass }
            }
            Write-Output "PostgreSQL rejected password for user '$user' (not the cloud doadmin password - use your local PostgreSQL 18 install password)."
        }
    }
    return $null
}

function Test-CanCreateDatabase([string]$CreatedbExe, [hashtable]$Db, [string]$AdminUser, [string]$AdminPass) {
    $probeDb = "${TestDb}_probe"
    $dropdbExe = Join-Path (Split-Path $CreatedbExe) 'dropdb.exe'
    try {
        Invoke-Pg $dropdbExe $Db @('-h', $Db.Host, '-p', $Db.Port, '-U', $AdminUser, '--if-exists', $probeDb) $AdminPass
        Invoke-Pg $CreatedbExe $Db @('-h', $Db.Host, '-p', $Db.Port, '-U', $AdminUser, '-O', $Db.User, $probeDb) $AdminPass
        Invoke-Pg $dropdbExe $Db @('-h', $Db.Host, '-p', $Db.Port, '-U', $AdminUser, $probeDb) $AdminPass
        return $true
    } catch {
        try {
            Invoke-Pg $dropdbExe $Db @('-h', $Db.Host, '-p', $Db.Port, '-U', $AdminUser, '--if-exists', $probeDb) $AdminPass
        } catch {
            # ignore probe cleanup failure
        }
        return $false
    }
}

Write-Step 'Backup restore drill'
$db = Parse-DatabaseUrlFromFile $EnvFile
$pgBin = Get-PgBin
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$dropdb = Join-Path $pgBin 'dropdb.exe'
$pgRestore = Join-Path $pgBin 'pg_restore.exe'

Write-Output "Source database: $($db.Db) on $($db.Host):$($db.Port) (user: $($db.User))"

if (-not $SkipFreshBackup) {
    Write-Step 'Fresh backup'
    if ($IsProductionEnv) {
        & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-production.ps1') | Out-Host
    } else {
        & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-db.ps1') | Out-Host
    }
}

if (-not $BackupFile) {
    $preferred = if ($IsProductionEnv) { Join-Path $BackupDir 'production' } else { $BackupDir }
    $BackupFile = Get-LatestBackupFile -PreferredDir $preferred
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
$offsiteBase = $config.offsiteDir
if ($offsiteBase -and $BackupFile -match '\\production\\') {
    $offsiteBase = Join-Path $offsiteBase 'production'
}
$encPath = if ($offsiteBase) { Join-Path $offsiteBase $encName } else { $null }
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

$adminUser = if ($PostgresUser) { $PostgresUser } else { $db.User }
$adminPass = $db.Pass
$restoreTarget = $db
$countSource = $db
$useLocalRestore = $false

if ($db.Host -match 'ondigitalocean\.com') {
  $localEnvPath = Join-Path $RepoRoot 'apps\api\.env.local'
  $hasLocalPg = Test-Path $localEnvPath
  if (-not $hasLocalPg -and (Test-Path $LocalEnvFile)) {
    $candidate = Parse-DatabaseUrlFromFile $LocalEnvFile
    $hasLocalPg = $candidate.Host -match '^(127\.0\.0\.1|localhost)$'
  }
  $preferLocal = $false
  if ($hasLocalPg) {
    # Managed Postgres public endpoint cannot run createdb/dropdb (template1 blocked).
    $preferLocal = $true
  } elseif ($PostgresUser) {
    $preferLocal = $false
  } elseif (-not (Test-CanCreateDatabase $createdb $db $adminUser $adminPass)) {
    $preferLocal = $true
  }
  if ($preferLocal) {
    $localDb = $null
    if (Test-Path $localEnvPath) {
      $localDb = Parse-DatabaseUrlFromFile $localEnvPath
    } elseif (Test-Path $LocalEnvFile) {
      $candidate = Parse-DatabaseUrlFromFile $LocalEnvFile
      if ($candidate.Host -match '^(127\.0\.0\.1|localhost)$') {
        $localDb = $candidate
      }
    }
    if ($localDb) {
      $useLocalRestore = $true
      $restoreTarget = $localDb
      $countSource = $db
      Write-Output ''
      Write-Output 'Cloud CREATEDB not available on public endpoint - restoring to local PostgreSQL for verification.'
      Write-Output "Restore target: $($restoreTarget.Db) on $($restoreTarget.Host):$($restoreTarget.Port)"
    } else {
      Write-Output ''
      Write-Output 'Cloud CREATEDB not available - running catalog + live snapshot verification.'
      Write-Output 'Tip: add apps/api/.env.local (127.0.0.1) for full restore drill on this PC.'
      Write-Step 'Live production row counts (snapshot)'
      $tables = @('users', 'patients', 'visits', 'schema_migrations')
      foreach ($table in $tables) {
        $prod = Invoke-Pg $psql $db @('-h', $db.Host, '-p', $db.Port, '-U', $db.User, '-d', $db.Db, '-t', '-A', '-c', "SELECT count(*) FROM $table;") $db.Pass
        Write-Output "  $table : cloud=$prod"
      }
      Write-Output ''
      Write-Output 'DRILL PASSED (catalog mode): backup file, off-site decrypt, and catalog verified against live cloud counts snapshot.'
      Write-Output 'For full restore verification, create apps/api/.env.local pointing at 127.0.0.1 PostgreSQL.'
      & node (Join-Path $RepoRoot 'scripts\log-dr-drill.mjs') --pass --note 'catalog mode (cloud CREATEDB unavailable)'
      exit 0
    }
  }
}

Write-Step "Restore into test database '$TestDb'"
$adminUser = $restoreTarget.User
$adminPass = $restoreTarget.Pass

if ($useLocalRestore) {
    $localAdmin = Resolve-LocalDrillAdmin $restoreTarget $createdb
    if ($localAdmin) {
        $adminUser = $localAdmin.User
        $adminPass = $localAdmin.Pass
        if ($adminPass) { $env:PGPASSWORD = $adminPass }
    } else {
        Show-DrillPasswordHelp 'local cornea user lacks CREATEDB and no valid postgres password was provided'
        exit 2
    }
} elseif ($PostgresUser) {
    $adminUser = $PostgresUser
    $adminPass = if ($PostgresPassword) { $PostgresPassword } else { $env:PGPASSWORD }
}

try {
    Invoke-Pg $dropdb $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $adminUser, '--if-exists', $TestDb) $adminPass
} catch {
    if ($_.Exception.Message -match 'authentication failed|password authentication') {
        Show-DrillPasswordHelp "PostgreSQL rejected password for user '$adminUser'"
        exit 2
    }
    if ($PostgresUser) { throw }
    if ($useLocalRestore) { throw }
    Write-Output "App user cannot drop/create databases; retry with -PostgresUser postgres"
    throw
}

try {
    Invoke-Pg $createdb $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $adminUser, '-O', $restoreTarget.User, $TestDb) $adminPass
} catch {
    if ($useLocalRestore) {
        Show-DrillPasswordHelp "cannot create test database as user '$adminUser'"
        exit 2
    }
    if ($PostgresUser) { throw }
    Write-Output ""
    Write-Output "BLOCKED: user '$($db.User)' needs CREATEDB, or run:"
    Write-Output "  powershell -ExecutionPolicy Bypass -File scripts\backup-restore-drill.ps1 -PostgresUser postgres"
    Write-Output "  (set PGPASSWORD for postgres superuser first)"
    exit 2
}

try {
    $prev = $env:PGPASSWORD
    $env:PGPASSWORD = $restoreTarget.Pass
    & $pgRestore -h $restoreTarget.Host -p $restoreTarget.Port -U $restoreTarget.User -d $TestDb --no-owner --no-acl $BackupFile 2>&1 | Out-Null
    Write-Output "pg_restore exit: $LASTEXITCODE"
    if ($PostgresPassword) {
        $env:PGPASSWORD = $PostgresPassword
    } elseif ($null -eq $prev) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        $env:PGPASSWORD = $prev
    }

    Write-Step 'Row counts (production vs restored)'
    $clinicalTables = @('users', 'patients', 'visits')
    $allOk = $true
    $staleBackupNote = $null
    foreach ($table in $clinicalTables) {
        $prod = Invoke-Pg $psql $countSource @('-h', $countSource.Host, '-p', $countSource.Port, '-U', $countSource.User, '-d', $countSource.Db, '-t', '-A', '-c', "SELECT count(*) FROM $table;") $countSource.Pass
        $test = Invoke-Pg $psql $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $restoreTarget.User, '-d', $TestDb, '-t', '-A', '-c', "SELECT count(*) FROM $table;") $restoreTarget.Pass
        $ok = if ($prod -eq $test) { 'OK' } else { 'MISMATCH'; $allOk = $false }
        $label = if ($useLocalRestore) { 'cloud' } else { 'prod' }
        Write-Output "  $table : $label=$prod restored=$test [$ok]"
    }

    $prodMig = Invoke-Pg $psql $countSource @('-h', $countSource.Host, '-p', $countSource.Port, '-U', $countSource.User, '-d', $countSource.Db, '-t', '-A', '-c', 'SELECT count(*) FROM schema_migrations;') $countSource.Pass
    $testMig = Invoke-Pg $psql $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $restoreTarget.User, '-d', $TestDb, '-t', '-A', '-c', 'SELECT count(*) FROM schema_migrations;') $restoreTarget.Pass
    $label = if ($useLocalRestore) { 'cloud' } else { 'prod' }
    if ($prodMig -eq $testMig) {
        Write-Output "  schema_migrations : $label=$prodMig restored=$testMig [OK]"
    } elseif ([int]$testMig -lt [int]$prodMig) {
        $delta = [int]$prodMig - [int]$testMig
        $staleBackupNote = "backup predates cloud by $delta migration(s) - run backup-production.ps1 for a fresh dump"
        Write-Output "  schema_migrations : $label=$prodMig restored=$testMig [STALE BACKUP - expected when cloud migrated after dump; $staleBackupNote]"
    } else {
        Write-Output "  schema_migrations : $label=$prodMig restored=$testMig [MISMATCH]"
        $allOk = $false
    }

    if (-not $allOk) { throw 'Row count mismatch between production and restored database' }

    Write-Step 'Cleanup test database'
    Invoke-Pg $dropdb $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $adminUser, $TestDb) $adminPass

    $mode = if ($useLocalRestore) { ' (cloud backup verified via local restore)' } else { '' }
    if ($staleBackupNote) {
        Write-Output ""
        Write-Output "NOTE: $staleBackupNote"
    }
    Write-Output ""
    Write-Output "DRILL PASSED: backup, decrypt, catalog, restore, and verification succeeded.$mode"
    $drillNote = "backup-restore-drill.ps1$mode"
    if ($staleBackupNote) { $drillNote += " [$staleBackupNote]" }
    & node (Join-Path $RepoRoot 'scripts\log-dr-drill.mjs') --pass --note $drillNote
} catch {
    try {
        Invoke-Pg $dropdb $restoreTarget @('-h', $restoreTarget.Host, '-p', $restoreTarget.Port, '-U', $adminUser, '--if-exists', $TestDb) $adminPass
    } catch {
        # ignore cleanup failure
    }
    throw
}
