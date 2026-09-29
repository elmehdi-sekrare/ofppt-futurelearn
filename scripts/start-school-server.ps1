<#
.SYNOPSIS
    Starts the OFPPT attendance development servers (Laravel + Vite) in the
    background so every PC on the school network can reach the app.

.DESCRIPTION
    - Laravel:  php artisan serve --host=0.0.0.0 --port=8000   (in backend\)
    - Vite:     npm run dev -- --host 0.0.0.0                   (in the project root, port 8080 from vite.config.ts)

    Each server writes to its own persistent log file (appended, never erased):
        logs\school-server\backend.log
        logs\school-server\frontend.log
    This script writes its own report to logs\school-server\school-server.log.

    Safe to run again at any time: a server that is already running from this
    project is left alone, and a port held by another program is reported,
    never killed.

    This script NEVER runs migrations, seeders, composer install, npm install,
    and never edits .env, the SQLite database or the Vite/Laravel config.

.PARAMETER CheckOnly
    Only resolve PHP/Node, check prerequisites and ports, print the result, and
    exit without starting anything. Use this first on a new machine.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-school-server.ps1 -CheckOnly
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-school-server.ps1

.NOTES
    Exit code 0 = both servers running, 1 = at least one problem (see the log).
    Written for Windows PowerShell 5.1 (built into Windows 10/11).
#>
[CmdletBinding()]
param(
    [switch]$CheckOnly
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# =============================================================================
# CONFIGURATION - the only section you should need to edit.
# Leave PhpExe / NodeDir empty to auto-detect (Laragon first, then PATH).
# If auto-detection picks the wrong version, run with -CheckOnly, then paste
# the full path you want here.
# =============================================================================
$Config = @{
    # Folder that contains package.json and backend\ (defaults to this script's parent folder).
    ProjectRoot           = (Split-Path -Parent $PSScriptRoot)

    # Laragon install folder. Used to find PHP/Node under bin\ and, optionally, to launch Laragon.
    LaragonRoot           = 'C:\laragon2'

    # Full path to php.exe, e.g. 'C:\laragon2\bin\php\php-8.3.16-Win32-vs16-x64\php.exe'. Empty = auto-detect.
    PhpExe                = ''

    # Folder containing node.exe AND npm.cmd, e.g. 'C:\laragon2\bin\nodejs\node-v20.18.0'. Empty = auto-detect.
    NodeDir               = ''

    # Address other school PCs use. Only used in messages; it does not change any binding.
    LanIp                 = '192.168.1.38'

    BindHost              = '0.0.0.0'
    BackendPort           = 8000
    FrontendPort          = 8080   # must match server.port in vite.config.ts

    # How long to wait for both servers to start listening.
    StartupTimeoutSeconds = 90

    # Set to $true to also open Laragon (not needed by these servers; useful if you use its tools).
    LaunchLaragon         = $false
    LaragonExe            = 'C:\laragon2\laragon.exe'

    # Empty = <ProjectRoot>\logs\school-server (ignored by Git via .gitignore "logs").
    LogDir                = ''

    # A server log bigger than this is renamed to *.log.1 before the next start.
    MaxLogSizeMB          = 10
}
# =============================================================================

$ProjectRoot = [IO.Path]::GetFullPath($Config.ProjectRoot).TrimEnd('\')
$BackendRoot = Join-Path $ProjectRoot 'backend'
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

function Step-LogRotation {
    param([string]$Path)
    if ((Test-Path -LiteralPath $Path) -and ((Get-Item -LiteralPath $Path).Length -gt ($Config.MaxLogSizeMB * 1MB))) {
        Move-Item -LiteralPath $Path -Destination "$Path.1" -Force
    }
}

# --- Process / port helpers ---------------------------------------------------

function Get-ListenerPid {
    param([int]$Port)
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) { return [int]$c.OwningProcess }
        return $null
    }
    # Fallback for systems without the NetTCPIP module.
    foreach ($line in (netstat -ano -p TCP)) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { return [int]$Matches[1] }
    }
    foreach ($line in (netstat -ano -p TCPv6)) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { return [int]$Matches[1] }
    }
    return $null
}

