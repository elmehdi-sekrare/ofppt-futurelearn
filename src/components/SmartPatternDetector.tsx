import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Radar, CalendarCheck2, Hourglass, ArrowRight, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightPattern } from "@/types/api";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

type Severity = InsightPattern["severity"];
type Filter = "all" | Severity;

const TONE: Record<Severity, { dot: string; text: string; soft: string; cell: string }> = {
  critical: { dot: "bg-destructive", text: "text-destructive", soft: "bg-destructive/[0.09] text-destructive", cell: "bg-destructive text-destructive-foreground" },
  warning: { dot: "bg-warning", text: "text-warning", soft: "bg-warning/[0.11] text-warning", cell: "bg-warning text-warning-foreground" },
  info: { dot: "bg-primary", text: "text-primary", soft: "bg-primary/[0.09] text-primary", cell: "bg-primary text-primary-foreground" },
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const SmartPatternDetector = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "insights"],
    queryFn: () => api.getDashboardInsights(),
    staleTime: 60_000,
  });

  const insights = data?.data;
  const patterns: InsightPattern[] = useMemo(() => insights?.patterns ?? [], [insights]);
  const totals = insights?.weekday_totals ?? [];
  const sum = totals.reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...totals);
  const peakDay = totals.length ? totals.indexOf(Math.max(...totals)) : -1;
  const dayLabels = DAY_KEYS.map((k) => t(`weekdays.${k}`));
  // French day names are common nouns mid-sentence; English keeps the capital.
  const inSentence = (i: number) => (i18n.language.startsWith("fr") ? dayLabels[i]?.toLowerCase() : dayLabels[i]);
  const share = (n: number) => (sum ? Math.round((n / sum) * 100) : 0);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: patterns.length, critical: 0, warning: 0, info: 0 };
    patterns.forEach((p) => { c[p.severity] += 1; });
    return c;
  }, [patterns]);

  const visible = filter === "all" ? patterns : patterns.filter((p) => p.severity === filter);
  const filters = (["all", "critical", "warning", "info"] as Filter[]).filter((f) => f === "all" || counts[f] > 0);

  const severityLabel = (s: Filter) =>
    s === "all" ? t("ai.filterAll") : s === "critical" ? t("ai.suspicious") : s === "warning" ? t("ai.notable") : t("ai.pattern");

  const focusDay = hoverDay ?? peakDay;
  const hasDistribution = !!insights?.has_data && sum > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.45, ease: EASE }}
      className="glass-panel flex flex-col overflow-hidden"
    >
      <header className="p-6 pb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/[0.1] flex items-center justify-center shrink-0">
            <Radar className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl leading-tight">{t("ai.patternTitle")}</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("ai.patternSubtitle")}</p>
          </div>
        </div>
        {patterns.length > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right leading-tight pt-1">
            {t("ai.patternCount", { count: patterns.length })}
          </span>
        )}
      </header>

      {/* Weekly rhythm: a readable headline plus an interactive distribution */}
      {hasDistribution && (
        <div className="mx-6 mb-5 rounded-xl border border-border/80 bg-secondary/35 p-5 grid gap-5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-end">
          <div className="min-w-0">
            <p className="eyebrow">{t("ai.patternDistribution")}</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={focusDay}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <p className="font-display font-extrabold text-[2.5rem] leading-none tracking-[-0.04em] tabular-nums mt-3">
                  {share(totals[focusDay] ?? 0)}<span className="text-xl text-muted-foreground font-bold ml-0.5">%</span>
                </p>
                <p className="text-[13px] text-muted-foreground mt-2 leading-snug">
                  {t("ai.patternShareOn", { day: inSentence(focusDay), count: totals[focusDay] ?? 0 })}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-end gap-1.5 h-28" onMouseLeave={() => setHoverDay(null)}>
            {totals.map((count, i) => {
              const ratio = count / peak;
              const active = i === focusDay;
              return (
                <button
                  key={DAY_KEYS[i]}
                  type="button"
                  onMouseEnter={() => setHoverDay(i)}
                  onFocus={() => setHoverDay(i)}
                  onBlur={() => setHoverDay(null)}
                  aria-label={`${dayLabels[i]} — ${count}`}
                  className="group flex-1 flex flex-col items-center gap-1.5 h-full justify-end outline-none"
                >
                  <span className={`text-[10.5px] tabular-nums h-3 transition-colors ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {count > 0 ? count : ""}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(ratio * 100, count > 0 ? 8 : 4)}%` }}
                      transition={{ duration: 0.7, delay: 0.28 + i * 0.05, ease: EASE }}
                      className={`w-full rounded-[5px] transition-[background-color,box-shadow] duration-200 group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                        count === 0 ? "bg-border/70"
                        : active ? "bg-primary shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.55)]"
                        : "bg-primary/30 group-hover:bg-primary/50"
                      }`}
                    />
                  </div>
                  <span className={`text-[11px] transition-colors ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                    {dayLabels[i].slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`px-6 flex-1 ${insights?.has_data ? "" : "pb-6"}`}>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
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
          <>
            {filters.length > 2 && (
              <div role="tablist" aria-label={t("ai.patternFilter")} className="flex flex-wrap gap-1.5 mb-3">
                {filters.map((f) => {
                  const active = f === filter;
                  return (
                    <button
                      key={f}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(f)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium border transition-colors ${
                        active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25"
                      }`}
                    >
                      {f !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${TONE[f].dot}`} />}
                      {severityLabel(f)}
                      <span className={`tabular-nums ${active ? "opacity-70" : "opacity-60"}`}>{counts[f]}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {visible.map((p, i) => {
                  const tone = TONE[p.severity];
                  const regularity = p.total ? Math.round((p.count / p.total) * 100) : 0;
                  return (
                    <motion.li
                      key={p.student_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: EASE }}
                    >
                      <button
                        onClick={() => navigate("/dashboard/risk")}
                        className="group w-full text-left rounded-xl border border-border bg-card p-3.5 flex items-center gap-3.5 transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/35 hover:shadow-[var(--shadow-card)] active:translate-y-px"
                      >
                        <span className={`w-10 h-10 rounded-[11px] flex items-center justify-center text-[13px] font-bold shrink-0 ${tone.soft}`}>
                          {initialsOf(p.student_name)}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{p.student_name}</span>
                            <span className="text-[10.5px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">{p.group_name}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-[12px]">
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${tone.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                              {severityLabel(p.severity)}
                            </span>
                            <span className="text-muted-foreground truncate">
                              {t("ai.patternDetail", { count: p.count, total: p.total, day: inSentence(p.day_index) })}
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-[3px]" aria-hidden="true">
                            {dayLabels.map((label, di) => (
                              <span
                                key={label}
                                title={label}
                                className={`w-[18px] h-[18px] rounded-[5px] text-[9px] flex items-center justify-center font-bold ${
                                  di === p.day_index ? tone.cell : "bg-secondary text-muted-foreground/70"
                                }`}
                              >
                                {label[0].toUpperCase()}
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {t("ai.patternRegularity", { value: regularity })}
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </>
        )}
      </div>

      {insights?.has_data && (
        <footer className="mt-5 px-6 py-3.5 border-t border-border/70 bg-secondary/30 flex items-center justify-between gap-4">
          <p className="text-[11.5px] text-muted-foreground leading-snug">{t("ai.patternMethod")}</p>
          <button
            onClick={() => navigate("/dashboard/risk")}
            className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary shrink-0 hover:underline underline-offset-4"
          >
            {t("ai.patternOpenRisk")}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      )}
    </motion.section>
  );
};

export default SmartPatternDetector;
