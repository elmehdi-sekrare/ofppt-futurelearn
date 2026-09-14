# Create a daily backup of the SQLite database and uploaded justification files.
# Configure this script in Windows Task Scheduler to run once every evening.

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$backupRoot = 'D:\OFPPT-Attendance-Backups'
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$backupFolder = Join-Path $backupRoot $stamp

New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $backendRoot 'database\database.sqlite') -Destination (Join-Path $backupFolder 'database.sqlite') -Force
if (Test-Path -LiteralPath (Join-Path $backendRoot 'storage\app\public')) {
    Copy-Item -LiteralPath (Join-Path $backendRoot 'storage\app\public') -Destination (Join-Path $backupFolder 'uploads') -Recurse -Force
}
Compress-Archive -Path (Join-Path $backupFolder '*') -DestinationPath (Join-Path $backupRoot "ofppt-attendance_$stamp.zip") -Force
Remove-Item -LiteralPath $backupFolder -Recurse -Force

# Keep 30 days of backups. Change 30 if the school needs a longer retention period.
Get-ChildItem -Path $backupRoot -Filter 'ofppt-attendance_*.zip' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
