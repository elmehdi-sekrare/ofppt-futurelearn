#requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# ============================================================
# OFPPT SERVER MAINTENANCE SETUP
# Internal implementation details are intentionally not displayed.
# The script is safe to re-run: existing credentials are preserved.
# ============================================================

$ProfileName = "OFPPT_Maintenance"
$AnyDeskConfig = "C:\ProgramData\AnyDesk\system.conf"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}
function Write-OK {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}
function Write-Warn {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}
function Stop-WithError {
    param([string]$Message)
    Write-Host ""
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Invoke-MaintenanceClient {
    param(
        [Parameter(Mandatory=$true)][string]$Executable,
        [Parameter(Mandatory=$true)][string[]]$Arguments,
        [Parameter(Mandatory=$false)][AllowEmptyString()][string]$Password = $null
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Executable
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $psi.ArgumentList.Clear()
    foreach ($arg in $Arguments) {
        [void]$psi.ArgumentList.Add([string]$arg)
    }

    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi

    try {
        [void]$p.Start()

        if ($null -ne $Password) {
            $p.StandardInput.WriteLine($Password)
        }
        $p.StandardInput.Close()

        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        $p.WaitForExit()

        return [pscustomobject]@{
            ExitCode = $p.ExitCode
            StdOut   = $stdout
            StdErr   = $stderr
        }
    }
    finally {
        $p.Dispose()
    }
}

function Get-ProfileConfig {
    param([string]$ConfigPath)

    $result = @{
        UnattendedPassword = $false
        UnattendedSalt     = $false
        CustomPassword     = $false
        CustomSalt         = $false
        CustomDefined      = $false
    }

    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        return $result
    }

    $text = Get-Content -LiteralPath $ConfigPath -Raw -ErrorAction SilentlyContinue
    if (-not $text) {
        return $result
    }

    $result.UnattendedPassword = $text -match '(?m)^ad\.security\.permission_profiles\._unattended_access\.pwd='
    $result.UnattendedSalt     = $text -match '(?m)^ad\.security\.permission_profiles\._unattended_access\.salt='
    $result.CustomPassword     = $text -match '(?m)^ad\.security\.permission_profiles\.[^.=\r\n]+\.pwd='
    $result.CustomSalt         = $text -match '(?m)^ad\.security\.permission_profiles\.[^.=\r\n]+\.salt='
    $result.CustomDefined      = $text -match ('(?m)^ad\.security\.permission_profiles\.define\.[^=]+=' + [regex]::Escape($ProfileName) + '$')

    return $result
}

# ============================================================
# START
# ============================================================

Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       OFPPT SERVER MAINTENANCE SETUP" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This utility configures the authorized remote"
Write-Host "maintenance service for this server."
Write-Host ""

# ============================================================
# 1. FIND REMOTE MAINTENANCE CLIENT
# ============================================================

Write-Step "Searching for remote maintenance service..."

$candidates = @(
    "C:\Program Files (x86)\AnyDesk\AnyDesk.exe",
    "C:\Program Files\AnyDesk\AnyDesk.exe",
    "$env:ProgramData\AnyDesk\AnyDesk.exe",
    "$env:LOCALAPPDATA\AnyDesk\AnyDesk.exe",
    "$env:USERPROFILE\Downloads\AnyDesk.exe",
    "$env:USERPROFILE\Desktop\AnyDesk.exe"
)

$MaintenanceClient = $null

foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        $MaintenanceClient = $candidate
        break
    }
}

if (-not $MaintenanceClient) {
    $command = Get-Command "AnyDesk.exe" -ErrorAction SilentlyContinue
    if ($command) {
        $MaintenanceClient = $command.Source
    }
}

if (-not $MaintenanceClient) {
    foreach ($root in @("C:\Program Files (x86)", "C:\Program Files", "$env:ProgramData", "$env:LOCALAPPDATA")) {
        if (-not (Test-Path -LiteralPath $root)) { continue }

        try {
            $found = Get-ChildItem -LiteralPath $root -Filter "AnyDesk.exe" -File -Recurse -ErrorAction SilentlyContinue |
                Select-Object -First 1
            if ($found) {
                $MaintenanceClient = $found.FullName
                break
            }
        }
        catch {}
    }
}

