# Provision DigitalOcean Managed Valkey (Redis-compatible) for G6 rate limits.
#
# Prerequisites:
#   [Environment]::SetEnvironmentVariable('DIGITALOCEAN_API_TOKEN','dop_v1_...','User')
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-do-valkey.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-do-valkey.ps1 -SkipCreate   # wire app only
#
param(
    [string]$AppId = 'a2be820f-a9f2-496b-bc2d-5aacef4ad7e4',
    [string]$ClusterName = 'cornea-emr-valkey',
    [string]$Region = 'sgp1',
    [string]$Size = 'db-s-1vcpu-1gb',
    [switch]$SkipCreate
)

$ErrorActionPreference = 'Stop'

$tokenVar = 'DIGITALOCEAN_API_TOKEN'
$token = [Environment]::GetEnvironmentVariable($tokenVar, 'Process')
if (-not $token) { $token = [Environment]::GetEnvironmentVariable($tokenVar, 'User') }
if (-not $token) { $token = $env:DIGITALOCEAN_API_TOKEN }
if (-not $token) {
    Write-Error "Set $tokenVar (user env var or current session)."
    exit 1
}

$base = 'https://api.digitalocean.com/v2'
$headers = @{
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

function Invoke-DoApi {
    param(
        [string]$Method = 'GET',
        [string]$Path,
        [object]$Body = $null
    )
    $uri = "$base$Path"
    if ($Body) {
        $json = $Body | ConvertTo-Json -Depth 20 -Compress
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Wait-ValkeyOnline {
    param([string]$DatabaseId)
    for ($i = 1; $i -le 60; $i++) {
        $db = Invoke-DoApi -Path "/databases/$DatabaseId"
        $status = $db.database.status
        Write-Host "  Valkey status: $status ($i/60)"
        if ($status -eq 'online') { return $db.database }
        Start-Sleep -Seconds 10
    }
    throw 'Valkey cluster did not become online within 10 minutes.'
}

Write-Host ''
Write-Host '=== DO Valkey setup (G6) ===' -ForegroundColor Cyan
Write-Host "App:    $AppId"
Write-Host "Region: $Region"
Write-Host ''

$list = Invoke-DoApi -Path '/databases'
$existing = $list.databases | Where-Object { $_.name -eq $ClusterName -or $_.engine -eq 'valkey' } | Select-Object -First 1

if ($existing) {
    Write-Host "Using existing Valkey cluster: $($existing.name) ($($existing.id))" -ForegroundColor Green
    $databaseId = $existing.id
} elseif ($SkipCreate) {
    Write-Error "No Valkey cluster found and -SkipCreate was set."
    exit 1
} else {
    Write-Host "Creating Valkey cluster '$ClusterName' ($Size in $Region)..." -ForegroundColor Yellow
    Write-Host 'Estimated cost: ~USD 15/month for db-s-1vcpu-1gb (check DO pricing).'
    $createBody = @{
        name      = $ClusterName
        engine    = 'valkey'
        version   = '8'
        region    = $Region
        size      = $Size
        num_nodes = 1
        tags      = @('cornea-emr', 'g6-rate-limit')
    }
    $created = Invoke-DoApi -Method POST -Path '/databases' -Body $createBody
    $databaseId = $created.database.id
    Write-Host "Cluster id: $databaseId - waiting for online..."
    $null = Wait-ValkeyOnline -DatabaseId $databaseId
}

Write-Host 'Configuring trusted source (App Platform)...' -ForegroundColor Cyan
$firewallBody = @{
    rules = @(
        @{ type = 'app'; value = $AppId }
    )
}
Invoke-DoApi -Method PUT -Path "/databases/$databaseId/firewall" -Body $firewallBody | Out-Null

$db = Invoke-DoApi -Path "/databases/$databaseId"
$redisUrl = $db.database.connection.uri
if (-not $redisUrl) {
    throw 'Could not read Valkey connection URI from DO API.'
}

# node-redis accepts rediss:// from DO TLS endpoints.
if ($redisUrl -notmatch '^redis') {
    throw "Unexpected connection URI scheme: $($redisUrl.Substring(0, [Math]::Min(12, $redisUrl.Length)))..."
}

Write-Host 'Valkey URI retrieved (not printing - contains password).' -ForegroundColor Green

Write-Host 'Updating App Platform REDIS_URL...' -ForegroundColor Cyan
$appResp = Invoke-DoApi -Path "/apps/$AppId"
$spec = $appResp.app.spec
if (-not $spec.envs) { $spec.envs = @() }

$spec.envs = @($spec.envs | Where-Object { $_.key -ne 'REDIS_URL' })
$spec.envs += [PSCustomObject]@{
    key   = 'REDIS_URL'
    value = $redisUrl
    scope = 'RUN_TIME'
    type  = 'SECRET'
}

$updateBody = @{ spec = $spec }
$update = Invoke-DoApi -Method PUT -Path "/apps/$AppId" -Body $updateBody

Write-Host ''
Write-Host 'DEPLOYMENT SUBMITTED' -ForegroundColor Green
Write-Host "  Deployment id: $($update.deployment.id)"
Write-Host "  Valkey id:     $databaseId"
Write-Host "  Cluster:       $($db.database.name)"
Write-Host ''
Write-Host 'After deploy (~3-5 min), confirm in API logs:'
Write-Host '  Redis connected - shared rate limits active'
Write-Host ''
Write-Host 'Local check: npm run health:production'
Write-Host ''

# Persist id for ops (gitignored file ok if in backups - use scripts config)
$configPath = Join-Path $PSScriptRoot 'do-valkey-config.json'
@{
    databaseId  = $databaseId
    clusterName = $db.database.name
    region      = $Region
    appId       = $AppId
    updatedAt   = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
Write-Host "Wrote $configPath (contains id only, not password)."
