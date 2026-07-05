# Post-backup verification — pg_restore catalog + off-site size check.
# Called automatically from backup-db.ps1 after a successful dump.
param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ConfigFile = Join-Path $PSScriptRoot 'backup-config.json'
$VerifyLog = Join-Path (Split-Path $DumpFile) 'backup-verify.log'

function Write-VerifyLog($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path $VerifyLog -Value $line -Encoding UTF8
}

function Get-PgRestore {
    $pgRoot = 'C:\Program Files\PostgreSQL'
    if (Test-Path $pgRoot) {
        foreach ($v in (Get-ChildItem $pgRoot -Directory | Sort-Object { [int]$_.Name } -Descending)) {
            $exe = Join-Path $v.FullName 'bin\pg_restore.exe'
            if (Test-Path $exe) { return $exe }
        }
    }
    $cmd = Get-Command pg_restore -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

if (-not (Test-Path $DumpFile)) {
    Write-VerifyLog "VERIFY FAIL: dump not found $DumpFile"
    exit 1
}

$pgRestore = Get-PgRestore
if ($pgRestore) {
    & $pgRestore -l $DumpFile | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-VerifyLog "VERIFY FAIL: pg_restore -l exit $LASTEXITCODE for $DumpFile"
        exit 1
    }
    Write-VerifyLog "VERIFY OK: catalog valid for $(Split-Path $DumpFile -Leaf)"
} else {
    Write-VerifyLog "VERIFY SKIP: pg_restore not found"
}

if (Test-Path $ConfigFile) {
    try {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        $offsite = $config.offsiteDir
        if ($DumpFile -match '\\production\\' -and $offsite) {
            $offsite = Join-Path $offsite 'production'
        }
        if ($offsite) {
            $enc = Join-Path $offsite ((Split-Path $DumpFile -Leaf) + '.enc')
            if (-not (Test-Path $enc)) {
                Write-VerifyLog "VERIFY WARN: off-site enc missing $enc"
            } else {
                $dumpSize = (Get-Item $DumpFile).Length
                $encSize = (Get-Item $enc).Length
                if ($encSize -lt $dumpSize) {
                    Write-VerifyLog "VERIFY FAIL: enc smaller than dump ($encSize < $dumpSize)"
                    exit 1
                }
                Write-VerifyLog "VERIFY OK: off-site enc matches $(Split-Path $enc -Leaf)"
            }
        }
    } catch {
        Write-VerifyLog "VERIFY WARN: config parse failed — $($_.Exception.Message)"
    }
}

exit 0
