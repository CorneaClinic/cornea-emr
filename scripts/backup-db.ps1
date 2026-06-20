# Cornea EMR - automated PostgreSQL backup
# Reads DATABASE_URL from apps/api/.env, dumps the database with pg_dump,
# keeps the most recent 30 backups, and logs each run.
#
# Off-site copies: if scripts/backup-config.json sets "offsiteDir", every dump
# is AES-256 encrypted with backup-encryption.key and copied there as well.
# KEEP A COPY OF backup-encryption.key SOMEWHERE SAFE (password manager, USB,
# printout) - off-site backups cannot be decrypted without it.
#
# Run manually:        powershell -ExecutionPolicy Bypass -File backup-db.ps1
# Production (cloud):   powershell -ExecutionPolicy Bypass -File backup-production.ps1
# Restore a backup:    powershell -ExecutionPolicy Bypass -File restore-backup.ps1 <file>

param(
    [string]$EnvFile = '',
    [string]$OutputSubdir = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    $EnvFile = Join-Path $RepoRoot 'apps\api\.env'
}
$BackupDir  = Join-Path $RepoRoot 'backups'
if ($OutputSubdir) {
    $BackupDir = Join-Path $BackupDir $OutputSubdir
}
$LogFile    = Join-Path $BackupDir 'backup.log'
$ConfigFile = Join-Path $PSScriptRoot 'backup-config.json'
$KeyFile    = Join-Path $RepoRoot 'backup-encryption.key'
$KeepCount  = 30

function Write-Log($message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $message"
    # Write-Host (not Write-Output) so calls inside functions don't pollute
    # their return values.
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# --- Locate pg_dump (newest installed version first) ---
$PgDump = $null
$pgRoot = 'C:\Program Files\PostgreSQL'
if (Test-Path $pgRoot) {
    $versions = Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending
    foreach ($v in $versions) {
        $candidate = Join-Path $v.FullName 'bin\pg_dump.exe'
        if (Test-Path $candidate) { $PgDump = $candidate; break }
    }
}
if (-not $PgDump) {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { $PgDump = $cmd.Source }
}
if (-not $PgDump) {
    Write-Log 'ERROR: pg_dump.exe not found - install PostgreSQL client tools.'
    exit 1
}

# --- Read DATABASE_URL from .env ---
if (-not (Test-Path $EnvFile)) {
    Write-Log "ERROR: $EnvFile not found."
    exit 1
}
$dbUrlLine = (Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
if (-not $dbUrlLine) {
    Write-Log 'ERROR: DATABASE_URL not set in .env.'
    exit 1
}
$dbUrlRaw = ($dbUrlLine -split '=', 2)[1].Trim()
$useSsl = $dbUrlRaw -match 'sslmode=(require|verify-full|verify-ca|prefer)' `
    -or $dbUrlRaw -match '@[^/@]+ondigitalocean\.com'
$dbUrl = ($dbUrlRaw -split '\?')[0]

if ($dbUrl -notmatch '^postgres(ql)?://(?<user>[^:@/]+)(:(?<pass>[^@/]*))?@(?<dbhost>[^:/]+)(:(?<port>\d+))?/(?<db>[^?]+)') {
    Write-Log 'ERROR: could not parse DATABASE_URL.'
    exit 1
}
$DbUser = $Matches['user']
$DbPass = $Matches['pass']
$DbHost = $Matches['dbhost']
$DbPort = if ($Matches['port']) { $Matches['port'] } else { '5432' }
$DbName = $Matches['db']

# --- Run pg_dump (custom format: compressed, restorable with pg_restore) ---
$stamp   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$outFile = Join-Path $BackupDir "${DbName}_${stamp}.dump"

$env:PGPASSWORD = $DbPass
if ($useSsl -or $DbHost -notmatch '^(127\.0\.0\.1|localhost)$') {
    $env:PGSSLMODE = 'require'
}
try {
    & $PgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $outFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with code $LASTEXITCODE" }

    $sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
    Write-Log "OK: $outFile ($sizeKb KB)"
} catch {
    Write-Log "ERROR: backup failed - $($_.Exception.Message)"
    if (Test-Path $outFile) { Remove-Item $outFile -Force }
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue
}

# --- Prune old backups (keep newest $KeepCount) ---
$old = Get-ChildItem $BackupDir -Filter '*.dump' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepCount
foreach ($f in $old) {
    Remove-Item $f.FullName -Force
    Write-Log "Pruned old backup: $($f.Name)"
}

# --- Off-site encrypted copy (optional, configured in backup-config.json) ---
function Get-BackupKey {
    if (-not (Test-Path $KeyFile)) {
        $bytes = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        [System.IO.File]::WriteAllText($KeyFile, [Convert]::ToBase64String($bytes))
        Write-Log "Generated new encryption key: $KeyFile - COPY IT SOMEWHERE SAFE (off-site backups are useless without it)."
    }
    return [Convert]::FromBase64String((Get-Content $KeyFile -Raw).Trim())
}

function Protect-BackupFile($inFile, $outFile, $keyBytes) {
    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $aes.Key = $keyBytes
        $aes.GenerateIV()
        $inStream = [System.IO.File]::OpenRead($inFile)
        $outStream = [System.IO.File]::Create($outFile)
        try {
            $outStream.Write($aes.IV, 0, 16)
            $crypto = New-Object System.Security.Cryptography.CryptoStream(
                $outStream, $aes.CreateEncryptor(),
                [System.Security.Cryptography.CryptoStreamMode]::Write)
            $inStream.CopyTo($crypto)
            $crypto.FlushFinalBlock()
            $crypto.Dispose()
        } finally {
            $inStream.Dispose()
            $outStream.Dispose()
        }
    } finally {
        $aes.Dispose()
    }
}

$offsiteDir = $null
if (Test-Path $ConfigFile) {
    try {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if ($config.offsiteDir) { $offsiteDir = $config.offsiteDir }
    } catch {
        Write-Log "WARN: could not parse $ConfigFile - $($_.Exception.Message)"
    }
}

if ($offsiteDir) {
    if ($OutputSubdir) {
        $offsiteDir = Join-Path $offsiteDir $OutputSubdir
    }
    try {
        if (-not (Test-Path $offsiteDir)) {
            New-Item -ItemType Directory -Path $offsiteDir -Force | Out-Null
        }
        $key = Get-BackupKey
        $encFile = Join-Path $offsiteDir ((Split-Path $outFile -Leaf) + '.enc')
        Protect-BackupFile $outFile $encFile $key
        $encKb = [math]::Round((Get-Item $encFile).Length / 1KB, 1)
        Write-Log "Off-site copy OK: $encFile ($encKb KB, AES-256)"

        # Prune off-site copies to the same retention.
        $oldEnc = Get-ChildItem $offsiteDir -Filter '*.dump.enc' |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $KeepCount
        foreach ($f in $oldEnc) {
            Remove-Item $f.FullName -Force
            Write-Log "Pruned old off-site backup: $($f.Name)"
        }
    } catch {
        Write-Log "ERROR: off-site copy failed - $($_.Exception.Message)"
        # Local backup succeeded, so do not fail the whole run.
    }
} else {
    Write-Log "NOTE: no off-site destination configured (scripts/backup-config.json) - backups exist only on this disk."
}

exit 0