if (-not $MaintenanceClient) {
    Stop-WithError "The authorized remote maintenance service was not found. Install the approved maintenance client and run this script again."
}

Write-OK "Remote maintenance service detected."

# ============================================================
# 2. SERVICE
# ============================================================

Write-Step "Checking remote maintenance service..."

$service = Get-Service -Name "AnyDesk" -ErrorAction SilentlyContinue

if (-not $service) {
    Write-Warn "Remote maintenance service was not found. Attempting installation..."

    $installDirectory = Split-Path -Parent $MaintenanceClient

    try {
        $install = Start-Process `
            -FilePath $MaintenanceClient `
            -ArgumentList @("--install", $installDirectory, "--start-with-win", "--silent") `
            -Wait -PassThru -WindowStyle Hidden

        if ($install.ExitCode -ne 0) {
            Stop-WithError "Remote maintenance service installation returned exit code $($install.ExitCode)."
        }
    }
    catch {
        Stop-WithError "Unable to install the remote maintenance service: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 5
    $service = Get-Service -Name "AnyDesk" -ErrorAction SilentlyContinue
}

if (-not $service) {
    Stop-WithError "The remote maintenance Windows service could not be found."
}

Write-OK "Remote maintenance service exists."

# ============================================================
# 3. START SERVICE
# ============================================================

Write-Step "Making sure the remote maintenance service is running..."

if ($service.Status -ne "Running") {
    try {
        Start-Service -Name "AnyDesk"
        Start-Sleep -Seconds 3
        $service = Get-Service -Name "AnyDesk"
    }
    catch {
        Stop-WithError "Could not start the remote maintenance service: $($_.Exception.Message)"
    }
}

if ($service.Status -ne "Running") {
    Stop-WithError "The remote maintenance service is not running."
}

Write-OK "Remote maintenance service is RUNNING."

# ============================================================
# 4. READ CURRENT ACCESS STATE
# ============================================================

Write-Step "Checking existing maintenance access configuration..."

Start-Sleep -Seconds 1

$config = Get-ProfileConfig -ConfigPath $AnyDeskConfig

if ($config.CustomDefined) {
    Write-OK "$ProfileName profile already exists."
}
else {
    Write-Host "The $ProfileName profile does not exist yet."
}

if ($config.UnattendedPassword -and $config.UnattendedSalt) {
    Write-OK "Unattended remote access is already configured."
}
else {
    Write-Warn "Unattended remote access is not currently configured."
}

# ============================================================
# 5. ASK FOR PASSWORDS ONLY WHEN NECESSARY
# ============================================================

$maintenanceSecure = $null
$unattendedSecure = $null
$maintenancePlain = $null
$unattendedPlain = $null
$maintenancePtr = [IntPtr]::Zero
$unattendedPtr = [IntPtr]::Zero

try {

    # --------------------------------------------------------
    # Create custom profile if it does not exist.
    # --------------------------------------------------------

    if (-not $config.CustomDefined) {

        Write-Step "Creating $ProfileName permission profile..."

        Write-Host ""
        Write-Host "Enter the password that will protect the OFPPT maintenance profile."
        Write-Host "This password must be DIFFERENT from the unattended remote access password."
        Write-Host ""

        $maintenanceSecure = Read-Host "Maintenance profile password" -AsSecureString

        $maintenancePtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($maintenanceSecure)
        $maintenancePlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($maintenancePtr)

        if ([string]::IsNullOrWhiteSpace($maintenancePlain)) {
            Stop-WithError "The maintenance profile password is empty."
        }

        if ($maintenancePlain.Length -lt 8) {
            Stop-WithError "The maintenance profile password must contain at least 8 characters."
        }

        $permissions = @(
            "+input",
            "+restart",
            "+sas",
            "+sysinfo",
            "+privacy_feature"
        )

        $createArgs = @("--add-profile", $ProfileName) + $permissions

        $result = Invoke-MaintenanceClient `
            -Executable $MaintenanceClient `
            -Arguments $createArgs `
            -Password $maintenancePlain

        if ($result.ExitCode -ne 0) {
            Stop-WithError @"
Could not create the $ProfileName profile.

Exit code: $($result.ExitCode)
$($result.StdErr)
"@
        }

        Write-OK "$ProfileName profile created."
        $config.CustomDefined = $true
    }
    else {
        Write-OK "$ProfileName already exists; its password will NOT be overwritten."
    }

    # --------------------------------------------------------
    # Configure unattended remote access only if it has no password.
    # --------------------------------------------------------

    if (-not ($config.UnattendedPassword -and $config.UnattendedSalt)) {

        Write-Step "Configuring unattended remote access..."

        Write-Host ""
        Write-Host "Enter the password for unattended remote access."
        Write-Host "IMPORTANT: it must be different from the maintenance profile password."
        Write-Host ""

        $unattendedSecure = Read-Host "Remote access password" -AsSecureString

        $unattendedPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($unattendedSecure)
        $unattendedPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($unattendedPtr)

        if ([string]::IsNullOrWhiteSpace($unattendedPlain)) {
            Stop-WithError "The remote access password is empty."
        }

        if ($unattendedPlain.Length -lt 8) {
            Stop-WithError "The remote access password must contain at least 8 characters."
        }

        if ($config.CustomDefined -and $maintenancePlain -and ($unattendedPlain -ceq $maintenancePlain)) {
            Stop-WithError "The two remote access passwords must be different. Enter a different unattended remote access password."
        }

        $result = Invoke-MaintenanceClient `
            -Executable $MaintenanceClient `
            -Arguments @("--set-password") `
            -Password $unattendedPlain

        if ($result.ExitCode -ne 0) {
            Stop-WithError @"
Could not configure unattended remote access.

Exit code: $($result.ExitCode)
$($result.StdErr)

The remote access password may already be assigned to another
maintenance access profile.
"@
        }

        Write-OK "Unattended remote access password configured."
    }
    else {
        Write-OK "Existing unattended remote access password preserved."
    }

    # --------------------------------------------------------
    # Re-read configuration after changes.
    # --------------------------------------------------------

    Start-Sleep -Seconds 2
    $config = Get-ProfileConfig -ConfigPath $AnyDeskConfig

    if (-not $config.CustomDefined) {
        Stop-WithError "$ProfileName could not be verified after configuration."
    }

    if (-not ($config.UnattendedPassword -and $config.UnattendedSalt)) {
        Stop-WithError "Unattended remote access could not be verified after configuration."
    }

    Write-OK "$ProfileName is configured."
    Write-OK "Unattended remote access is configured."

}
finally {
    $maintenancePlain = $null
    $unattendedPlain = $null
    $maintenanceSecure = $null
    $unattendedSecure = $null

    if ($maintenancePtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($maintenancePtr)
    }

    if ($unattendedPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($unattendedPtr)
    }

    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

# ============================================================
# 6. GET SERVER MAINTENANCE ID
# ============================================================

Write-Step "Reading server maintenance ID..."

$ServerID = $null

try {
    # Capture the maintenance client output through cmd.exe because
    # some builds do not expose the ID directly to PowerShell.
    $raw = cmd.exe /c "`"$MaintenanceClient`" --get-id 2>&1"

    foreach ($line in @($raw)) {
        if ($line -match '\b\d{6,}\b') {
            $ServerID = $Matches[0]
            break
        }
    }
}
catch {
    $ServerID = $null
}

if ($ServerID) {
    Write-OK "Server maintenance ID: $ServerID"
}
else {
    Write-Warn "Could not automatically read the server maintenance ID."
}

# ============================================================
# FINAL RESULT
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "             SETUP COMPLETE" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

if ($ServerID) {
    Write-Host "Server maintenance ID:" -ForegroundColor Cyan
    Write-Host "    $ServerID" -ForegroundColor White
    Write-Host ""
}

Write-OK "Remote maintenance service is running."
Write-OK "$ProfileName permission profile is configured."
Write-OK "Unattended remote access is configured."
Write-OK "Privacy Mode permission is enabled for the maintenance profile."

Write-Host ""
Write-Host "Passwords were not written to this script or repository."
Write-Host ""
Write-Host "Use the server maintenance ID above with the authorized"
Write-Host "remote maintenance credential from your maintenance computer."
Write-Host ""
Write-Host "SECURITY:" -ForegroundColor Yellow
Write-Host "Keep the authorized remote maintenance credential private."
Write-Host ""
