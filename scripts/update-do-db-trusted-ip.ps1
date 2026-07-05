# Cornea EMR — update DigitalOcean PostgreSQL trusted source for this PC's current public IP.
# Use when your ISP assigns a dynamic IP and pg_dump / backup-production.ps1 times out.
#
# One-time setup:
#   1. DigitalOcean -> API -> Generate token (read/write)
#   2. Databases -> your cluster -> copy UUID from URL or Overview
#   3. Copy scripts/do-db-config.json.example -> scripts/do-db-config.json
#   4. Set databaseId; store token in user env (never commit):
#        [Environment]::SetEnvironmentVariable('DIGITALOCEAN_API_TOKEN','dop_v1_...','User')
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\update-do-db-trusted-ip.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\update-do-db-trusted-ip.ps1 -WhatIf

param(
    [string]$ConfigFile = '',
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$Scripts = $PSScriptRoot
if (-not $ConfigFile) {
    $ConfigFile = Join-Path $Scripts 'do-db-config.json'
}

if (-not (Test-Path $ConfigFile)) {
    Write-Host ''
    Write-Host 'DigitalOcean firewall config not found.'
    Write-Host "Copy scripts\do-db-config.json.example -> scripts\do-db-config.json"
    Write-Host 'Set databaseId and DIGITALOCEAN_API_TOKEN (user environment variable).'
    Write-Host ''
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
$tokenVar = if ($config.apiTokenEnvVar) { $config.apiTokenEnvVar } else { 'DIGITALOCEAN_API_TOKEN' }
$token = [Environment]::GetEnvironmentVariable($tokenVar, 'User')
if (-not $token) { $token = [Environment]::GetEnvironmentVariable($tokenVar, 'Process') }
if (-not $token) { $token = [Environment]::GetEnvironmentVariable($tokenVar, 'Machine') }
if (-not $token) {
    throw "API token not found in environment variable '$tokenVar'."
}
if (-not $config.databaseId -or $config.databaseId -match 'YOUR_DATABASE') {
    throw 'Set databaseId in scripts/do-db-config.json (DigitalOcean database cluster UUID).'
}

function Invoke-DoApi {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $headers = @{
        Authorization = "Bearer $token"
        'Content-Type' = 'application/json'
    }
    $uri = "https://api.digitalocean.com/v2$Path"
    if ($Body) {
        $json = $Body | ConvertTo-Json -Depth 6 -Compress
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

Write-Host 'Detecting public IP...'
$publicIp = (Invoke-RestMethod -Uri 'https://api.ipify.org?format=json').ip
if (-not $publicIp) { throw 'Could not detect public IP.' }
Write-Host "Public IP: $publicIp"

$fw = Invoke-DoApi -Method GET -Path "/databases/$($config.databaseId)/firewall"
$existing = @($fw.rules)
$preserved = @($existing | Where-Object { $_.type -ne 'ip_addr' })
$currentIps = @($existing | Where-Object { $_.type -eq 'ip_addr' } | ForEach-Object { $_.value })

if ($currentIps -contains $publicIp) {
    Write-Host 'Trusted IP already present - no API change needed.'
    exit 0
}

$ipSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($ip in $currentIps) { [void]$ipSet.Add([string]$ip) }
foreach ($ip in @($config.extraTrustedIps)) {
    if ($ip) { [void]$ipSet.Add([string]$ip) }
}
[void]$ipSet.Add([string]$publicIp)
$ipRules = @($ipSet | ForEach-Object { @{ type = 'ip_addr'; value = $_ } })
$newRules = @($preserved + $ipRules)
$targetIps = @($ipSet)

Write-Host 'Current ip_addr rules:' ($currentIps -join ', ')
Write-Host 'New ip_addr rules:    ' ($targetIps -join ', ')
Write-Host "Preserved non-IP rules: $($preserved.Count) (app/droplet/k8s/tag)"

if ($WhatIf) {
    Write-Host 'WhatIf: firewall not updated.'
    exit 0
}

Invoke-DoApi -Method PUT -Path "/databases/$($config.databaseId)/firewall" -Body @{ rules = $newRules } | Out-Null
Write-Host 'Firewall updated. Wait 30–60 seconds before pg_dump.'
Start-Sleep -Seconds 5
