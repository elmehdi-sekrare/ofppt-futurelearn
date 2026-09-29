<#
.SYNOPSIS
    Stops the OFPPT attendance development servers started by start-school-server.ps1.

.DESCRIPTION
    Stops only processes that belong to this project:
      1. the background wrappers recorded in logs\school-server\school-server.state.json
         (only if the PID still has the same start time, so a reused PID is never killed);
      2. whatever still listens on port 8000 / 8080, but only if its command line
         (or a parent's) references this project folder.
    A program from another folder holding one of the ports is reported and left alone.
    Nothing else is touched: no database, no .env, no configuration, no log deletion.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-school-server.ps1

.NOTES
    Exit code 0 = both ports free (or held only by other programs, which are reported), 1 = a project server could not be stopped.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# =============================================================================
# CONFIGURATION - keep in sync with start-school-server.ps1
# =============================================================================
$Config = @{
    ProjectRoot  = (Split-Path -Parent $PSScriptRoot)
    BackendPort  = 8000
    FrontendPort = 8080
    LogDir       = ''   # empty = <ProjectRoot>\logs\school-server
}
# =============================================================================

$ProjectRoot = [IO.Path]::GetFullPath($Config.ProjectRoot).TrimEnd('\')
$LogDir      = if ($Config.LogDir) { $Config.LogDir } else { Join-Path $ProjectRoot 'logs\school-server' }
$ScriptLog   = Join-Path $LogDir 'school-server.log'
$StateFile   = Join-Path $LogDir 'school-server.state.json'
$Utf8NoBom   = New-Object System.Text.UTF8Encoding $false

if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log {
    param([ValidateSet('INFO', 'OK', 'WARN', 'ERROR')][string]$Level, [string]$Message)
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    [IO.File]::AppendAllText($ScriptLog, $line + [Environment]::NewLine, $Utf8NoBom)
    $color = @{ INFO = 'Gray'; OK = 'Green'; WARN = 'Yellow'; ERROR = 'Red' }[$Level]
    Write-Host $line -ForegroundColor $color
}

function Get-ListenerPid {
    param([int]$Port)
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { return [int]$c.OwningProcess }
        return $null
    }
    foreach ($line in @(netstat -ano -p TCP) + @(netstat -ano -p TCPv6)) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { return [int]$Matches[1] }
    }
    return $null
}

function Get-ProcInfo {
    param([int]$ProcessId)
    Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-IsProjectProcess {
    param([int]$ProcessId)
    $needle = $ProjectRoot.Replace('/', '\')
    $current = $ProcessId
    for ($i = 0; $i -lt 4 -and $current; $i++) {
        $p = Get-ProcInfo $current
        if (-not $p) { return $false }
        if ($p.CommandLine -and $p.CommandLine.Replace('/', '\') -like "*$needle*") { return $true }
        $current = [int]$p.ParentProcessId
    }
    return $false
}

# Ends a process and all of its children (npm -> node -> vite, artisan serve -> php -S).
function Stop-Tree {
    param([int]$ProcessId, [string]$Why)
    $output = & "$env:SystemRoot\System32\taskkill.exe" /PID $ProcessId /T /F 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Log OK "Stopped $Why (PID $ProcessId and children)." }
    else { Write-Log WARN "taskkill PID $ProcessId ($Why): $($output -join ' ')" }
}

$exitCode = 0
try {
    Write-Log INFO "---- stop-school-server.ps1 (project: $ProjectRoot) ----"

    # 1. Wrappers recorded at start-up.
    if (Test-Path -LiteralPath $StateFile) {
        $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
        foreach ($entry in $state.PSObject.Properties) {
            $rec = $entry.Value
            $proc = Get-Process -Id ([int]$rec.wrapperPid) -ErrorAction SilentlyContinue
            if (-not $proc) { continue }
            # PowerShell 7 already converts ISO dates in JSON to DateTime; 5.1 leaves a string.
            $recorded = if ($rec.wrapperStart -is [datetime]) { $rec.wrapperStart }
                        else { [datetime]::Parse([string]$rec.wrapperStart, $null, [Globalization.DateTimeStyles]::RoundtripKind) }
            if ([math]::Abs(($proc.StartTime - $recorded.ToLocalTime()).TotalSeconds) -gt 2) {
                Write-Log INFO "PID $($rec.wrapperPid) from the state file is now a different process; not touching it."
                continue
            }
            Stop-Tree -ProcessId $proc.Id -Why "$($entry.Name) wrapper"
        }
    }

    # 2. Anything from this project still listening on the ports.
    Start-Sleep -Milliseconds 800
    foreach ($port in @($Config.BackendPort, $Config.FrontendPort)) {
        $listener = Get-ListenerPid $port
        if (-not $listener) { Write-Log OK "Port $port is free."; continue }
        if (Test-IsProjectProcess $listener) {
            Stop-Tree -ProcessId $listener -Why "server on port $port"
            Start-Sleep -Milliseconds 800
            if (Get-ListenerPid $port) { $exitCode = 1; Write-Log ERROR "Port $port is still in use after stopping PID $listener." }
            else { Write-Log OK "Port $port is free." }
        } else {
            $info = Get-ProcInfo $listener
            $what = if ($info) { "$($info.Name) PID $listener" } else { "PID $listener" }
            Write-Log WARN "Port $port is used by another program ($what), not by this project. Left running."
        }
    }

    if (Test-Path -LiteralPath $StateFile) { Remove-Item -LiteralPath $StateFile -Force }
}
catch {
    $exitCode = 1
    Write-Log ERROR $_.Exception.Message
}
exit $exitCode
