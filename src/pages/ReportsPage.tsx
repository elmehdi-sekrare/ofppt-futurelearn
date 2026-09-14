import { useState } from "react";
import { motion } from "framer-motion";
import { Printer, FileText, Calendar, Download, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";

type ReportType = "attendance" | "absences" | "students";

const ReportsPage = () => {
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
    const now = new Date().toLocaleString("fr-FR");
    const filterInfo = [
      groupFilter ? `Group: ${groupFilter}` : "All Groups",
      dateRange.from ? `From: ${dateRange.from}` : "",
      dateRange.to ? `To: ${dateRange.to}` : "",
    ].filter(Boolean).join(" | ");

    let tableHTML = "";

    if (reportType === "absences") {
      tableHTML = `
        <table>
          <thead><tr>
            <th>#</th><th>Student</th><th>Group</th><th>Date</th>
            <th>Time</th><th>Attendance</th><th>Hours</th><th>Subject</th><th>Justification</th>
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
          <p><strong>Total attendance records:</strong> ${filteredAbsences.length}</p>
          <p><strong>Absent:</strong> ${attendanceCounts.absent} · <strong>Late:</strong> ${attendanceCounts.late} · <strong>Excused:</strong> ${attendanceCounts.excused}</p>
          <p><strong>Total absence hours:</strong> ${absenceRecords.reduce((s, a) => s + a.hours, 0)}h</p>
        </div>`;
    } else if (reportType === "students") {
      tableHTML = `
        <table>
          <thead><tr>
            <th>#</th><th>Name</th><th>CNE</th><th>Group</th>
            <th>Email</th><th>Phone</th><th>Absence Hours</th>
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
          <p><strong>Total Students:</strong> ${filteredStudents.length}</p>
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
          <div class="stat-box"><div class="stat-value">${totalStudents}</div><div class="stat-label">Students</div></div>
          <div class="stat-box"><div class="stat-value">${totalAbsences}</div><div class="stat-label">Absence Records</div></div>
          <div class="stat-box"><div class="stat-value">${attendanceCounts.late}</div><div class="stat-label">Late Arrivals</div></div>
          <div class="stat-box"><div class="stat-value">${attendanceCounts.excused}</div><div class="stat-label">Excused</div></div>
          <div class="stat-box"><div class="stat-value">${totalHours}h</div><div class="stat-label">Total Hours</div></div>
          <div class="stat-box"><div class="stat-value">${justified}</div><div class="stat-label">Justified</div></div>
          <div class="stat-box"><div class="stat-value">${unjustified}</div><div class="stat-label">Unjustified</div></div>
          <div class="stat-box"><div class="stat-value">${pending}</div><div class="stat-label">Pending</div></div>
        </div>
        <h3 style="margin-top: 24px;">Top Absences by Student</h3>
        <table>
          <thead><tr><th>#</th><th>Student</th><th>Group</th><th>Absence Hours</th></tr></thead>
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
<html><head><meta charset="utf-8"><title>OFPPT Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; }
  .header h1 { font-size: 22px; color: #0ea5e9; margin-bottom: 4px; }
  .header p { font-size: 12px; color: #666; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; color: #888; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
  th { background: #0ea5e9; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) { background: #f8fafc; }
  .status-justified { color: #10b981; font-weight: 600; }
  .status-unjustified { color: #ef4444; font-weight: 600; }
  .status-pending { color: #f59e0b; font-weight: 600; }
  .summary { margin-top: 20px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 13px; }
  .summary p { margin: 4px 0; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
  .stat-box { background: #f0f9ff; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #0ea5e9; }
  .stat-label { font-size: 12px; color: #666; margin-top: 4px; }
  .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="header">
    <h1>OFPPT Smart Attendance</h1>
    <p>${reportType === "attendance" ? "Attendance Summary Report" : reportType === "absences" ? "Absence Detail Report" : "Student Roster Report"}</p>
  </div>
  <div class="meta">
    <span>${filterInfo}</span>
    <span>Generated: ${now}</span>
  </div>
  ${tableHTML}
  <div class="footer">
    OFPPT Smart Attendance &mdash; Official Report &mdash; Academic Year 2025-2026
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
    toast({ title: "Report Generated", description: "Print dialog opened in a new tab" });
  };

  const handleDownloadPDF = () => {
    const html = generatePrintableHTML();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      toast({ title: "Report Ready", description: "Use your browser's Save as PDF option (Ctrl+P)" });
    }
  };

  const reportTypes: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "attendance", label: "Attendance Summary", icon: <FileText className="w-5 h-5" />, desc: "Overview with stats and top absences" },
    { key: "absences", label: "Absence Details", icon: <Calendar className="w-5 h-5" />, desc: "Full list of absence records" },
    { key: "students", label: "Student Roster", icon: <GraduationCap className="w-5 h-5" />, desc: "Complete student directory" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and print professional reports</p>
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
              reportType === rt.key ? "border-primary/50 bg-primary/5" : "hover:border-white/[0.12]"
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
        <h3 className="font-display font-semibold text-sm">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Group</label>
            <StyledSelect
              value={groupFilter}
              onValueChange={setGroupFilter}
              options={[{ label: "All Groups", value: "" }, ...groups.map((g) => ({ label: g.name, value: g.name }))]}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-white/[0.08] text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
              className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-white/[0.08] text-sm text-foreground"
            />
          </div>
        </div>
      </motion.div>

      {/* Preview & Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-sm">Report Preview</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reportType === "absences"
                ? `${filteredAbsences.length} attendance records`
                : reportType === "students"
                ? `${filteredStudents.length} students`
                : `Summary overview`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-white/[0.08]" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4" /> Save as PDF
            </Button>
            <Button className="gap-2 btn-glow border-0 text-primary-foreground" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print Report
            </Button>
          </div>
        </div>

        {/* Mini preview */}
        {loadingAbsences ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="rounded-lg border border-white/[0.06] bg-secondary/20 p-4 max-h-[400px] overflow-y-auto">
            {reportType === "absences" && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/[0.06]">
                    <th className="text-left pb-2 font-medium">#</th>
                    <th className="text-left pb-2 font-medium">Student</th>
                    <th className="text-left pb-2 font-medium">Group</th>
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">Attendance</th>
                    <th className="text-left pb-2 font-medium">Hours</th>
                    <th className="text-left pb-2 font-medium">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsences.slice(0, 15).map((a, i) => (
                    <tr key={a.id} className="border-b border-white/[0.03]">
                      <td className="py-2">{i + 1}</td>
                      <td className="py-2">{a.student_name}</td>
                      <td className="py-2">{a.group_name}</td>
                      <td className="py-2">{a.date}</td>
                      <td className="py-2 capitalize">{a.attendance_status}{a.attendance_status === "late" ? ` (${a.late_minutes}m)` : ""}</td>
                      <td className="py-2">{a.hours}h</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.status === "justified" ? "bg-emerald-500/10 text-emerald-400" :
                          a.status === "unjustified" ? "bg-red-500/10 text-red-400" :
                          "bg-yellow-500/10 text-yellow-400"
                        }`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportType === "students" && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/[0.06]">
                    <th className="text-left pb-2 font-medium">#</th>
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-left pb-2 font-medium">CNE</th>
                    <th className="text-left pb-2 font-medium">Group</th>
                    <th className="text-left pb-2 font-medium">Abs. Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.slice(0, 15).map((s, i) => (
                    <tr key={s.id} className="border-b border-white/[0.03]">
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
                  { label: "Students", value: filteredStudents.length },
                  { label: "Absent", value: attendanceCounts.absent },
                  { label: "Late", value: attendanceCounts.late },
                  { label: "Excused", value: attendanceCounts.excused },
                  { label: "Absence Hours", value: `${absenceRecords.reduce((s, a) => s + a.hours, 0)}h` },
                  { label: "Justified", value: filteredAbsences.filter((a) => a.status === "justified").length },
                  { label: "Unjustified", value: filteredAbsences.filter((a) => a.status === "unjustified").length },
                  { label: "Pending", value: filteredAbsences.filter((a) => a.status === "pending").length },
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
