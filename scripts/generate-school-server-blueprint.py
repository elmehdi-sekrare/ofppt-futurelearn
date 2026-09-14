from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "OFPPT-School-Server-Blueprint.pdf"

NAVY = colors.HexColor("#102A43")
BLUE = colors.HexColor("#1976D2")
PALE_BLUE = colors.HexColor("#EAF4FF")
GREEN = colors.HexColor("#2E7D5B")
RED = colors.HexColor("#B42318")
GRAY = colors.HexColor("#52606D")


def page_number(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D9E2EC"))
    canvas.line(1.8 * cm, 1.45 * cm, A4[0] - 1.8 * cm, 1.45 * cm)
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(1.8 * cm, 0.95 * cm, "OFPPT Smart Attendance · School Server Blueprint")
    canvas.drawRightString(A4[0] - 1.8 * cm, 0.95 * cm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4,
        rightMargin=1.7 * cm, leftMargin=1.7 * cm,
        topMargin=1.55 * cm, bottomMargin=2.0 * cm,
        title="OFPPT Smart Attendance — School Server Blueprint",
        author="OFPPT Smart Attendance Project",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle("BlueprintTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=30, textColor=NAVY, spaceAfter=10)
    subtitle = ParagraphStyle("BlueprintSubtitle", parent=styles["BodyText"], fontSize=12, leading=17, textColor=GRAY, spaceAfter=18)
    h1 = ParagraphStyle("BlueprintH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=NAVY, spaceBefore=12, spaceAfter=8)
    h2 = ParagraphStyle("BlueprintH2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=9, spaceAfter=5)
    body = ParagraphStyle("BlueprintBody", parent=styles["BodyText"], fontSize=9.6, leading=14, textColor=colors.HexColor("#243B53"), spaceAfter=6)
    small = ParagraphStyle("BlueprintSmall", parent=body, fontSize=8.8, leading=12)
    code = ParagraphStyle("BlueprintCode", parent=styles["Code"], fontName="Courier", fontSize=8.5, leading=12, textColor=colors.HexColor("#102A43"), backColor=colors.HexColor("#F0F4F8"), borderColor=colors.HexColor("#D9E2EC"), borderWidth=0.5, borderPadding=7, spaceBefore=4, spaceAfter=9)
    callout = ParagraphStyle("BlueprintCallout", parent=body, fontSize=10, leading=14, textColor=NAVY, backColor=PALE_BLUE, borderColor=colors.HexColor("#9CCBFF"), borderWidth=0.7, borderPadding=10, spaceBefore=4, spaceAfter=10)
    warning = ParagraphStyle("BlueprintWarning", parent=body, fontSize=9.7, leading=14, textColor=RED, backColor=colors.HexColor("#FEF3F2"), borderColor=colors.HexColor("#FDA29B"), borderWidth=0.7, borderPadding=9, spaceBefore=4, spaceAfter=10)

    def p(text, style=body):
        return Paragraph(text, style)

    def bullets(items):
        return [p("• " + escape(item), body) for item in items]

    def numbered(items):
        return [p(f"{idx}. {escape(item)}", body) for idx, item in enumerate(items, 1)]

    story = []
    story.append(Spacer(1, 1.1 * cm))
    story.append(p("OFPPT SMART ATTENDANCE", ParagraphStyle("Kicker", parent=small, alignment=TA_CENTER, textColor=BLUE, fontName="Helvetica-Bold", letterSpacing=1.5, spaceAfter=10)))
    story.append(p("School Server Blueprint", ParagraphStyle("CenterTitle", parent=title, alignment=TA_CENTER)))
    story.append(p("A beginner-friendly plan to run the attendance platform on one school-owned PC, available to directors and teachers on the school network — with no paid hosting.", ParagraphStyle("CenterSubtitle", parent=subtitle, alignment=TA_CENTER)))
    story.append(Spacer(1, 0.3 * cm))
    diagram = Table([
        [p("<b>Director / Teacher</b><br/>Browser", small), p("<b>School Network</b><br/>Wi-Fi or Ethernet", small), p("<b>School Server PC</b><br/>Apache · Laravel · SQLite", small), p("<b>Daily Backup</b><br/>Second drive / USB", small)],
    ], colWidths=[4.0 * cm, 4.0 * cm, 4.8 * cm, 4.0 * cm])
    diagram.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#9CCBFF")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CCBFF")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.extend([diagram, Spacer(1, 0.55 * cm)])
    story.append(p("Recommended URL: <b>http://SERVER-IP/app/</b> — for example <b>http://192.168.1.50/app/</b>.", callout))
    story.append(p("Important: this plan is for the internal school network only. Do not open router ports or expose the app to the public Internet without a security review.", warning))
    story.append(Spacer(1, 0.45 * cm))
    story.append(p("Prepared for the OFPPT Smart Attendance school deployment", ParagraphStyle("FooterIntro", parent=small, alignment=TA_CENTER, textColor=GRAY)))
    story.append(PageBreak())

    story.append(p("1. What you are building", h1))
    story.append(p("One dedicated Windows PC becomes the school server. Apache serves the website and Laravel API together. Directors and teachers only need the address in a browser; they do not install the app on their own computers.", body))
    story.append(p("Why this approach works", h2))
    story.extend(bullets([
        "No monthly cloud-hosting bill.",
        "Data stays inside the school network.",
        "The existing React frontend and Laravel backend are deployed together.",
        "A daily backup protects the attendance database and uploaded justification files.",
    ]))
    story.append(p("2. Hardware and responsibility checklist", h1))
    hardware = Table([
        [p("<b>Item</b>", small), p("<b>Minimum recommendation</b>", small), p("<b>Why it matters</b>", small)],
        [p("Server PC", small), p("Core i5/Ryzen 5, 8 GB RAM, SSD", small), p("Reliable enough for a small school and multiple staff browsers.", small)],
        [p("Network", small), p("Ethernet + fixed/reserved LAN IP", small), p("The URL must not change after a restart.", small)],
        [p("Power", small), p("UPS recommended", small), p("Avoids sudden shutdowns and database risk.", small)],
        [p("Backup", small), p("Second drive, USB, NAS, or approved school storage", small), p("A backup on the same PC is not enough.", small)],
        [p("Ownership", small), p("Named staff member + IT contact", small), p("Someone must check backups and passwords.", small)],
    ], colWidths=[3.2 * cm, 6.2 * cm, 8.0 * cm])
    hardware.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(hardware)
    story.append(Spacer(1, 0.3 * cm))
    story.append(p("Use the included SQLite database for this small, single-school setup. If the school later has many simultaneous writes, plan a move to MariaDB/MySQL with IT support. Never store the live SQLite database inside OneDrive or a synced network folder.", callout))

    story.append(p("3. Prepare the server PC", h1))
    story.extend(numbered([
        "Create C:\\OFPPT-Attendance.",
        "Copy the whole project into that folder, including the backend folder.",
        "Ask IT to reserve a fixed network address for this PC, such as 192.168.1.50.",
        "Install free XAMPP (Apache + PHP 8.2 or newer), Node.js LTS, and Composer for Windows.",
        "Restart the PC, open XAMPP Control Panel, and confirm Apache can start.",
        "Change demo/default passwords before staff receive access.",
    ]))
    story.append(p("In XAMPP's PHP configuration, enable pdo_sqlite, sqlite3, fileinfo, openssl, and zip. If Apache cannot start on port 80, ask IT to identify the conflicting web server; do not randomly change ports.", warning))
    story.append(PageBreak())

    story.append(p("4. Configure Laravel for production", h1))
    story.extend(numbered([
        "Open C:\\OFPPT-Attendance\\backend.",
        "Copy .env.school-server.example to a new file named .env.",
        "Replace SERVER-IP with the fixed LAN IP, for example 192.168.1.50.",
        "Confirm DB_DATABASE exactly matches where the project was installed.",
        "Open PowerShell in the backend folder and run the commands below.",
    ]))
    story.append(p("php artisan key:generate<br/>php artisan migrate --force<br/>php artisan storage:link", code))
    story.append(p("Keep APP_DEBUG=false. Debug mode can reveal technical details to browser users.", warning))
    story.append(p("5. Configure Apache", h1))
    story.extend(numbered([
        "Open C:\\xampp\\apache\\conf\\httpd.conf as Administrator.",
        "Enable: Include conf/extra/httpd-vhosts.conf (remove # if it is commented).",
        "Open C:\\xampp\\apache\\conf\\extra\\httpd-vhosts.conf as Administrator.",
        "Copy the supplied deploy\\apache\\ofppt-attendance.conf block to the bottom.",
        "If needed, change C:/OFPPT-Attendance in both paths in that block.",
        "Restart Apache in the XAMPP Control Panel.",
    ]))
    story.append(p("Apache must point to backend\\public only. Pointing Apache at the project root could expose .env, source code, and database files.", warning))

    story.append(p("6. Deploy the website", h1))
    story.append(p("The included deployment script builds the frontend for /app/, copies it inside Laravel's public folder, runs required migrations, and creates production caches. Run it after the first installation and after each future update.", body))
    story.append(p("Set-ExecutionPolicy -Scope Process Bypass<br/>.\\scripts\\deploy-school-server.ps1", code))
    story.append(p("When the script finishes, the staff URL is http://SERVER-IP/app/. The script updates generated frontend files only; it does not erase the database.", callout))

    story.append(p("7. Allow school devices to connect", h1))
    story.append(p("Open an Administrator PowerShell window once and run:", body))
    story.append(p("New-NetFirewallRule -DisplayName \"OFPPT Attendance - School LAN\" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private,Domain", code))
    story.append(p("Do not allow the rule on the Public profile. From a different computer connected to the school network, open http://SERVER-IP/app/. Test the server-PC browser first if another computer cannot connect.", body))
    story.append(PageBreak())

    story.append(p("8. Keep it running 24/7", h1))
    story.extend(numbered([
        "Install Apache as a Windows service through XAMPP and set it to Automatic startup in Windows Services.",
        "Set Windows power options so the PC never sleeps while plugged in.",
        "Ask IT to enable Power on after AC loss in BIOS/UEFI if available.",
        "Place the PC in a locked, ventilated area; do not use a teacher's personal laptop as the permanent server.",
        "Keep a visible label with the server IP, support contact, and backup owner.",
    ]))
    story.append(p("9. Daily backup — required", h1))
    story.append(p("The included backup script creates a ZIP containing the SQLite database and uploaded justification files. It stores backups in D:\\OFPPT-Attendance-Backups and keeps 30 days.", body))
    story.append(p(".\\scripts\\backup-school-server.ps1", code))
    story.append(p("Create a daily Windows Task Scheduler task:", h2))
    story.extend(numbered([
        "Open Task Scheduler → Create Basic Task.",
        "Name: OFPPT Attendance Daily Backup.",
        "Trigger: Daily, after school hours.",
        "Program: powershell.exe.",
        "Arguments: -ExecutionPolicy Bypass -File \"C:\\OFPPT-Attendance\\scripts\\backup-school-server.ps1\".",
        "Select Run whether user is logged on or not.",
        "Every month, copy the newest ZIP to an external drive or approved secure school storage.",
    ]))
    story.append(p("Never assume a backup works. Once before launch and then at least once per term, restore a copy to a test folder and verify you can open the app.", warning))

    story.append(p("10. Director acceptance test", h1))
    acceptance = [
        "From another school PC, open http://SERVER-IP/app/ and log in as a teacher.",
        "Record one Present, one Late, one Absent, and one Excused student.",
        "Log in as a director/admin and verify Absences, Risk Dashboard, Reports, and Audit Trail.",
        "Submit a student justification; verify only an admin can review it and rejecting it requires a note.",
        "Restart the server PC and verify Apache and the app start again.",
        "Run the backup script and verify that a ZIP file is present on the backup drive.",
    ]
    story.extend(numbered(acceptance))

    story.append(p("11. Quick troubleshooting", h1))
    troubleshoot = Table([
        [p("<b>Problem</b>", small), p("<b>First checks</b>", small)],
        [p("App will not open", small), p("Apache is running; fixed IP is correct; browser is on the same school LAN; Windows Firewall port 80 rule is enabled.", small)],
        [p("API calls fail", small), p("Check backend .env APP_URL uses the server IP; run php artisan optimize:clear; restart Apache.", small)],
        [p("Blank page after an update", small), p("Run scripts\\deploy-school-server.ps1 again, then restart Apache.", small)],
        [p("Database is locked", small), p("Keep database on the server's local SSD, not a cloud-sync/network folder. Consider MariaDB for higher concurrent use.", small)],
        [p("Uploads do not open", small), p("Run php artisan storage:link and check Apache can read backend\\storage.", small)],
    ], colWidths=[4.0 * cm, 13.4 * cm])
    troubleshoot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(troubleshoot)
    story.append(Spacer(1, 0.35 * cm))
    story.append(p("Monthly: verify a backup, review disk space and Laravel logs, apply approved Windows/XAMPP/PHP updates, remove inactive accounts, and change passwords when staff leave.", callout))

    doc.build(story, onFirstPage=page_number, onLaterPages=page_number)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