function Get-ProcInfo {
    param([int]$ProcessId)
    Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

# A process "belongs to this project" when its command line, or that of one of
# its parents, references the project folder. Used to avoid touching anything else.
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

function Get-Tail {
    param([string]$Path, [int]$Lines = 15)
    if (Test-Path -LiteralPath $Path) { return (Get-Content -LiteralPath $Path -Tail $Lines) -join [Environment]::NewLine }
    return '(log file not created)'
}

# --- Requirements read from the repository ----------------------------------

function Get-MinPhpVersion {
    # backend\composer.json -> "require": { "php": "^8.2" }
    $composer = Get-Content -LiteralPath (Join-Path $BackendRoot 'composer.json') -Raw | ConvertFrom-Json
    if ($composer.require.php -match '(\d+)\.(\d+)') { return [version]"$($Matches[1]).$($Matches[2])" }
    return [version]'8.2'
}

function Get-MinNodeMajor {
    # node_modules\vite\package.json -> "engines": { "node": "^18.0.0 || >=20.0.0" }
    $vitePkg = Join-Path $ProjectRoot 'node_modules\vite\package.json'
    if (Test-Path -LiteralPath $vitePkg) {
        $pkg = Get-Content -LiteralPath $vitePkg -Raw | ConvertFrom-Json
        if ($pkg.engines -and $pkg.engines.node -match '(\d+)') { return [int]$Matches[1] }
    }
    return 18
}

# --- Executable discovery -----------------------------------------------------

function Get-ExeVersion {
    param([string]$Exe, [string[]]$VersionArgs)
    try {
        $out = & $Exe @VersionArgs 2>$null | Select-Object -First 1
        if ($out -match '(\d+)\.(\d+)\.(\d+)') { return [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" }
    } catch { }
    return $null
}

function Resolve-Php {
    param([version]$MinVersion)
    $candidates = New-Object System.Collections.Generic.List[string]
    $explicit = [bool]$Config.PhpExe
    if ($explicit) {
        $candidates.Add($Config.PhpExe)
    } else {
        $laragonPhp = Join-Path $Config.LaragonRoot 'bin\php'
        if (Test-Path -LiteralPath $laragonPhp) {
            Get-ChildItem -LiteralPath $laragonPhp -Directory |
                ForEach-Object { Join-Path $_.FullName 'php.exe' } |
                Where-Object { Test-Path -LiteralPath $_ } |
                Sort-Object { Get-ExeVersion $_ @('-r', 'echo PHP_VERSION;') } -Descending |
                ForEach-Object { $candidates.Add($_) }
        }
        Get-Command php.exe -All -CommandType Application -ErrorAction SilentlyContinue |
            ForEach-Object { if (-not $candidates.Contains($_.Source)) { $candidates.Add($_.Source) } }
    }

    $rejected = @()
    foreach ($exe in $candidates) {
        if (-not (Test-Path -LiteralPath $exe)) { $rejected += "$exe (file not found)"; continue }
        $v = Get-ExeVersion $exe @('-r', 'echo PHP_VERSION;')
        if (-not $v) { $rejected += "$exe (could not read version)"; continue }
        if ($v -lt $MinVersion) { $rejected += "$exe (PHP $v, need >= $MinVersion)"; continue }
        $modules = & $exe -m 2>$null
        if (-not ($modules -contains 'pdo_sqlite')) { $rejected += "$exe (PHP $v, extension pdo_sqlite not enabled)"; continue }
        return @{ Exe = $exe; Version = $v; Rejected = $rejected }
    }
    $hint = if ($explicit) { 'Fix $Config.PhpExe.' } else { 'Set $Config.PhpExe to a PHP >= ' + $MinVersion + ' with pdo_sqlite enabled.' }
    throw ("No usable PHP found. $hint" + $(if ($rejected) { " Checked: " + ($rejected -join '; ') } else { " No php.exe found under $($Config.LaragonRoot)\bin\php or on PATH." }))
}

function Resolve-Node {
    param([int]$MinMajor)
    $candidates = New-Object System.Collections.Generic.List[string]
    $explicit = [bool]$Config.NodeDir
    if ($explicit) {
        $candidates.Add($Config.NodeDir)
    } else {
        $laragonNode = Join-Path $Config.LaragonRoot 'bin\nodejs'
        if (Test-Path -LiteralPath $laragonNode) {
            Get-ChildItem -LiteralPath $laragonNode -Directory |
                Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node.exe') } |
                Sort-Object { Get-ExeVersion (Join-Path $_.FullName 'node.exe') @('--version') } -Descending |
                ForEach-Object { $candidates.Add($_.FullName) }
        }
        Get-Command node.exe -All -CommandType Application -ErrorAction SilentlyContinue |
            ForEach-Object { $d = Split-Path -Parent $_.Source; if (-not $candidates.Contains($d)) { $candidates.Add($d) } }
    }

    $rejected = @()
    foreach ($dir in $candidates) {
        $node = Join-Path $dir 'node.exe'
        $npm = Join-Path $dir 'npm.cmd'
        if (-not (Test-Path -LiteralPath $node)) { $rejected += "$dir (node.exe not found)"; continue }
        if (-not (Test-Path -LiteralPath $npm)) { $rejected += "$dir (npm.cmd not found next to node.exe)"; continue }
        $v = Get-ExeVersion $node @('--version')
        if (-not $v) { $rejected += "$dir (could not read version)"; continue }
        if ($v.Major -lt $MinMajor) { $rejected += "$dir (Node $v, need >= $MinMajor)"; continue }
        return @{ Dir = $dir; Node = $node; Npm = $npm; Version = $v; Rejected = $rejected }
    }
    $hint = if ($explicit) { 'Fix $Config.NodeDir.' } else { "Set `$Config.NodeDir to a folder with node.exe (>= $MinMajor) and npm.cmd." }
    throw ("No usable Node.js found. $hint" + $(if ($rejected) { " Checked: " + ($rejected -join '; ') } else { " No node.exe found under $($Config.LaragonRoot)\bin\nodejs or on PATH." }))
}

# --- Read-only prerequisite checks -----------------------------------------------

function Get-SqlitePath {
    # Reads backend\.env without modifying it. Mirrors Laravel's default path when DB_DATABASE is unset.
    $envFile = Join-Path $BackendRoot '.env'
    $connection = 'sqlite'; $database = ''
    foreach ($line in (Get-Content -LiteralPath $envFile)) {
        if ($line -match '^\s*DB_CONNECTION\s*=\s*"?([^"#\s]*)"?') { $connection = $Matches[1] }
        if ($line -match '^\s*DB_DATABASE\s*=\s*"?([^"#]*?)"?\s*$') { $database = $Matches[1].Trim() }
    }
    if ($connection -ne 'sqlite') { return $null }
    if (-not $database) { return Join-Path $BackendRoot 'database\database.sqlite' }
    if ([IO.Path]::IsPathRooted($database)) { return $database }
    return Join-Path $BackendRoot $database
}

function Test-Prerequisites {
    $problems = @()
    $checks = @(
        @{ Path = (Join-Path $ProjectRoot 'package.json');               Fix = 'Is $Config.ProjectRoot correct?' },
        @{ Path = (Join-Path $BackendRoot 'artisan');                     Fix = 'The backend folder is missing or incomplete.' },
        @{ Path = (Join-Path $BackendRoot '.env');                        Fix = 'Create backend\.env once by hand (this script never creates or edits it).' },
        @{ Path = (Join-Path $BackendRoot 'vendor\autoload.php');         Fix = 'Run "composer install" once in backend\ (this script never does).' },
        @{ Path = (Join-Path $ProjectRoot 'node_modules\vite\package.json'); Fix = 'Run "npm install" once in the project root (this script never does).' }
    )
    foreach ($c in $checks) {
        if (-not (Test-Path -LiteralPath $c.Path)) { $problems += "Missing $($c.Path). $($c.Fix)" }
    }
    if (Test-Path -LiteralPath (Join-Path $BackendRoot '.env')) {
        $sqlite = Get-SqlitePath
        if ($sqlite -and -not (Test-Path -LiteralPath $sqlite)) {
            $problems += "SQLite database not found at $sqlite. Restore it from a backup; this script will not create an empty one."
        }
    }
    return $problems
}

# --- Starting a server ----------------------------------------------------------

function Start-Server {
    param(
        [string]$Name, [int]$Port, [string]$WorkingDirectory,
        [string]$Exe, [string]$Arguments, [string]$LogFile
    )
    Step-LogRotation $LogFile
    $header = '{0}==== {1} START {2} | cwd: {3} | "{4}" {5}{0}' -f [Environment]::NewLine, $Name, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $WorkingDirectory, $Exe, $Arguments
    [IO.File]::AppendAllText($LogFile, $header, $Utf8NoBom)

    # cmd /s /c keeps the inner quotes; >> appends stdout and stderr to the persistent log.
    $cmdLine = '/d /s /c ""{0}" {1} >> "{2}" 2>&1"' -f $Exe, $Arguments, $LogFile
    $proc = Start-Process -FilePath $env:ComSpec -ArgumentList $cmdLine -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
    Write-Log INFO "$Name starting (wrapper PID $($proc.Id)), log: $LogFile"
    return $proc
}

# =============================================================================
# Main
# =============================================================================

# One start at a time (e.g. Task Scheduler and a manual run at the same moment).
$mutex = New-Object System.Threading.Mutex($false, 'Local\OFPPT-SchoolServer-Start')
if (-not $mutex.WaitOne(0)) {
    Write-Log WARN 'Another start-school-server.ps1 is already running. Nothing to do.'
    exit 0
}

$exitCode = 0
try {
    Write-Log INFO ('---- start-school-server.ps1 {0} (project: {1}) ----' -f $(if ($CheckOnly) { '-CheckOnly' } else { '' }), $ProjectRoot)

    $problems = Test-Prerequisites
    if ($problems) {
        foreach ($p in $problems) { Write-Log ERROR $p }
        throw 'Prerequisites missing; nothing was started.'
    }

    $php = Resolve-Php (Get-MinPhpVersion)
    foreach ($r in $php.Rejected) { Write-Log WARN "Skipped PHP: $r" }
    Write-Log OK "PHP $($php.Version): $($php.Exe)"

    $node = Resolve-Node (Get-MinNodeMajor)
    foreach ($r in $node.Rejected) { Write-Log WARN "Skipped Node: $r" }
    Write-Log OK "Node $($node.Version): $($node.Node)"
    Write-Log OK "npm: $($node.Npm)"

    $servers = @(
        @{ Key = 'backend';  Name = 'Laravel'; Port = [int]$Config.BackendPort;  Cwd = $BackendRoot
           Exe = $php.Exe;   Args = "artisan serve --host=$($Config.BindHost) --port=$($Config.BackendPort)"
           Log = (Join-Path $LogDir 'backend.log') },
        @{ Key = 'frontend'; Name = 'Vite';    Port = [int]$Config.FrontendPort; Cwd = $ProjectRoot
           Exe = $node.Npm;  Args = "run dev -- --host $($Config.BindHost)"
           Log = (Join-Path $LogDir 'frontend.log') }
    )

    # Port report (used by -CheckOnly and before starting).
    foreach ($s in $servers) {
        $listener = Get-ListenerPid $s.Port
        if (-not $listener) {
            $s.State = 'free'
            Write-Log INFO "Port $($s.Port) ($($s.Name)) is free."
        } elseif (Test-IsProjectProcess $listener) {
            $s.State = 'ours'; $s.ListenerPid = $listener
            Write-Log OK "Port $($s.Port): $($s.Name) from this project is already running (PID $listener)."
        } else {
            $s.State = 'foreign'; $s.ListenerPid = $listener
            $info = Get-ProcInfo $listener
            $what = if ($info) { "$($info.Name) PID $listener - $($info.CommandLine)" } else { "PID $listener" }
            Write-Log ERROR "Port $($s.Port) needed by $($s.Name) is used by another program: $what"
        }
    }

    if ($CheckOnly) {
        if ($servers | Where-Object { $_.State -eq 'foreign' }) { $exitCode = 1 }
        Write-Log INFO 'Check only: nothing was started.'
    } else {
        if ($Config.LaunchLaragon) {
            if (-not (Test-Path -LiteralPath $Config.LaragonExe)) {
                Write-Log WARN "LaunchLaragon is on but $($Config.LaragonExe) was not found."
            } elseif (Get-Process -Name 'laragon' -ErrorAction SilentlyContinue) {
                Write-Log INFO 'Laragon is already open.'
            } else {
                Start-Process -FilePath $Config.LaragonExe | Out-Null
                Write-Log INFO 'Laragon launched.'
            }
        }

        # Children inherit this PATH: npm needs node.exe, and artisan serve re-launches the same PHP.
        $env:PATH = '{0};{1};{2}' -f $node.Dir, (Split-Path -Parent $php.Exe), $env:PATH
        $env:NO_UPDATE_NOTIFIER = '1'

        $state = @{}
        if (Test-Path -LiteralPath $StateFile) {
            try { (Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $state[$_.Name] = $_.Value } } catch { }
        }

        foreach ($s in $servers | Where-Object { $_.State -eq 'free' }) {
            $s.Proc = Start-Server -Name $s.Name -Port $s.Port -WorkingDirectory $s.Cwd -Exe $s.Exe -Arguments $s.Args -LogFile $s.Log
            $state[$s.Key] = @{
                wrapperPid   = $s.Proc.Id
                wrapperStart = $s.Proc.StartTime.ToString('o')
                port         = $s.Port
                log          = $s.Log
            }
        }

        # Wait until each started server listens on its own port.
        $deadline = (Get-Date).AddSeconds($Config.StartupTimeoutSeconds)
        $pending = @($servers | Where-Object { $_.State -eq 'free' })
        while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 2
            foreach ($s in $pending) {
                $listener = Get-ListenerPid $s.Port
                if ($listener -and (Test-IsProjectProcess $listener)) {
                    $s.State = 'started'; $s.ListenerPid = $listener
                    Write-Log OK "$($s.Name) is listening on port $($s.Port) (PID $listener)."
                } elseif ($s.Proc.HasExited) {
                    $s.State = 'crashed'
                    Write-Log ERROR "$($s.Name) stopped right after starting (exit code $($s.Proc.ExitCode)). Last lines of $($s.Log):$([Environment]::NewLine)$(Get-Tail $s.Log)"
                }
            }
            $pending = @($pending | Where-Object { $_.State -eq 'free' })
        }
        foreach ($s in $pending) {
            $s.State = 'timeout'
            Write-Log ERROR "$($s.Name) did not listen on port $($s.Port) within $($Config.StartupTimeoutSeconds)s. Last lines of $($s.Log):$([Environment]::NewLine)$(Get-Tail $s.Log)"
        }

        [IO.File]::WriteAllText($StateFile, ($state | ConvertTo-Json -Depth 4), $Utf8NoBom)

        # Final answer: are both reachable over HTTP? Any HTTP status (even 404) means the server responds.
        foreach ($s in $servers | Where-Object { $_.State -in @('ours', 'started') }) {
            try {
                Invoke-WebRequest -Uri "http://127.0.0.1:$($s.Port)/" -UseBasicParsing -TimeoutSec 10 | Out-Null
                Write-Log OK "$($s.Name) answers on http://127.0.0.1:$($s.Port)/"
            } catch {
                # PowerShell 5.1 throws WebException, 7+ HttpResponseException; both carry .Response for HTTP errors.
                if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) { Write-Log OK "$($s.Name) answers on http://127.0.0.1:$($s.Port)/ (HTTP $([int]$_.Exception.Response.StatusCode))" }
                else { Write-Log WARN "$($s.Name) listens on port $($s.Port) but did not answer HTTP yet: $($_.Exception.Message)" }
            }
        }

        if ($servers | Where-Object { $_.State -notin @('ours', 'started') }) {
            $exitCode = 1
            Write-Log ERROR 'At least one server is NOT running. Read the messages above and the server logs.'
        } else {
            Write-Log OK "School server ready: http://$($Config.LanIp):$($Config.FrontendPort)/  (API: http://$($Config.LanIp):$($Config.BackendPort)/)"
        }
    }
}
catch {
    $exitCode = 1
    Write-Log ERROR $_.Exception.Message
}
finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
exit $exitCode
