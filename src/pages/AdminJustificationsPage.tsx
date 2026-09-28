import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ClipboardList, Search, Filter, Check, Ban, X, Calendar, Clock, CheckCircle2, XCircle, Clock3, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchField from "@/components/SearchField";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Absence } from "@/types/api";

/**
 * Admin Justification Review — paper workflow.
 * Students do not use the portal to upload justifications; they bring paper
 * documents to the office. The admin reviews pending absences here and marks
 * them justified / unjustified / removed directly.
 */
/** Local YYYY-MM-DD for <input type="date">; toISOString() would shift by timezone. */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const AdminJustificationsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [view, setView] = useState<"pending" | "resolved">("pending");

  // Absences the admin still has to decide on (paper workflow)
  const { data: pendingRes, isLoading } = useQuery({
    queryKey: ["absences", "awaiting-justification"],
    queryFn: () => api.getAbsences({ status: "pending", attendance_status: "absent,late", sort: "latest" }),
  });

  // Recently resolved records (justified / unjustified by anyone)
  const { data: resolvedRes } = useQuery({
    queryKey: ["absences", "recently-resolved"],
    queryFn: () => api.getAbsences({ status: "justified,unjustified", attendance_status: "absent,late", sort: "latest", limit: 50 }),
  });

  const { data: groupsRes } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const pendingAbsences: Absence[] = pendingRes?.data ?? [];
  const resolvedAbsences: Absence[] = resolvedRes?.data ?? [];
  const groups = groupsRes?.data ?? [];

  const resolveMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "justified" | "unjustified" | "voided"; note: string }) => api.resolveAbsence(id, action, note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["justifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      const label = t(`absences.${variables.action === "voided" ? "voided" : variables.action}`);
      toast({ title: `${t("justifications.updated")} — ${label}`, description: t("justifications.updatedDesc") });
    },
    onError: (error: Error) => toast({ title: t("justifications.updateFailed"), description: error.message, variant: "destructive" }),
  });

  const resolveAbsence = (id: number, action: "justified" | "unjustified" | "voided") => {
    const note = window.prompt(
      action === "voided"
        ? "Why should this absence be removed from calculations?"
        : action === "justified"
          ? "Paper justification received — add a note (e.g. medical certificate):"
          : "Why is this absence unjustified?"
    );
    if (!note?.trim()) return;
    resolveMutation.mutate({ id, action, note: note.trim() });
  };

  const filterAbsences = (list: Absence[]) =>
    list.filter((a) => {
      const matchSearch = `${a.student_name} ${a.subject} ${a.group_name}`.toLowerCase().includes(search.toLowerCase());
      const matchGroup = !groupFilter || a.group_name === groupFilter;
      const matchDate = !dateFilter || a.date === dateFilter;
      return matchSearch && matchGroup && matchDate;
    });

  const filteredPending = useMemo(() => filterAbsences(pendingAbsences), [pendingAbsences, search, groupFilter, dateFilter]);
  const filteredResolved = useMemo(() => filterAbsences(resolvedAbsences), [resolvedAbsences, search, groupFilter, dateFilter]);

  const stats = useMemo(() => ({
    pending: pendingAbsences.length,
    justified: resolvedAbsences.filter((a) => a.status === "justified").length,
    unjustified: resolvedAbsences.filter((a) => a.status === "unjustified").length,
    pendingHours: pendingAbsences.reduce((sum, a) => sum + a.hours, 0),
  }), [pendingAbsences, resolvedAbsences]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title mt-2.5">{t("justifications.reviewTitle")}</h1>
        <span className="brand-rule" />
        <p className="text-muted-foreground mt-4">
          {t("justifications.subtitle")}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("justifications.awaitingDecision"), value: stats.pending, icon: Clock3, color: "text-warning" },
          { label: t("justifications.pendingHours"), value: stats.pendingHours + "h", icon: Clock, color: "text-foreground" },
          { label: t("justifications.justifiedRecent"), value: stats.justified, icon: CheckCircle2, color: "text-success" },
          { label: t("justifications.unjustifiedRecent"), value: stats.unjustified, icon: XCircle, color: "text-destructive" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-panel p-4 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <SearchField value={search} onChange={setSearch} placeholder={t("justifications.searchPlaceholder")} className="flex-1 basis-[22rem]" />
        <StyledSelect
          value={groupFilter}
          onValueChange={setGroupFilter}
          icon={<Filter className="w-4 h-4" />}
          className="w-full sm:w-[130px] shrink-0"
          options={[{ label: t("justifications.allGroups"), value: "" }, ...groups.map((g) => ({ label: g.name, value: g.name }))]}
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
        <StyledSelect
          value={view}
          onValueChange={(v) => setView(v as "pending" | "resolved")}
          icon={<FileCheck className="w-4 h-4" />}
          className="w-full sm:w-[160px] shrink-0"
          options={[
            { label: t("justifications.awaiting"), value: "pending" },
            { label: t("justifications.recentlyResolved"), value: "resolved" },
          ]}
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {view === "pending" ? (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <p className="text-xs text-muted-foreground">{filteredPending.length} absence{filteredPending.length !== 1 ? "s" : ""} waiting for a decision</p>
              {filteredPending.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{a.student_name}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                        {a.attendance_status === "late" ? `${t("justifications.late")} · ${a.late_minutes}m` : t("justifications.absent")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{a.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.start_time} – {a.end_time} · {a.hours}h</span>
                      <span>{a.subject} · {a.group_name}</span>
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{a.notes}"</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button size="sm" onClick={() => resolveAbsence(a.id, "justified")} className="gap-1.5 bg-success/10 hover:bg-success/20 text-success border-0 h-8 text-xs">
                      <Check className="w-3.5 h-3.5" /> {t("justifications.justifyPaper")}
                    </Button>
                    <Button size="sm" onClick={() => resolveAbsence(a.id, "unjustified")} className="gap-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border-0 h-8 text-xs">
                      <Ban className="w-3.5 h-3.5" /> {t("justifications.unjustified")}
                    </Button>
                    <Button size="sm" onClick={() => resolveAbsence(a.id, "voided")} className="gap-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border-0 h-8 text-xs">
                      <X className="w-3.5 h-3.5" /> {t("justifications.remove")}
                    </Button>
                  </div>
                </motion.div>
              ))}
              {filteredPending.length === 0 && (
                <div className="glass-panel p-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-success/40 mx-auto mb-3" />
                  <p className="font-display font-semibold">{t("justifications.allCaughtUp")}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[52ch] mx-auto">{t("justifications.emptyPending")}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="resolved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("justifications.resolvedCount", { count: filteredResolved.length })}</p>
              {filteredResolved.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.status === "justified" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {a.status === "justified" ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{a.student_name}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${a.status === "justified" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {a.status}
                      </span>
                      {a.resolution_source === "admin" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">by admin</span>}
                      {a.attendance_status === "late" && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">Late · {a.late_minutes}m</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{a.date}</span>
                      <span>{a.subject} · {a.hours}h · {a.group_name}</span>
                    </p>
                    {a.resolution_note && <p className="text-xs text-muted-foreground mt-1 italic">Note: {a.resolution_note}</p>}
                  </div>
                  {a.status !== "voided" && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {a.status !== "justified" && (
                        <Button size="sm" onClick={() => resolveAbsence(a.id, "justified")} className="gap-1.5 bg-success/10 hover:bg-success/20 text-success border-0 h-8 text-xs">
                          <Check className="w-3.5 h-3.5" /> Justify
                        </Button>
                      )}
                      {a.status !== "unjustified" && (
                        <Button size="sm" onClick={() => resolveAbsence(a.id, "unjustified")} className="gap-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border-0 h-8 text-xs">
                          <Ban className="w-3.5 h-3.5" /> Unjustify
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolveAbsence(a.id, "voided")} className="gap-1.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border-0 h-8 text-xs">
                        <X className="w-3.5 h-3.5" /> {t("justifications.remove")}
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
              {filteredResolved.length === 0 && (
                <div className="glass-panel p-12 text-center">
                  <FileCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="font-display font-semibold">{t("justifications.emptyResolved")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("justifications.emptyResolvedHint")}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminJustificationsPage;