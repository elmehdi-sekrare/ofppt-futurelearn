import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Search, Filter, ClipboardList, Calendar, Clock, Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import SearchField from "@/components/SearchField";
import { Button } from "@/components/ui/button";
import { exportAbsencesCSV } from "@/utils/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";
import ResolveAbsenceDialog, { type ResolveAction } from "@/components/ResolveAbsenceDialog";
import type { Absence } from "@/types/api";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  justified: "bg-success/10 text-success",
  unjustified: "bg-destructive/10 text-destructive",
  voided: "bg-muted text-muted-foreground",
};

const attendanceColors: Record<string, string> = {
  present: "bg-success/10 text-success",
  late: "bg-warning/10 text-warning",
  absent: "bg-destructive/10 text-destructive",
  excused: "bg-primary/10 text-primary",
};

/** The API treats an empty attendance filter as "absent only", so "all" must be explicit. */
const ALL_ATTENDANCE = "absent,late,present,excused";

const AdminAbsencesPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  // Open on every recorded absence. Defaulting to today + pending hid all
  // history, so the page looked empty whenever no class ran that day.
  const [statusFilter, setStatusFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("absent");
  const [dateFilter, setDateFilter] = useState("");
  const [pending, setPending] = useState<{ absence: Absence; action: ResolveAction } | null>(null);

  const attendanceParam = attendanceFilter || ALL_ATTENDANCE;
  const { data: absencesRes, isLoading: loadingAbsences, isFetching } = useQuery({
    queryKey: ["absences", { group: groupFilter, status: statusFilter, attendance_status: attendanceParam, date: dateFilter, search }],
    queryFn: () => api.getAbsences({ group: groupFilter, status: statusFilter, attendance_status: attendanceParam, date: dateFilter, search }),
    placeholderData: (prev) => prev,
  });

  const { data: groupsRes } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const absences = absencesRes?.data ?? [];
  const groups = groupsRes?.data ?? [];

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "justified" | "unjustified" | "voided"; note: string }) => api.resolveAbsence(id, action, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPending(null);
      toast({ title: t("absences.updated"), description: t("absences.updatedDesc") });
    },
    onError: (error: Error) => toast({ title: t("absences.updateFailed"), description: error.message, variant: "destructive" }),
  });

  const resolveAbsence = (absence: Absence, action: ResolveAction) => setPending({ absence, action });

  const filtered = absences; // Filtering is done server-side
  const totalHours = filtered.reduce((sum, a) => sum + a.hours, 0);

  const statusCounts = useMemo(() => ({
    total: absences.length,
    pending: absences.filter((a) => a.status === "pending").length,
    justified: absences.filter((a) => a.status === "justified").length,
    unjustified: absences.filter((a) => a.status === "unjustified").length,
  }), [absences]);
  const attendanceCounts = useMemo(() => ({
    late: absences.filter((a) => a.attendance_status === "late").length,
    present: absences.filter((a) => a.attendance_status === "present").length,
    excused: absences.filter((a) => a.attendance_status === "excused").length,
  }), [absences]);

  if (loadingAbsences) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResolveAbsenceDialog
        absence={pending?.absence ?? null}
        action={pending?.action ?? null}
        loading={resolveMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(note) => pending && resolveMutation.mutate({ id: pending.absence.id, action: pending.action, note })}
      />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title mt-2.5">{t("absences.title")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4">{t("absences.summary", { count: filtered.length, hours: totalHours })}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { exportAbsencesCSV(filtered as any); toast({ title: t("absences.exportDone"), description: t("absences.exportDesc", { count: filtered.length }) }); }}>
          <Download className="w-4 h-4" /> {t("absences.exportCsv")}
        </Button>
      </motion.div>

      <dl className="glass-panel grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
        {(attendanceFilter !== "absent" ? [
          { label: t("absences.total"), value: absences.length, dot: "bg-foreground/60" },
          { label: t("absences.late"), value: attendanceCounts.late, dot: "bg-warning" },
          { label: t("absences.present"), value: attendanceCounts.present, dot: "bg-success" },
          { label: t("absences.excused"), value: attendanceCounts.excused, dot: "bg-primary" },
        ] : [
          { label: t("absences.total"), value: statusCounts.total, dot: "bg-foreground/60" },
          { label: t("absences.pending"), value: statusCounts.pending, dot: "bg-warning" },
          { label: t("absences.justified"), value: statusCounts.justified, dot: "bg-success" },
          { label: t("absences.unjustified"), value: statusCounts.unjustified, dot: "bg-destructive" },
        ]).map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i % 2 === 1 ? "border-l border-border/80" : ""} ${i >= 2 ? "border-t sm:border-t-0 border-border/80" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
            </dt>
            <dd className="mt-1.5 font-display font-bold text-[1.75rem] leading-none tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <SearchField value={search} onChange={setSearch} placeholder={t("absences.searchPlaceholder")} className="flex-1 basis-[22rem]" />
        <StyledSelect
          value={attendanceFilter}
          onValueChange={setAttendanceFilter}
          className="w-full sm:w-[130px] shrink-0"
          options={[{ label: t("absences.title"), value: "absent" }, { label: t("absences.lateArrivals"), value: "late" }, { label: t("absences.present"), value: "present" }, { label: t("absences.excusedAttendance"), value: "excused" }, { label: t("absences.allAttendance"), value: "" }]}
        />
        <StyledSelect
          value={groupFilter}
          onValueChange={setGroupFilter}
          className="w-full sm:w-[130px] shrink-0"
          options={[{ label: t("absences.allGroups"), value: "" }, ...groups.map((g) => ({ label: g.name, value: g.name }))]}
        />
        <StyledSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-full sm:w-[130px] shrink-0"
          options={[
            { label: t("absences.allStatus"), value: "" },
            { label: t("absences.pending"), value: "pending" },
            { label: t("absences.justified"), value: "justified" },
            { label: t("absences.unjustified"), value: "unjustified" },
            { label: t("absences.removed"), value: "voided" },
          ]}
        />
        <div className="relative">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label={t("absences.date")}
            className={`input-glass w-auto ${dateFilter ? "pr-9" : ""}`}
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              title={t("absences.clearDate")}
              aria-label={t("absences.clearDate")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`glass-panel overflow-hidden transition-opacity ${isFetching ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="th-label">{t("absences.student")}</th>
                <th className="th-label hidden sm:table-cell">{t("absences.group")}</th>
                <th className="th-label hidden md:table-cell">{t("absences.date")}</th>
                <th className="th-label hidden lg:table-cell">{t("absences.time")}</th>
                <th className="th-label hidden md:table-cell">{t("absences.subject")}</th>
                <th className="th-label">{t("absences.hours")}</th>
                <th className="th-label">{t("absences.attendance")}</th>
                <th className="th-label hidden lg:table-cell">{t("absences.justification")}</th>
                <th className="th-label !text-right">{t("absences.adminAction")}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((a, i) => (
                  <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-[9px] bg-primary/[0.09] text-primary flex items-center justify-center shrink-0 text-[11.5px] font-bold">
                          {a.student_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium">{a.student_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{a.group_name} · {a.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{a.group_name}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{a.date}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">
                      <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{a.start_time} – {a.end_time}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{a.subject}</td>
                    <td className="py-3 px-4 font-medium">{a.hours}h</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${attendanceColors[a.attendance_status]}`}>{t(`absences.${a.attendance_status}`, a.attendance_status)}{a.attendance_status === "late" ? ` · ${a.late_minutes}m` : ""}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {(a.attendance_status === "absent" || a.attendance_status === "late") ? <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[a.status]}`}>{t(`absences.${a.status}`, a.status)}</span> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(a.attendance_status === "absent" || a.attendance_status === "late") && <div className="flex justify-end gap-1 flex-wrap">
                        {a.status !== "justified" && <Button size="sm" variant="outline" onClick={() => resolveAbsence(a, "justified")} className="h-7 text-xs">{t("absences.justify")}</Button>}
                        {a.status !== "unjustified" && <Button size="sm" variant="ghost" onClick={() => resolveAbsence(a, "unjustified")} className="h-7 text-xs">{t("absences.unjustify")}</Button>}
                        {a.status !== "voided" && <Button size="sm" variant="ghost" onClick={() => resolveAbsence(a, "voided")} className="h-7 text-xs">{t("absences.remove")}</Button>}
                      </div>}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{t("absences.empty")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("absences.emptyHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAbsencesPage;
