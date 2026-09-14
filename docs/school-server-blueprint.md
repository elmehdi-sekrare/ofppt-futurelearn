# OFPPT Smart Attendance — School Server Blueprint

This guide installs the application on one school-owned Windows PC. Directors and teachers use a normal browser on the school network; no paid hosting or public Internet access is required.

## 1. The simple idea

```text
Director / teacher browser
          │ school Wi-Fi or Ethernet
          ▼
School server PC (fixed local IP)
  Apache + PHP/Laravel + SQLite database
          │
          └── daily backup ZIP files on a second drive
```

Users open `http://SERVER-IP/app/`, for example `http://192.168.1.50/app/`. The server PC must remain powered on, connected to the school network, and signed in only if Apache was not installed as a Windows service.

Keep the server LAN-only. Do **not** open router ports or expose this system to the public Internet without a qualified IT/security review.

## 2. What the school needs

- One dedicated PC: modern Core i5/Ryzen 5, 8 GB RAM minimum, SSD recommended.
- Windows 10/11 Pro preferred, connected by Ethernet where possible.
- An uninterruptible power supply (UPS) if electricity is unreliable.
- A fixed/reserved LAN IP from the school IT person, for example `192.168.1.50`.
- Around 10 GB free disk space plus a second drive/USB/NAS location for backups.
- An IT person or administrator account for the one-time Apache and Firewall setup.

SQLite is appropriate for this small, single-school installation. If many users later submit records at exactly the same time, move the same Laravel app to MariaDB/MySQL; do not copy SQLite through cloud-sync folders.

## 3. Before installing

1. Create a folder: `C:\OFPPT-Attendance`.
2. Copy this entire project into that folder. The backend must be included even though it is ignored by the frontend Git repository.
3. Ask the network administrator to reserve a static IP for the PC. Record it in the school IT file.
4. Change all demo/default passwords before giving access to staff.
5. Decide who is responsible for the daily backup and who may administer the server.

## 4. Install free software on the server PC

Install these once, then restart the PC:

1. **XAMPP** with Apache and PHP 8.2 or newer. In XAMPP's PHP configuration, enable `pdo_sqlite`, `sqlite3`, `fileinfo`, `openssl`, and `zip`.
2. **Node.js LTS** (needed only when deploying an update).
3. **Composer** for Windows (needed only when deploying an update).

Open the XAMPP Control Panel and confirm Apache can start. If port 80 is already occupied, ask IT to stop the conflicting web server; do not change the app to an unknown port unless you also update the documented URL.

## 5. Configure Laravel securely

1. Open `C:\OFPPT-Attendance\backend`.
2. Copy `.env.school-server.example` to `.env`.
3. Replace both `SERVER-IP` values with the fixed LAN IP, for example `192.168.1.50`.
4. Confirm `DB_DATABASE` matches the real project folder. Use forward slashes as shown.
5. Open PowerShell in `C:\OFPPT-Attendance\backend` and run:

```powershell
php artisan key:generate
php artisan migrate --force
php artisan storage:link
```

Never enable `APP_DEBUG=true` on the school server. Error details can expose paths and settings.

## 6. Configure Apache once

1. Open `C:\xampp\apache\conf\httpd.conf` as Administrator.
2. Ensure this line is enabled (remove `#` if it has one):

```apache
Include conf/extra/httpd-vhosts.conf
```

3. Open `C:\xampp\apache\conf\extra\httpd-vhosts.conf` as Administrator.
4. Copy the contents of `deploy\apache\ofppt-attendance.conf` to the bottom of the file.
5. If you installed the project somewhere other than `C:\OFPPT-Attendance`, update both paths in that Apache block.
6. Restart Apache in the XAMPP Control Panel.

Apache must use `backend\public` as its document root. Never point Apache at the project root; that could expose `.env`, database files, and source code.

## 7. Build and deploy the website

The project includes a safe deployment script. It builds the React interface for `/app/`, copies it inside Laravel's public folder, runs migrations, and rebuilds production caches.

Open PowerShell in the project root and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\deploy-school-server.ps1
```

The command is also the standard process for future updates. It replaces only the generated frontend folder `backend\public\app`; it does not replace the database.

## 8. Allow school devices to connect

Run this once in an Administrator PowerShell window:

```powershell
New-NetFirewallRule -DisplayName "OFPPT Attendance - School LAN" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private,Domain
```

Do not allow this rule on the Public network profile. From another school computer, open:

```text
http://SERVER-IP/app/
```

For example: `http://192.168.1.50/app/`.

If the page does not open, first test the address on the server PC itself. Then check Apache is running, the fixed IP is correct, and the Windows Firewall rule is enabled.

## 9. Make it run after power failure/restart

1. In XAMPP, install Apache as a Windows service and set its startup type to **Automatic** in Windows Services.
2. In Windows Power Options, set the PC to never sleep while plugged in.
3. In the BIOS/UEFI, ask IT to enable “Power on after AC loss” if the PC supports it.
4. Keep the PC in a locked, ventilated place. Do not use a teacher's personal laptop as the permanent server.

## 10. Daily backup — required

The backup script saves the SQLite database and uploaded justification files as a ZIP. Test it once:

```powershell
.\scripts\backup-school-server.ps1
```

It creates ZIP files in `D:\OFPPT-Attendance-Backups` and keeps 30 days. Change that path in the script if the backup disk uses another letter.

Create a daily task:

1. Open **Task Scheduler** → **Create Basic Task**.
2. Name it `OFPPT Attendance Daily Backup`.
3. Trigger: **Daily**, after school hours.
4. Program: `powershell.exe`.
5. Arguments: `-ExecutionPolicy Bypass -File "C:\OFPPT-Attendance\scripts\backup-school-server.ps1"`.
6. Select “Run whether user is logged on or not”.
7. Once per month, copy the newest ZIP to a school-managed external drive or approved secure storage.

To restore after a failure: stop Apache, unzip the chosen backup, replace `backend\database\database.sqlite` and `backend\storage\app\public`, then start Apache. Always test a restore on a copy before doing it during school hours.

## 11. Acceptance test before staff use

Perform this with a teacher and director account from a second PC:

1. Open `http://SERVER-IP/app/` and log in.
2. Teacher marks one student present, one late, one absent, and one excused.
3. Director confirms the new records in **Absences**, **Risk Dashboard**, **Reports**, and **Audit Trail**.
4. Submit one justification as a student; confirm only an admin can approve/reject it and rejection needs a note.
5. Restart the server PC. Confirm Apache starts automatically and the app still opens.
6. Run a backup, verify the ZIP exists, and keep a copy away from the server.

## 12. Monthly checklist

- Check the newest backup ZIP can be opened.
- Review Windows, XAMPP/PHP, Node, and Composer security updates with IT.
- Check disk free space and Laravel logs in `backend\storage\logs`.
- Remove inactive staff accounts and verify administrator accounts.
- Change passwords immediately when staff leave.

## Troubleshooting

| Problem | First check |
|---|---|
| Browser cannot open the app | Apache running, correct fixed IP, Firewall port 80 rule, same school LAN. |
| `/api` calls fail | `backend\.env` has `APP_URL` set to the server IP, then run `php artisan optimize:clear`. |
| Blank page after update | Run `scripts\deploy-school-server.ps1` again and restart Apache. |
| “Database is locked” | Ensure the database is stored on the server's local SSD, not OneDrive/network sync; use the app normally through Apache. |
| Uploads do not open | Run `php artisan storage:link`; verify Apache can read `backend\storage`. |
| Server lost power | Start/restart Apache, run the acceptance test, and inspect the latest backup. |
