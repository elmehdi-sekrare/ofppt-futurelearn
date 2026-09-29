# Auto-start the school server (development mode)

This guide makes the OFPPT attendance app start by itself when the server PC's
user signs in to Windows. It keeps the current development setup:

| Part | Command the script runs | Folder | Port |
| --- | --- | --- | --- |
| Laravel API | `php artisan serve --host=0.0.0.0 --port=8000` | `backend\` | 8000 |
| React (Vite) | `npm run dev -- --host 0.0.0.0` | project root | 8080 (from `vite.config.ts`) |

School PCs open **http://192.168.1.38:8080/**. Vite forwards `/api` calls to
Laravel on port 8000 (see the `proxy` block in `vite.config.ts`).

Paths below assume the project is at `C:\laragon2\www\ofppt-futurelearn-main`.

## What the scripts do

`scripts\start-school-server.ps1`

- Reads the minimum PHP version from `backend\composer.json` (`^8.2`) and the
  minimum Node version from Vite's own `package.json` (18+).
- Finds PHP and Node: first in `C:\laragon2\bin\php\*` and `C:\laragon2\bin\nodejs\*`,
  then on the Windows PATH. It keeps the newest version that meets the
  requirement (PHP must also have `pdo_sqlite` enabled) and prints the exact path.
- Checks, without changing anything, that `backend\.env`, `backend\vendor`,
  `node_modules` and the SQLite database exist.
- Checks ports 8000 and 8080:
  - free: starts the server;
  - already used by this project's server: leaves it running (no duplicate);
  - used by another program: reports it by name and does not touch it.
- Starts each server hidden in the background, with its output **appended** to:
  - `logs\school-server\backend.log`
  - `logs\school-server\frontend.log`
- Waits up to 90 seconds for each server to listen, then checks it answers HTTP.
- Writes its own report to `logs\school-server\school-server.log`.
- Exit code 0 means both servers are running; 1 means something needs attention.

It **never** runs migrations, seeders, `composer install` or `npm install`,
and never edits `.env`, the database, or the Vite/Laravel configuration.

`scripts\stop-school-server.ps1` stops only the processes it can prove belong to
this project folder. It leaves any other program on those ports running and
says so. It deletes nothing except its own small state file.

The `logs\` folder is already ignored by Git.

## Settings (only if needed)

Open `scripts\start-school-server.ps1` in Notepad. Everything configurable is in
the block marked **CONFIGURATION** at the top:

| Setting | Default | When to change it |
| --- | --- | --- |
| `LaragonRoot` | `C:\laragon2` | Laragon is installed elsewhere. |
| `PhpExe` | empty (auto) | Auto-detect picked the wrong PHP. Paste the full path to `php.exe`. |
| `NodeDir` | empty (auto) | Auto-detect picked the wrong Node. Paste the folder containing `node.exe` and `npm.cmd`. |
| `LanIp` | `192.168.1.38` | The server's IP changes. Used only in messages. |
| `LaunchLaragon` | `$false` | Set to `$true` to also open Laragon at sign-in. |

If you change the ports, change them in `stop-school-server.ps1` too.

---

## Step 1 — Get the scripts on the server

On the server, open **Laragon → Terminal**, then:

```
cd C:\laragon2\www\ofppt-futurelearn-main
git pull origin main
```

Check that `scripts\start-school-server.ps1` and `scripts\stop-school-server.ps1` exist.

## Step 2 — Close what is running now

Close the two terminal windows where `php artisan serve` and `npm run dev` are
running (click in each and press **Ctrl + C**, then close the window). The
test in step 4 must start from free ports.

## Step 3 — Dry run (starts nothing)

Open **PowerShell** (Start menu → type `PowerShell` → Enter). You do not need
administrator rights. Run:

```
cd C:\laragon2\www\ofppt-futurelearn-main
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-school-server.ps1 -CheckOnly
```

Read the green lines:

- `PHP 8.x.x: C:\laragon2\bin\php\...\php.exe` — is it the PHP you normally use?
- `Node xx: ...\node.exe` and `npm: ...\npm.cmd`
- `Port 8000 (Laravel) is free.` and `Port 8080 (Vite) is free.`

If a line is red, fix what it says and run the dry run again. For example:

- **Missing vendor\autoload.php**: run `composer install` once, by hand, in `backend\`.
- **pdo_sqlite not enabled**: Laragon → right-click → PHP → Extensions → tick `pdo_sqlite`.
- **Port used by another program**: close that program, or find it in Task Manager by the PID shown.

If the PHP or Node shown is not the one you want, copy the correct path into
`PhpExe` / `NodeDir` in the CONFIGURATION block and run the dry run again.

## Step 4 — Test the scripts by hand

Still in the same PowerShell window:

1. **Start**

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-school-server.ps1
   ```

   Expected: `Laravel is listening on port 8000`, `Vite is listening on port 8080`,
   then `School server ready: http://192.168.1.38:8080/`, and the window returns.
   The servers keep running in the background; no terminal windows stay open.

2. **Open the app**: on the server, go to http://localhost:8080/ and log in.
   Then do the same from **another school PC** at http://192.168.1.38:8080/.
   If the other PC cannot connect, do step 5 (firewall) and try again.

3. **Run start again**: it must say `already running` for both, and must not start copies.

4. **Look at the logs** in `logs\school-server\`: `backend.log` lists requests,
   and `frontend.log` shows Vite's "ready" message.

5. **Stop**

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-school-server.ps1
   ```

   Expected: `Stopped ... wrapper`, then `Port 8000 is free.` and `Port 8080 is free.`
   The site no longer opens.

6. **Start once more**, to leave it running.

