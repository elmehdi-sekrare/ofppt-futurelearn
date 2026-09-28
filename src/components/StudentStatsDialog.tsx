import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Clock, CalendarX, AlarmClock, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Student } from "@/types/api";

interface Props {
  student: Student | null;
  onClose: () => void;
}

/** Locks body scroll so the page behind the panel cannot move. */
const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => { document.body.style.overflow = overflow; document.body.style.paddingRight = paddingRight; };
  }, [active]);
};

const StudentStatsDialog = ({ student, onClose }: Props) => {
  const { t } = useTranslation();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => { setPortalRoot(document.body); }, []);
  useScrollLock(!!student);

  useEffect(() => {
    if (!student) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [student, onClose]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["student-stats", student?.id],
    queryFn: () => api.getStudentStats(student!.id),
    enabled: !!student,
  });

  const stats = data?.data;
  const maxMonthly = Math.max(1, ...(stats?.monthly ?? []).map((m) => m.hours));
  const thresholdPercent = stats ? Math.min(100, (stats.absence_hours / stats.threshold_hours) * 100) : 0;
  const overThreshold = !!stats && stats.absence_hours > stats.threshold_hours;

  const initials = student ? `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toUpperCase() : "";

  const tiles = stats ? [
    { key: "hours", icon: Clock, label: t("stats.absenceHours"), value: `${stats.absence_hours}h`, sub: null, alert: overThreshold },
    { key: "count", icon: CalendarX, label: t("stats.absences"), value: String(stats.absence_count), sub: null, alert: false },
    { key: "late", icon: AlarmClock, label: t("stats.lateArrivals"), value: String(stats.late_count), sub: stats.late_minutes > 0 ? t("stats.minutesTotal", { count: stats.late_minutes }) : null, alert: false },
    { key: "rate", icon: TrendingUp, label: t("stats.attendance"), value: `${stats.attendance_rate}%`, sub: t("stats.sessions", { count: stats.session_count }), alert: false },
  ] : [];

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {student && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9990] bg-foreground/30 backdrop-blur-[2px]"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("stats.title", { name: `${student.first_name} ${student.last_name}` })}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-[9991] w-full sm:w-[min(31rem,94vw)] bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header stays put; only the body below scrolls */}
            <header className="shrink-0 px-6 py-5 border-b border-border flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-display font-semibold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-semibold text-lg leading-tight truncate">{student.first_name} {student.last_name}</h2>
                  <p className="text-xs text-muted-foreground mono-figure truncate">{student.cne} · {student.group_name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t("app.close")}
                className="p-1.5 -mr-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-7">
              {isLoading && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
                  </div>
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">{t("stats.loadFailed")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
                </div>
              )}

              {stats && (
                <>
                  <section className="grid grid-cols-2 gap-3">
                    {tiles.map(({ key, icon: Icon, label, value, sub, alert }) => (
                      <div key={key} className="rounded-xl border border-border bg-secondary/40 p-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium">{label}</span>
                        </div>
                        <p className={`text-2xl font-display font-bold tabular-nums leading-none ${alert ? "text-destructive" : ""}`}>{value}</p>
                        {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
                      </div>
                    ))}
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="eyebrow">{t("stats.threshold")}</h3>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t("stats.thresholdOf", { hours: stats.absence_hours, max: stats.threshold_hours })}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${thresholdPercent}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${overThreshold ? "bg-destructive" : thresholdPercent > 60 ? "bg-warning" : "bg-success"}`}
                      />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { label: t("absences.justified"), value: stats.justified_hours, tone: "text-success" },
                        { label: t("absences.unjustified"), value: stats.unjustified_hours, tone: "text-destructive" },
                        { label: t("absences.pending"), value: stats.pending_hours, tone: "text-warning" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-secondary/40 px-3 py-2">
                          <dt className="text-[10px] text-muted-foreground truncate">{item.label}</dt>
                          <dd className={`text-sm font-semibold tabular-nums ${item.tone}`}>{item.value}h</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="eyebrow">{t("stats.lastSixMonths")}</h3>
                      {stats.worst_weekday && (
                        <p className="text-xs text-muted-foreground">{t("stats.mostMissed", { day: t(`weekdays.${stats.worst_weekday.toLowerCase()}`, stats.worst_weekday) })}</p>
                      )}
                    </div>
                    <div className="flex items-end gap-2 h-28">
                      {stats.monthly.map((month, i) => (
                        <div key={month.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <span className="text-[10px] text-muted-foreground tabular-nums h-3">{month.hours > 0 ? `${month.hours}h` : ""}</span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(3, (month.hours / maxMonthly) * 100)}%` }}
                            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                            className={`w-full rounded-t-md ${month.hours > 0 ? "bg-primary/70" : "bg-secondary"}`}
                          />
                          <span className="text-[10px] text-muted-foreground capitalize">{month.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="eyebrow">{t("stats.recentRecords")}</h3>
                    {stats.recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground rounded-lg bg-secondary/40 px-3 py-4 text-center">{t("stats.noRecords")}</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                        {stats.recent.map((record) => (
                          <li key={record.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-card">
                            <div className="min-w-0">
                              <p className="text-sm tabular-nums">{record.date}</p>
                              <p className="text-[11px] text-muted-foreground capitalize">{t(`absences.${record.status}`, record.status)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {record.hours > 0 && <span className="text-sm font-medium tabular-nums">{record.hours}h</span>}
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                record.attendance_status === "absent" ? "bg-destructive/10 text-destructive"
                                : record.attendance_status === "late" ? "bg-warning/10 text-warning"
                                : "bg-success/10 text-success"}`}>
                                {t(`absences.${record.attendance_status}`, record.attendance_status)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    portalRoot
  );
};

export default StudentStatsDialog;
