# Add clinic.local and api.local to the Windows hosts file (requires Administrator).
# Run: powershell -ExecutionPolicy Bypass -File scripts\setup-hosts.ps1

$ErrorActionPreference = 'Stop'

$hostsPath = Join-Path $env:Windir 'System32\drivers\etc\hosts'
$entries = @(
    '127.0.0.1 clinic.local',
    '127.0.0.1 api.local'
)

$content = Get-Content $hostsPath -Raw
$added = @()

foreach ($line in $entries) {
    $hostName = ($line -split '\s+')[1]
    if ($content -match [regex]::Escape($hostName)) {
        Write-Host "Already present: $hostName"
    } else {
        Add-Content -Path $hostsPath -Value $line -Encoding ASCII
        $added += $line
        Write-Host "Added: $line"
    }
}

if ($added.Count -eq 0) {
    Write-Host 'Hosts file already configured.'
} else {
    Write-Host 'Hosts file updated. clinic.local and api.local now resolve to 127.0.0.1'
}
