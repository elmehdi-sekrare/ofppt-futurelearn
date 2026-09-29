# Run this from PowerShell on the school server after copying the project folder.
# Open PowerShell as Administrator only when changing Apache or Windows Firewall settings.

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendTarget = Join-Path $backendRoot 'public\app'

Set-Location $projectRoot
npm ci
# The school-server build writes straight into backend\public\app (see vite.config.ts),
# so there is nothing to copy afterwards.
npm run build:school-server
if (-not (Test-Path -LiteralPath (Join-Path $frontendTarget 'index.html'))) {
    throw "Frontend build did not produce $frontendTarget\index.html"
}

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
