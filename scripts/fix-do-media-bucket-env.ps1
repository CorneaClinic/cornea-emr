# Fix typo EDIA_S3_BUCKET -> MEDIA_S3_BUCKET on DigitalOcean App Platform
param(
    [string]$AppId = 'a2be820f-a9f2-496b-bc2d-5aacef4ad7e4'
)

$token = $env:DIGITALOCEAN_API_TOKEN
if (-not $token) {
    Write-Error 'Set DIGITALOCEAN_API_TOKEN environment variable'
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

$resp = Invoke-RestMethod -Uri "https://api.digitalocean.com/v2/apps/$AppId" -Headers @{ Authorization = "Bearer $token" }
$spec = $resp.app.spec

# Remove typo key; ensure correct bucket key exists
$spec.envs = @($spec.envs | Where-Object { $_.key -ne 'EDIA_S3_BUCKET' })
$bucketEnv = $spec.envs | Where-Object { $_.key -eq 'MEDIA_S3_BUCKET' } | Select-Object -First 1
if (-not $bucketEnv) {
    $spec.envs += [PSCustomObject]@{
        key   = 'MEDIA_S3_BUCKET'
        value = 'corneaclinic-storage'
        scope = 'RUN_TIME'
    }
} elseif (-not $bucketEnv.value) {
    $bucketEnv.value = 'corneaclinic-storage'
}

$payload = @{ spec = $spec } | ConvertTo-Json -Depth 30 -Compress
$update = Invoke-RestMethod -Method Put -Uri "https://api.digitalocean.com/v2/apps/$AppId" -Headers $headers -Body $payload

Write-Host 'App update submitted. Deployment ID:' $update.deployment.id
$spec.envs | Where-Object { $_.key -like 'MEDIA*' -or $_.key -like '*S3*' } | ForEach-Object {
    Write-Host "  $($_.key) = $($_.value)"
}
