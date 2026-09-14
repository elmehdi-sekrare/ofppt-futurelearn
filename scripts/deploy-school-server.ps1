# Run this from PowerShell on the school server after copying the project folder.
# Open PowerShell as Administrator only when changing Apache or Windows Firewall settings.

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendTarget = Join-Path $backendRoot 'public\app'

Set-Location $projectRoot
npm ci
npm run build:school-server

if (Test-Path -LiteralPath $frontendTarget) {
    Remove-Item -LiteralPath $frontendTarget -Recurse -Force
}
New-Item -ItemType Directory -Path $frontendTarget -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'dist\*') -Destination $frontendTarget -Recurse -Force

Set-Location $backendRoot
composer install --no-dev --optimize-autoloader
php artisan migrate --force
if (-not (Test-Path -LiteralPath (Join-Path $backendRoot 'public\storage'))) {
    php artisan storage:link
}
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

Write-Host "Deployment complete. Start Apache, then open http://SERVER-IP/app/ from another school computer." -ForegroundColor Green
