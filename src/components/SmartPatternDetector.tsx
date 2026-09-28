import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Radar, CalendarCheck2, Hourglass } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightPattern } from "@/types/api";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const SEVERITY = {
  critical: { chip: "bg-destructive text-destructive-foreground", text: "text-destructive", bar: "bg-destructive" },
  warning: { chip: "bg-warning text-warning-foreground", text: "text-warning", bar: "bg-warning" },
  info: { chip: "bg-primary text-primary-foreground", text: "text-primary", bar: "bg-primary" },
} as const;

const SmartPatternDetector = () => {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "insights"],
    queryFn: () => api.getDashboardInsights(),
    staleTime: 60_000,
  });

  const insights = data?.data;
  const patterns: InsightPattern[] = insights?.patterns ?? [];
  const totals = insights?.weekday_totals ?? [];
  const peak = Math.max(1, ...totals);
  const dayLabels = DAY_KEYS.map((k) => t(`weekdays.${k}`));

  const severityLabel = (s: InsightPattern["severity"]) =>
    s === "critical" ? t("ai.suspicious") : s === "warning" ? t("ai.notable") : t("ai.pattern");

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel flex flex-col"
    >
      <header className="p-6 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/[0.1] flex items-center justify-center shrink-0">
          <Radar className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-xl leading-tight">{t("ai.patternTitle")}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">{t("ai.patternSubtitle")}</p>
        </div>
      </header>

      {insights?.has_data && totals.some((n) => n > 0) && (
        <div className="px-6 pb-5">
          <p className="eyebrow mb-3">{t("ai.patternDistribution")}</p>
          <div className="flex items-end gap-1.5 h-16">
            {totals.map((count, i) => {
              const ratio = count / peak;
              return (
                <div key={DAY_KEYS[i]} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] text-muted-foreground tabular-nums h-3">{count > 0 ? count : ""}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(ratio * 100, count > 0 ? 8 : 3)}%` }}
                    transition={{ duration: 0.7, delay: 0.28 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    title={`${dayLabels[i]} — ${count}`}
                    className={`w-full rounded-t-md min-h-[3px] ${
                      ratio > 0.7 ? "bg-destructive" : ratio > 0.4 ? "bg-warning" : count > 0 ? "bg-primary/60" : "bg-secondary"
                    }`}
                  />
                  <span className="text-[10px] text-muted-foreground">{dayLabels[i].slice(0, 1).toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 pb-6 flex-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : !insights?.has_data ? (
          <div className="text-center py-10 px-4 rounded-xl bg-secondary/50">
            <Hourglass className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("ai.patternNoData")}</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[38ch] mx-auto">{t("ai.patternNoDataHint")}</p>
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl bg-success/[0.07]">
            <CalendarCheck2 className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-sm font-medium text-success">{t("ai.patternEmpty")}</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[38ch] mx-auto">{t("ai.patternEmptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {patterns.map((p, i) => {
              const tone = SEVERITY[p.severity];
              return (
                <motion.li
                  key={p.student_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-xl border border-border bg-card p-3.5"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{p.student_name}</span>
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">{p.group_name}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${tone.chip}`}>
                      {severityLabel(p.severity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground">
                      {t("ai.patternDetail", { count: p.count, total: p.total, day: dayLabels[p.day_index] })}
                    </p>
                    <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                      {dayLabels.map((label, di) => (
                        <span
                          key={label}
                          className={`w-5 h-5 rounded text-[8px] flex items-center justify-center font-bold ${
                            di === p.day_index ? tone.chip : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {label[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.section>
  );
};

export default SmartPatternDetector;
