import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Printer, FileText, Calendar, Download, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";
import { getDateLocale } from "@/i18n/i18n";

type ReportType = "attendance" | "absences" | "students";

const ReportsPage = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [groupFilter, setGroupFilter] = useState("");

  const { data: groupsRes } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const { data: studentsRes } = useQuery({
    queryKey: ["students"],
    queryFn: () => api.getStudents(),
  });

  const { data: absencesRes, isLoading: loadingAbsences } = useQuery({
    queryKey: ["absences", { group: groupFilter, reportType }],
    queryFn: () => api.getAbsences({ group: groupFilter, attendance_status: reportType === "absences" ? "absent" : undefined }),
  });

  const groups = groupsRes?.data ?? [];
  const students = studentsRes?.data ?? [];
  const absences = absencesRes?.data ?? [];

  const filteredAbsences = absences.filter((a) => {
    if (dateRange.from && a.date < dateRange.from) return false;
    if (dateRange.to && a.date > dateRange.to) return false;
    return true;
  });

  const filteredStudents = students.filter((s) => {
    if (groupFilter && s.group_name !== groupFilter) return false;
    return true;
  });

  const attendanceCounts = filteredAbsences.reduce((counts, record) => {
    counts[record.attendance_status] += 1;
    return counts;
  }, { present: 0, late: 0, absent: 0, excused: 0 });
  const absenceRecords = filteredAbsences.filter((record) => record.attendance_status === "absent");

  const generatePrintableHTML = (): string => {
    const now = new Date().toLocaleString(getDateLocale(i18n.language));
    const filterInfo = [
      groupFilter ? `${t("reports.group")}: ${groupFilter}` : t("reports.allGroupsLabel"),
      dateRange.from ? `${t("reports.from")}: ${dateRange.from}` : "",
      dateRange.to ? `${t("reports.to")}: ${dateRange.to}` : "",
    ].filter(Boolean).join(" | ");

    let tableHTML = "";

    if (reportType === "absences") {
      tableHTML = `
        <table>
          <thead><tr>
            <th>#</th><th>${t("reports.student")}</th><th>${t("reports.group")}</th><th>${t("reports.date")}</th>
            <th>${t("absences.time")}</th><th>${t("reports.attendance")}</th><th>${t("reports.hours")}</th><th>${t("reports.subject")}</th><th>${t("reports.justification")}</th>
          </tr></thead>
          <tbody>${filteredAbsences.map((a, i) => `
            <tr>
              <td>${i + 1}</td><td>${a.student_name}</td><td>${a.group_name}</td>
              <td>${a.date}</td><td>${a.start_time}-${a.end_time}</td>
              <td>${a.attendance_status}${a.attendance_status === "late" ? ` (${a.late_minutes} min)` : ""}</td><td>${a.hours}h</td><td>${a.subject}</td>
              <td><span class="status-${a.status}">${a.status}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div class="summary">
          <p><strong>${t("reports.absenceRecords")}:</strong> ${filteredAbsences.length}</p>
          <p><strong>${t("mark.absent")}:</strong> ${attendanceCounts.absent} · <strong>${t("absences.late")}:</strong> ${attendanceCounts.late} · <strong>${t("absences.excused")}:</strong> ${attendanceCounts.excused}</p>
          <p><strong>${t("reports.totalHours")}:</strong> ${absenceRecords.reduce((s, a) => s + a.hours, 0)}h</p>
        </div>`;
    } else if (reportType === "students") {
      tableHTML = `
        <table>
          <thead><tr>
            <th>#</th><th>${t("reports.student")}</th><th>${t("students.cne")}</th><th>${t("reports.group")}</th>
            <th>${t("reports.email")}</th><th>${t("reports.phone")}</th><th>${t("reports.absenceHours")}</th>
          </tr></thead>
          <tbody>${filteredStudents.map((s, i) => `
            <tr>
              <td>${i + 1}</td><td>${s.first_name} ${s.last_name}</td><td>${s.cne}</td>
              <td>${s.group_name}</td><td>${s.email}</td><td>${s.phone}</td>
              <td>${s.total_absence_hours}h</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div class="summary">
          <p><strong>${t("reports.students")}:</strong> ${filteredStudents.length}</p>
        </div>`;
    } else {
      const totalStudents = filteredStudents.length;
      const totalAbsences = attendanceCounts.absent;
      const totalHours = absenceRecords.reduce((s, a) => s + a.hours, 0);
      const justified = filteredAbsences.filter((a) => a.status === "justified").length;
      const unjustified = filteredAbsences.filter((a) => a.status === "unjustified").length;
      const pending = filteredAbsences.filter((a) => a.status === "pending").length;

      tableHTML = `
        <div class="stats-grid">
          <div class="stat-box"><div class="stat-value">${totalStudents}</div><div class="stat-label">${t("reports.students")}</div></div>
          <div class="stat-box"><div class="stat-value">${totalAbsences}</div><div class="stat-label">${t("reports.absenceRecords")}</div></div>
          <div class="stat-box"><div class="stat-value">${attendanceCounts.late}</div><div class="stat-label">${t("reports.lateArrivals")}</div></div>
          <div class="stat-box"><div class="stat-value">${attendanceCounts.excused}</div><div class="stat-label">${t("reports.excused")}</div></div>
          <div class="stat-box"><div class="stat-value">${totalHours}h</div><div class="stat-label">${t("reports.totalHours")}</div></div>
          <div class="stat-box"><div class="stat-value">${justified}</div><div class="stat-label">${t("reports.justified")}</div></div>
          <div class="stat-box"><div class="stat-value">${unjustified}</div><div class="stat-label">${t("reports.unjustified")}</div></div>
          <div class="stat-box"><div class="stat-value">${pending}</div><div class="stat-label">${t("reports.pending")}</div></div>
        </div>
        <h3 style="margin-top: 24px;">${t("reports.topAbsences")}</h3>
        <table>
          <thead><tr><th>#</th><th>${t("reports.student")}</th><th>${t("reports.group")}</th><th>${t("reports.absenceHours")}</th></tr></thead>
          <tbody>${[...filteredStudents]
            .sort((a, b) => b.total_absence_hours - a.total_absence_hours)
            .slice(0, 20)
            .map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${s.first_name} ${s.last_name}</td>
                <td>${s.group_name}</td>
                <td>${s.total_absence_hours}h</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    }

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("reports.reportTitle")}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #1b5aa8; padding-bottom: 20px; }
  .header h1 { font-size: 22px; color: #1b5aa8; margin-bottom: 4px; }
  .header p { font-size: 12px; color: #666; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; color: #888; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
  th { background: #1b5aa8; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) { background: #f8fafc; }
  .status-justified { color: #159a52; font-weight: 600; }
  .status-unjustified { color: #c62839; font-weight: 600; }
  .status-pending { color: #f59e0b; font-weight: 600; }
  .summary { margin-top: 20px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 13px; }
  .summary p { margin: 4px 0; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
  .stat-box { background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #1b5aa8; }
  .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
  .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="header">
    <h1>OFPPT</h1>
    <p>${reportType === "attendance" ? t("reports.typeAttendance") : reportType === "absences" ? t("reports.typeAbsences") : t("reports.typeStudents")}</p>
  </div>
  <div class="meta">
    <span>${filterInfo}</span>
    <span>${t("reports.generatedAt")}: ${now}</span>
  </div>
  ${tableHTML}
  <div class="footer">
    OFPPT &mdash; ${t("reports.officialReport")} &mdash; ${t("reports.academicYear")}
  </div>
</body></html>`;
  };

  const handlePrint = () => {
    const html = generatePrintableHTML();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    toast({ title: t("reports.generated"), description: t("reports.printOpened") });
  };

  const handleDownloadPDF = () => {
    const html = generatePrintableHTML();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      toast({ title: t("reports.ready"), description: t("reports.savePdfHint") });
    }
  };

  const reportTypes: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "attendance", label: t("reports.typeAttendance"), icon: <FileText className="w-5 h-5" />, desc: t("reports.typeAttendanceDesc") },
    { key: "absences", label: t("reports.typeAbsences"), icon: <Calendar className="w-5 h-5" />, desc: t("reports.typeAbsencesDesc") },
    { key: "students", label: t("reports.typeStudents"), icon: <GraduationCap className="w-5 h-5" />, desc: t("reports.typeStudentsDesc") },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title mt-2.5">{t("reports.title")}</h1>
          <span className="brand-rule" />
        <p className="text-muted-foreground mt-4">{t("reports.subtitle")}</p>
      </motion.div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {reportTypes.map((rt) => (
          <motion.button
            key={rt.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setReportType(rt.key)}
            className={`glass-panel p-4 text-left transition-all ${
              reportType === rt.key ? "border-primary/50 bg-primary/5" : "hover:border-border"
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              reportType === rt.key ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
            }`}>
              {rt.icon}
            </div>
            <p className="font-semibold text-sm">{rt.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{rt.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-panel p-5 space-y-4">
        <h3 className="eyebrow">{t("reports.filters")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">{t("reports.group")}</label>
            <StyledSelect
              value={groupFilter}
              onValueChange={setGroupFilter}
              options={[{ label: t("reports.allGroupsLabel"), value: "" }, ...groups.map((g) => ({ label: g.name, value: g.name }))]}
            />
          </div>
          <div>
            <label htmlFor="report-from" className="text-xs font-medium block mb-1.5">{t("reports.from")}</label>
            <input
              id="report-from"
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="report-to" className="text-xs font-medium block mb-1.5">{t("reports.to")}</label>
            <input
              id="report-to"
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground"
            />
          </div>
        </div>
      </motion.div>

      {/* Preview & Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-sm">{t("reports.preview")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reportType === "absences"
                ? t("reports.recordCount", { count: filteredAbsences.length })
                : reportType === "students"
                ? t("reports.studentCount", { count: filteredStudents.length })
                : t("reports.typeAttendanceDesc")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4" /> {t("reports.downloadPdf")}
            </Button>
            <Button className="gap-2 btn-glow border-0 text-primary-foreground" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> {t("reports.print")}
            </Button>
          </div>
        </div>

        {/* Mini preview */}
        {loadingAbsences ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="rounded-lg border border-border bg-secondary/20 p-4 max-h-[400px] overflow-y-auto">
            {reportType === "absences" && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-medium">#</th>
                    <th className="text-left pb-2 font-medium">{t("reports.student")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.group")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.date")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.attendance")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.hours")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.justification")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsences.slice(0, 15).map((a, i) => (
                    <tr key={a.id} className="border-b border-border/50">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2">{a.student_name}</td>
                      <td className="py-2">{a.group_name}</td>
                      <td className="py-2">{a.date}</td>
                      <td className="py-2">{t(`absences.${a.attendance_status}`, a.attendance_status)}{a.attendance_status === "late" ? ` (${a.late_minutes}m)` : ""}</td>
                      <td className="py-2">{a.hours}h</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.status === "justified" ? "bg-success/10 text-success" :
                          a.status === "unjustified" ? "bg-destructive/10 text-destructive" :
                          "bg-warning/10 text-warning"
                        }`}>{t(`absences.${a.status}`, a.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportType === "students" && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 font-medium">#</th>
                    <th className="text-left pb-2 font-medium">{t("reports.student")}</th>
                    <th className="text-left pb-2 font-medium">{t("students.cne")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.group")}</th>
                    <th className="text-left pb-2 font-medium">{t("reports.absenceHours")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.slice(0, 15).map((s, i) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2">{s.first_name} {s.last_name}</td>
                      <td className="py-2">{s.cne}</td>
                      <td className="py-2">{s.group_name}</td>
                      <td className="py-2">{s.total_absence_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportType === "attendance" && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t("reports.students"), value: filteredStudents.length },
                  { label: t("mark.absent"), value: attendanceCounts.absent },
                  { label: t("absences.late"), value: attendanceCounts.late },
                  { label: t("absences.excused"), value: attendanceCounts.excused },
                  { label: t("reports.absenceHours"), value: `${absenceRecords.reduce((s, a) => s + a.hours, 0)}h` },
                  { label: t("reports.justified"), value: filteredAbsences.filter((a) => a.status === "justified").length },
                  { label: t("reports.unjustified"), value: filteredAbsences.filter((a) => a.status === "unjustified").length },
                  { label: t("reports.pending"), value: filteredAbsences.filter((a) => a.status === "pending").length },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 rounded-lg bg-secondary/30">
                    <p className="text-lg font-bold text-primary">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
            {filteredAbsences.length > 15 && reportType !== "attendance" && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Showing first 15 of {reportType === "absences" ? filteredAbsences.length : filteredStudents.length} records. Full data will be included in the report.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ReportsPage;