Only continue once all six checks behave as described.

## Step 5 — Allow other PCs through the firewall (once)

Start → type `PowerShell` → right-click → **Run as administrator**, then:

```
New-NetFirewallRule -DisplayName "OFPPT dev server (Vite 8080)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "OFPPT dev server (Laravel 8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private,Domain
```

Browsers only need 8080, because Vite forwards the API. Port 8000 is open so
the API can also be reached directly, as the setup requires.

If the school network shows as **Public** in Windows (Settings → Network &
internet → your connection), switch it to **Private**; the rules above do not
apply to Public networks on purpose.

## Step 6 — Run it automatically at sign-in (Task Scheduler)

### Option A: with the Task Scheduler window

1. Start → type **Task Scheduler** → open it.
2. On the right, click **Create Task…** (not "Create Basic Task").
3. **General** tab:
   - Name: `OFPPT School Server`
   - **Run only when user is logged on**
   - Leave "Run with highest privileges" **unchecked** (not needed).
4. **Triggers** tab → **New…**
   - Begin the task: **At log on**
   - **Specific user**: the account that uses the server (the default).
   - Tick **Delay task for:** and type `30 seconds`. This gives Windows and the network time to be ready.
   - OK.
5. **Actions** tab → **New…**
   - Action: **Start a program**
   - Program/script: `powershell.exe`
   - Add arguments:
     ```
     -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\laragon2\www\ofppt-futurelearn-main\scripts\start-school-server.ps1"
     ```
   - Start in: `C:\laragon2\www\ofppt-futurelearn-main`
   - OK.
6. **Conditions** tab: untick **Start the task only if the computer is on AC power**.
7. **Settings** tab:
   - Tick **Allow task to be run on demand**.
   - **Stop the task if it runs longer than: 30 minutes**. This only limits the
     launcher script, which finishes in about a minute. The servers keep running after it ends.
   - "If the task is already running": **Do not start a new instance**.
8. OK.

### Option B: one command (same result)

In a normal (not administrator) PowerShell window, signed in as the server's user:

```
$root = 'C:\laragon2\www\ofppt-futurelearn-main'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $root `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\start-school-server.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$trigger.Delay = 'PT30S'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'OFPPT School Server' -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Description 'Starts Laravel (8000) and Vite (8080) for the school LAN.'
```

### Test the task before relying on it

1. Stop the servers: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-school-server.ps1`
2. In Task Scheduler, find **OFPPT School Server**, right-click → **Run**.
3. Wait about a minute and press **F5**. **Last Run Result** should be
   `The operation completed successfully. (0x0)` and Status back to **Ready**.
   `(0x1)` means the script reported a problem; read `logs\school-server\school-server.log`.
4. **Important:** with the task back to *Ready*, check that
   http://192.168.1.38:8080/ still opens from another PC. This confirms the
   servers keep running after the launcher finishes.
5. Sign out of Windows and sign back in, without starting anything by hand.
   Wait about a minute and open the site again.

### Optional: Laragon

These servers do not need Laragon to be open. To open it anyway at sign-in,
either set `LaunchLaragon = $true` in the CONFIGURATION block, or use
Laragon → Preferences → **Run Laragon when Windows starts**. Leave Laragon's
**Start All** off unless you need its Apache or MySQL, since this app does not use them.

### Starting without anyone typing a password

The task runs **at sign-in**. For the site to come up by just pressing the power
button, Windows must sign in by itself:

1. Settings → Accounts → Sign-in options → turn off *"For improved security, only allow Windows Hello sign-in…"*.
2. Press Windows + R → `netplwiz` → select the server's account → untick
   *"Users must enter a user name and password…"* → Apply → enter the password.

Use a Windows account dedicated to this server.

## Disable or remove the automatic start

- **Pause it** (keeps the task): Task Scheduler → right-click **OFPPT School Server** → **Disable**.
  To resume, use **Enable**. Or in PowerShell: `Disable-ScheduledTask -TaskName 'OFPPT School Server'`
  / `Enable-ScheduledTask -TaskName 'OFPPT School Server'`
- **Remove it completely**: Task Scheduler → right-click → **Delete**. Or:
  `Unregister-ScheduledTask -TaskName 'OFPPT School Server' -Confirm:$false`
- Disabling or deleting the task does **not** stop servers that are already running.
  Stop them with `scripts\stop-school-server.ps1`.
- Optional: remove the firewall rules:
  `Remove-NetFirewallRule -DisplayName "OFPPT dev server (Vite 8080)"` and
  `Remove-NetFirewallRule -DisplayName "OFPPT dev server (Laravel 8000)"` (as administrator).

## Troubleshooting

| Symptom | Where to look / what to do |
| --- | --- |
| Site does not open after sign-in | Read `logs\school-server\school-server.log`, bottom lines. |
| "Port 8000 … used by another program" | Another app, or a manually started `php artisan serve` from a *different* folder. Close it, then run start again. |
| Laravel "stopped right after starting" | Read `logs\school-server\backend.log`. Usually `.env` or a PHP extension. |
| Vite "did not listen … within 90s" | Read `logs\school-server\frontend.log`. A slow disk can need more time: raise `StartupTimeoutSeconds`. |
| Works on the server, not from other PCs | Firewall (step 5), network set to Public, or the IP changed (`ipconfig`). |
| Last Run Result 0x1 | The script found a problem; the log says which. |
| After an update (`git pull`) | If `package.json` or `composer.json` changed, run `npm install` / `composer install` once by hand, then stop and start. |

Log files grow over time. When a server log passes 10 MB, it is renamed to
`.log.1` at the next start. Nothing is deleted automatically.
