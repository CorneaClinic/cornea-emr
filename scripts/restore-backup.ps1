# Cornea EMR - restore a database backup.
#
# Accepts either a plain .dump (local backups/) or an encrypted .dump.enc
# (off-site copies). Encrypted files are decrypted with backup-encryption.key.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File restore-backup.ps1 <backup-file> [-DecryptOnly]
#
# Examples:
#   .\restore-backup.ps1 ..\backups\cornea_emr_v1_2026-06-10_191958.dump
#   .\restore-backup.ps1 "E:\clinic-backups\cornea_emr_v1_2026-06-10.dump.enc"
#   .\restore-backup.ps1 backup.dump.enc -DecryptOnly   # just produce the .dump

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [switch]$DecryptOnly
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFile  = Join-Path $RepoRoot 'apps\api\.env'
$KeyFile  = Join-Path $RepoRoot 'backup-encryption.key'

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

# --- Decrypt if needed ---
$dumpFile = $BackupFile
if ($BackupFile -like '*.enc') {
    if (-not (Test-Path $KeyFile)) {
        Write-Error "Encryption key not found: $KeyFile - restore it from your safe copy first."
        exit 1
    }
    $key = [Convert]::FromBase64String((Get-Content $KeyFile -Raw).Trim())
    $dumpFile = $BackupFile -replace '\.enc$', ''
    if ((Split-Path $dumpFile -Parent) -eq (Split-Path $BackupFile -Parent)) {
        # Write the decrypted file next to the script caller's cwd-independent temp spot
        $dumpFile = Join-Path ([System.IO.Path]::GetTempPath()) (Split-Path $dumpFile -Leaf)
    }

    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $aes.Key = $key
        $inStream = [System.IO.File]::OpenRead($BackupFile)
        try {
            $iv = New-Object byte[] 16
            $read = $inStream.Read($iv, 0, 16)
            if ($read -ne 16) { throw 'File too short to contain an IV.' }
            $aes.IV = $iv
            $outStream = [System.IO.File]::Create($dumpFile)
            try {
                $crypto = New-Object System.Security.Cryptography.CryptoStream(
                    $inStream, $aes.CreateDecryptor(),
                    [System.Security.Cryptography.CryptoStreamMode]::Read)
                $crypto.CopyTo($outStream)
                $crypto.Dispose()
            } finally {
                $outStream.Dispose()
            }
        } finally {
            $inStream.Dispose()
        }
    } finally {
        $aes.Dispose()
    }
    Write-Output "Decrypted to: $dumpFile"
    if ($DecryptOnly) { exit 0 }
}

# --- Locate pg_restore ---
$PgRestore = $null
$pgRoot = 'C:\Program Files\PostgreSQL'
if (Test-Path $pgRoot) {
    $versions = Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending
    foreach ($v in $versions) {
        $candidate = Join-Path $v.FullName 'bin\pg_restore.exe'
        if (Test-Path $candidate) { $PgRestore = $candidate; break }
    }
}
if (-not $PgRestore) {
    Write-Error 'pg_restore.exe not found - install PostgreSQL client tools.'
    exit 1
}

# --- Read DATABASE_URL ---
$dbUrlLine = (Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
$dbUrl = ($dbUrlLine -split '=', 2)[1].Trim()
if ($dbUrl -notmatch '^postgres(ql)?://(?<user>[^:@/]+)(:(?<pass>[^@/]*))?@(?<dbhost>[^:/]+)(:(?<port>\d+))?/(?<db>[^?]+)') {
    Write-Error 'Could not parse DATABASE_URL from apps/api/.env.'
    exit 1
}

Write-Warning "This will OVERWRITE database '$($Matches['db'])' with the contents of the backup."
$confirm = Read-Host 'Type RESTORE to continue'
if ($confirm -ne 'RESTORE') {
    Write-Output 'Aborted.'
    exit 1
}

$env:PGPASSWORD = $Matches['pass']
try {
    & $PgRestore -h $Matches['dbhost'] -p ($(if ($Matches['port']) { $Matches['port'] } else { '5432' })) `
        -U $Matches['user'] -d $Matches['db'] --clean --if-exists $dumpFile
    if ($LASTEXITCODE -ne 0) { throw "pg_restore exited with code $LASTEXITCODE" }
    Write-Output 'Restore complete.'
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
