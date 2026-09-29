import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Printer, FileText, CalendarRange, Download, GraduationCap, Check, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";
import { getDateLocale } from "@/i18n/i18n";
import { exportAbsencesCSV, exportStudentsCSV } from "@/utils/exportUtils";
import type { Absence, Student } from "@/types/api";

type ReportType = "attendance" | "absences" | "students";
type Preset = "30d" | "month" | "lastMonth" | "year" | "all" | "custom";

const EASE = [0.22, 1, 0.36, 1] as const;
const PREVIEW_ROWS = 12;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** OFPPT school years start in September. */
const schoolYearStart = (now = new Date()) => new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 1);

const presetRange = (p: Preset): { from: string; to: string } => {
  const now = new Date();
  switch (p) {
    case "30d": return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: iso(now) };
    case "month": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    case "lastMonth": return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "year": return { from: iso(schoolYearStart(now)), to: iso(now) };
    default: return { from: "", to: "" };
  }
};

/** Values from the database go into a document.write() page; never trust them as HTML. */
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const ReportsPage = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [preset, setPreset] = useState<Preset>("year");
  const [dateRange, setDateRange] = useState(presetRange("year"));
  const [groupFilter, setGroupFilter] = useState("");

  const { data: groupsRes } = useQuery({ queryKey: ["groups"], queryFn: () => api.getGroups() });
  const { data: studentsRes, isLoading: loadingStudents } = useQuery({ queryKey: ["students"], queryFn: () => api.getStudents() });

  // The API returns only "absent" rows when no attendance filter is sent, which
  // left late and excused counts at zero. Ask for what each report needs.
  const attendanceParam = reportType === "absences" ? "absent,late,excused" : "absent,late,present,excused";
  const { data: absencesRes, isLoading: loadingAbsences } = useQuery({
    queryKey: ["absences", "report", { group: groupFilter, attendance_status: attendanceParam }],
    queryFn: () => api.getAbsences({ group: groupFilter, attendance_status: attendanceParam }),
    enabled: reportType !== "students",
    placeholderData: (prev) => prev,
  });

  const groups = groupsRes?.data ?? [];
  const students: Student[] = useMemo(() => studentsRes?.data ?? [], [studentsRes]);
  const absences: Absence[] = useMemo(() => absencesRes?.data ?? [], [absencesRes]);

  const records = useMemo(() => absences.filter((a) =>
    (!dateRange.from || a.date >= dateRange.from) && (!dateRange.to || a.date <= dateRange.to)
  ), [absences, dateRange]);
  const roster = useMemo(() => students.filter((s) => !groupFilter || s.group_name === groupFilter), [students, groupFilter]);

  const summary = useMemo(() => {
    const absent = records.filter((r) => r.attendance_status === "absent");
    return {
      sessions: records.length,
      absent: absent.length,
      late: records.filter((r) => r.attendance_status === "late").length,
      excused: records.filter((r) => r.attendance_status === "excused").length,
      hours: Math.round(absent.reduce((s, a) => s + a.hours, 0) * 10) / 10,
      justified: absent.filter((a) => a.status === "justified").length,
      unjustified: absent.filter((a) => a.status === "unjustified").length,
      pending: absent.filter((a) => a.status === "pending").length,
    };
  }, [records]);

  const topAbsent = useMemo(() => [...roster].sort((a, b) => b.total_absence_hours - a.total_absence_hours).filter((s) => s.total_absence_hours > 0).slice(0, 20), [roster]);

  const syStart = schoolYearStart();
  const schoolYear = `${syStart.getFullYear()}–${syStart.getFullYear() + 1}`;
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const periodLabel = dateRange.from || dateRange.to
    ? `${dateRange.from ? fmt(dateRange.from) : "…"} — ${dateRange.to ? fmt(dateRange.to) : "…"}`
    : t("reports.allTime");
  const typeTitle = t(`reports.type${reportType.charAt(0).toUpperCase()}${reportType.slice(1)}`);
  const statusLabel = (s: string) => t(`absences.${s}`, s);
  const attendanceLabel = (a: Absence) => `${t(`absences.${a.attendance_status}`, a.attendance_status)}${a.attendance_status === "late" ? ` (${a.late_minutes} min)` : ""}`;

  const figures = [
    { label: t("reports.absenceRecords"), value: summary.absent },
    { label: t("reports.totalHours"), value: `${summary.hours} h` },
    { label: t("reports.lateArrivals"), value: summary.late },
    { label: t("reports.justified"), value: summary.justified },
    { label: t("reports.unjustified"), value: summary.unjustified },
    { label: t("reports.pending"), value: summary.pending },
  ];

  const rowCount = reportType === "absences" ? records.length : reportType === "students" ? roster.length : topAbsent.length;
  const loading = reportType === "students" ? loadingStudents : loadingAbsences || loadingStudents;

  const applyPreset = (p: Preset) => { setPreset(p); if (p !== "custom") setDateRange(presetRange(p)); };

  const generatePrintableHTML = (): string => {
    const now = new Date().toLocaleString(locale);
    const logo = `${window.location.origin}${import.meta.env.BASE_URL}ofppt-logo.svg`;
    let body = "";

    if (reportType === "absences") {
      body = `
        <table>
          <thead><tr><th>#</th><th>${t("reports.student")}</th><th>${t("reports.group")}</th><th>${t("reports.date")}</th><th>${t("absences.time")}</th><th>${t("reports.attendance")}</th><th class="num">${t("reports.hours")}</th><th>${t("reports.subject")}</th><th>${t("reports.justification")}</th></tr></thead>
          <tbody>${records.map((a, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(a.student_name)}</td><td>${esc(a.group_name)}</td><td>${esc(a.date)}</td><td>${esc(a.start_time)}–${esc(a.end_time)}</td><td>${esc(attendanceLabel(a))}</td><td class="num">${esc(a.hours)}</td><td>${esc(a.subject)}</td><td class="s-${esc(a.status)}">${esc(statusLabel(a.status))}</td></tr>`).join("")}</tbody>
        </table>`;
    } else if (reportType === "students") {
      body = `
        <table>
          <thead><tr><th>#</th><th>${t("reports.student")}</th><th>${t("students.cne")}</th><th>${t("reports.group")}</th><th>${t("reports.email")}</th><th>${t("reports.phone")}</th><th class="num">${t("reports.absenceHours")}</th></tr></thead>
          <tbody>${roster.map((s, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(s.first_name)} ${esc(s.last_name)}</td><td class="mono">${esc(s.cne)}</td><td>${esc(s.group_name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone)}</td><td class="num">${esc(s.total_absence_hours)}</td></tr>`).join("")}</tbody>
        </table>`;
    } else {
      body = `
        <div class="figures">${figures.map((f) => `<div><span class="fv">${esc(f.value)}</span><span class="fl">${esc(f.label)}</span></div>`).join("")}</div>
        <h2>${t("reports.topAbsences")}</h2>
        <table>
          <thead><tr><th>#</th><th>${t("reports.student")}</th><th>${t("reports.group")}</th><th class="num">${t("reports.absenceHours")}</th></tr></thead>
          <tbody>${topAbsent.map((s, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(s.first_name)} ${esc(s.last_name)}</td><td>${esc(s.group_name)}</td><td class="num">${esc(s.total_absence_hours)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">${t("reports.noData")}</td></tr>`}</tbody>
        </table>`;
    }

    return `<!DOCTYPE html>
<html lang="${i18n.language}"><head><meta charset="utf-8"><title>${esc(typeTitle)} — OFPPT</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', 'Segoe UI', sans-serif; color: #17243a; font-size: 12px; line-height: 1.5; padding: 32px; }
  .head { display: flex; align-items: center; gap: 16px; padding-bottom: 18px; border-bottom: 2px solid #17243a; }
  .head img { width: 52px; height: 52px; }
  .inst { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #5a6a82; }
  .inst strong { display: block; font-size: 13px; letter-spacing: .02em; text-transform: none; color: #17243a; }
  h1 { font-family: 'Source Serif 4', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: -.01em; margin-top: 22px; }
  h2 { font-family: 'Source Serif 4', Georgia, serif; font-size: 16px; font-weight: 600; margin: 26px 0 8px; }
  .meta { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 12px; margin: 14px 0 22px; padding: 12px 0; border-top: 1px solid #d6dde8; border-bottom: 1px solid #d6dde8; }
  .meta span { display: block; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #5a6a82; }
  .meta b { font-weight: 600; }
  .figures { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #d6dde8; }
  .figures div { padding: 12px 14px; border-right: 1px solid #d6dde8; border-bottom: 1px solid #d6dde8; }
  .figures div:nth-child(3n) { border-right: 0; }
  .figures div:nth-last-child(-n+3) { border-bottom: 0; }
  .fv { display: block; font-family: 'Source Serif 4', Georgia, serif; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .fl { font-size: 10.5px; color: #5a6a82; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: #5a6a82; font-weight: 600; padding: 8px 8px; border-bottom: 1.5px solid #17243a; }
  td { padding: 7px 8px; border-bottom: 1px solid #e3e8ef; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #8a97aa; }
  .mono { font-family: ui-monospace, monospace; font-size: 10.5px; }
  .s-justified { color: #127a43; font-weight: 600; } .s-unjustified { color: #b3261e; font-weight: 600; } .s-pending { color: #a55a00; font-weight: 600; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; font-size: 11px; color: #5a6a82; }
  .sign div { width: 40%; border-top: 1px solid #b8c2d1; padding-top: 6px; }
  .foot { margin-top: 36px; font-size: 9.5px; color: #8a97aa; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } tr { page-break-inside: avoid; } }
</style></head><body>
  <div class="head"><img src="${logo}" alt="OFPPT"><div class="inst">${t("reports.institution")}<strong>${t("app.shortName")}</strong></div></div>
  <h1>${esc(typeTitle)}</h1>
  <div class="meta">
    <div><span>${t("reports.period")}</span><b>${esc(periodLabel)}</b></div>
    <div><span>${t("reports.group")}</span><b>${esc(groupFilter || t("reports.allGroupsLabel"))}</b></div>
    <div><span>${t("reports.generatedAt")}</span><b>${esc(now)}</b></div>
  </div>
  ${body}
  <div class="sign"><div>${t("reports.signPrepared")}</div><div>${t("reports.signDirector")}</div></div>
  <div class="foot"><span>OFPPT — ${t("reports.officialReport")}</span><span>${t("reports.schoolYear", { year: schoolYear })}</span></div>
</body></html>`;
  };

  const openDocument = (print: boolean) => {
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: t("reports.popupBlocked"), description: t("reports.popupBlockedHint"), variant: "destructive" });
      return;
    }
    win.document.write(generatePrintableHTML());
    win.document.close();
    if (print) {
      // Wait for the web fonts so the printed page matches the preview; the
      // timeout covers browsers that never fire load on a written document.
      let printed = false;
      const print = () => { if (!printed) { printed = true; win.print(); } };
      win.onload = () => win.setTimeout(print, 250);
      window.setTimeout(print, 1500);
      toast({ title: t("reports.generated"), description: t("reports.printOpened") });
    } else {
      toast({ title: t("reports.ready"), description: t("reports.savePdfHint") });
    }
  };

  const exportCsv = () => {
    if (reportType === "students") exportStudentsCSV(roster, "rapport_stagiaires");
    else exportAbsencesCSV(records, reportType === "absences" ? "rapport_absences" : "rapport_presences");
    toast({ title: t("absences.exportDone"), description: t("absences.exportDesc", { count: reportType === "students" ? roster.length : records.length }) });
  };

  const reportTypes: { key: ReportType; label: string; icon: typeof FileText; desc: string }[] = [
    { key: "attendance", label: t("reports.typeAttendance"), icon: FileText, desc: t("reports.typeAttendanceDesc") },
    { key: "absences", label: t("reports.typeAbsences"), icon: CalendarRange, desc: t("reports.typeAbsencesDesc") },
    { key: "students", label: t("reports.typeStudents"), icon: GraduationCap, desc: t("reports.typeStudentsDesc") },
  ];
  const presets: Preset[] = ["30d", "month", "lastMonth", "year", "all"];

  return (
    <div className="space-y-7 max-w-[1400px]">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <p className="eyebrow">{t("nav.reports")}</p>
        <h1 className="page-title mt-2.5">{t("reports.title")}</h1>
        <span className="brand-rule" />
        <p className="text-muted-foreground mt-4 max-w-[60ch]">{t("reports.subtitle")}</p>
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,23rem)_1fr] items-start">
        {/* Configuration */}
        <motion.aside
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: EASE }}
          className="lg:sticky lg:top-0"
        >
          <p className="h-5 mb-3 px-1 flex items-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("reports.settings")}</p>
          <div className="glass-panel overflow-hidden">
          <div role="group" aria-labelledby="step-type" className="p-5">
            <h2 id="step-type" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">{t("reports.step1")}</h2>
            <div className="space-y-2" role="radiogroup">
              {reportTypes.map((rt) => {
                const active = reportType === rt.key;
                const Icon = rt.icon;
                return (
                  <button
                    key={rt.key}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setReportType(rt.key)}
                    className={`w-full text-left rounded-xl border p-3.5 flex gap-3 transition-[border-color,background-color,box-shadow] duration-200 ${
                      active ? "border-primary/50 bg-primary/[0.05] shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]" : "border-border hover:border-foreground/20 hover:bg-secondary/40"
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[14px]">{rt.label}</span>
                        {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </span>
                      <span className="block text-[12.5px] text-muted-foreground mt-0.5 leading-snug">{rt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div role="group" aria-labelledby="step-period" className={`p-5 border-t border-border/70 transition-opacity ${reportType === "students" ? "opacity-45 pointer-events-none" : ""}`} aria-disabled={reportType === "students"}>
            <h2 id="step-period" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">{t("reports.step2")}</h2>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  aria-pressed={preset === p}
                  className={`px-2.5 py-1 rounded-md text-[12.5px] font-medium border transition-colors ${
                    preset === p ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25"
                  }`}
                >
                  {t(`reports.preset.${p}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              {(["from", "to"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="text-[12px] text-muted-foreground">{t(`reports.${k}`)}</span>
                  <input
                    type="date"
                    value={dateRange[k]}
                    onChange={(e) => { setPreset("custom"); setDateRange((d) => ({ ...d, [k]: e.target.value })); }}
                    className="input-glass mt-1 w-full h-10 px-3 rounded-lg border text-sm"
                  />
                </label>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="step-group" className="p-5 border-t border-border/70">
            <h2 id="step-group" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">{t("reports.step3")}</h2>
            <StyledSelect
              value={groupFilter}
              onValueChange={setGroupFilter}
              options={[{ label: t("reports.allGroupsLabel"), value: "" }, ...groups.map((g) => ({ label: g.name, value: g.name }))]}
            />
          </div>

          <div className="px-5 py-4 border-t border-border bg-secondary/30 space-y-2">
            <Button className="w-full gap-2 btn-glow border-0 text-primary-foreground h-11" onClick={() => openDocument(true)} disabled={loading}>
              <Printer className="w-4 h-4" /> {t("reports.print")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={() => openDocument(false)} disabled={loading}>
                <Download className="w-4 h-4" /> PDF
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={loading || rowCount === 0}>
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </Button>
            </div>
          </div>
          </div>
        </motion.aside>

        {/* Live preview, laid out like the printed sheet */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: EASE }}
          aria-label={t("reports.preview")}
          className="min-w-0"
        >
          <div className="h-5 flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("reports.preview")}</p>
            <p className="text-[12.5px] text-muted-foreground tabular-nums">
              {reportType === "students" ? t("reports.studentCount", { count: roster.length })
                : reportType === "absences" ? t("reports.recordCount", { count: records.length })
                : t("reports.sessionsCount", { count: records.length, absent: summary.absent })}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-[hsl(var(--secondary)/0.55)] p-3 sm:p-5">
            <article className="mx-auto max-w-[860px] bg-white text-[#17243a] rounded-md shadow-[0_1px_2px_hsl(215_40%_20%/0.08),0_20px_48px_-20px_hsl(215_40%_20%/0.35)] px-6 sm:px-12 py-10 min-h-[640px]">
              <header className="flex items-center gap-4 pb-5 border-b-2 border-[#17243a]">
                <img src={`${import.meta.env.BASE_URL}ofppt-logo.svg`} alt="OFPPT" className="w-12 h-12 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] leading-snug text-[#5a6a82]">{t("reports.institution")}</p>
                  <p className="text-[13px] font-semibold">{t("app.shortName")}</p>
                </div>
              </header>

              <AnimatePresence mode="wait">
                <motion.div key={reportType} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}>
                  <h2 className="font-serif font-bold text-[1.75rem] tracking-[-0.01em] mt-6">{typeTitle}</h2>

                  <dl className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-x-6 gap-y-3 mt-4 py-3 border-y border-[#d6dde8] text-[12.5px]">
                    {[
                      { k: t("reports.period"), v: reportType === "students" ? "—" : periodLabel },
                      { k: t("reports.group"), v: groupFilter || t("reports.allGroupsLabel") },
                      { k: t("reports.schoolYearShort"), v: schoolYear },
                    ].map((m) => (
                      <div key={m.k}>
                        <dt className="text-[9.5px] uppercase tracking-[0.12em] text-[#5a6a82]">{m.k}</dt>
                        <dd className="font-semibold mt-0.5">{m.v}</dd>
                      </div>
                    ))}
                  </dl>

                  {loading ? (
                    <div className="space-y-2 mt-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
                  ) : (
                    <>
                      {reportType === "attendance" && (
                        <>
                          {/* 1px gaps over a rule-coloured ground draw the inner hairlines */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#d6dde8] border border-[#d6dde8] mt-6">
                            {figures.map((f) => (
                              <div key={f.label} className="bg-white px-4 py-3.5">
                                <p className="font-serif font-bold text-[1.6rem] leading-none tabular-nums">{f.value}</p>
                                <p className="text-[11.5px] text-[#5a6a82] mt-1.5">{f.label}</p>
                              </div>
                            ))}
                          </div>
                          <h3 className="font-serif font-semibold text-[1.05rem] mt-7 mb-1">{t("reports.topAbsences")}</h3>
                        </>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px] mt-2">
                          <thead>
                            <tr className="border-b-[1.5px] border-[#17243a] text-[9.5px] uppercase tracking-[0.1em] text-[#5a6a82]">
                              <th className="text-left font-semibold py-2 pr-2 w-8">#</th>
                              <th className="text-left font-semibold py-2 pr-2">{t("reports.student")}</th>
                              {reportType === "students" && <th className="text-left font-semibold py-2 pr-2">{t("students.cne")}</th>}
                              <th className="text-left font-semibold py-2 pr-2">{t("reports.group")}</th>
                              {reportType === "absences" && <>
                                <th className="text-left font-semibold py-2 pr-2">{t("reports.date")}</th>
                                <th className="text-left font-semibold py-2 pr-2">{t("reports.attendance")}</th>
                                <th className="text-right font-semibold py-2 pr-2">{t("reports.hours")}</th>
                                <th className="text-left font-semibold py-2">{t("reports.justification")}</th>
                              </>}
                              {reportType !== "absences" && <th className="text-right font-semibold py-2">{t("reports.absenceHours")}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {reportType === "absences" && records.slice(0, PREVIEW_ROWS).map((a, i) => (
                              <tr key={a.id} className="border-b border-[#e3e8ef]">
                                <td className="py-2 pr-2 text-[#8a97aa] tabular-nums">{i + 1}</td>
                                <td className="py-2 pr-2">{a.student_name}</td>
                                <td className="py-2 pr-2">{a.group_name}</td>
                                <td className="py-2 pr-2 tabular-nums">{a.date}</td>
                                <td className="py-2 pr-2">{attendanceLabel(a)}</td>
                                <td className="py-2 pr-2 text-right tabular-nums">{a.hours}</td>
                                <td className={`py-2 font-semibold ${a.status === "justified" ? "text-[#127a43]" : a.status === "unjustified" ? "text-[#b3261e]" : "text-[#a55a00]"}`}>{statusLabel(a.status)}</td>
                              </tr>
                            ))}
                            {reportType === "students" && roster.slice(0, PREVIEW_ROWS).map((s, i) => (
                              <tr key={s.id} className="border-b border-[#e3e8ef]">
                                <td className="py-2 pr-2 text-[#8a97aa] tabular-nums">{i + 1}</td>
                                <td className="py-2 pr-2">{s.first_name} {s.last_name}</td>
                                <td className="py-2 pr-2 font-mono text-[11px]">{s.cne}</td>
                                <td className="py-2 pr-2">{s.group_name}</td>
                                <td className="py-2 text-right tabular-nums">{s.total_absence_hours}</td>
                              </tr>
                            ))}
                            {reportType === "attendance" && topAbsent.slice(0, PREVIEW_ROWS).map((s, i) => (
                              <tr key={s.id} className="border-b border-[#e3e8ef]">
                                <td className="py-2 pr-2 text-[#8a97aa] tabular-nums">{i + 1}</td>
                                <td className="py-2 pr-2">{s.first_name} {s.last_name}</td>
                                <td className="py-2 pr-2">{s.group_name}</td>
                                <td className="py-2 text-right tabular-nums">{s.total_absence_hours}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {rowCount === 0 && <p className="text-center text-[13px] text-[#8a97aa] py-10">{t("reports.noData")}</p>}
                      {rowCount > PREVIEW_ROWS && (
                        <p className="text-center text-[12px] text-[#5a6a82] mt-4 italic">
                          {t("reports.moreRows", { count: rowCount - PREVIEW_ROWS })}
                        </p>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-10 mt-14 text-[11.5px] text-[#5a6a82]">
                    <p className="border-t border-[#b8c2d1] pt-1.5">{t("reports.signPrepared")}</p>
                    <p className="border-t border-[#b8c2d1] pt-1.5">{t("reports.signDirector")}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </article>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default ReportsPage;
