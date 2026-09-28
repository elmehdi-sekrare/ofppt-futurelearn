import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Activity, Hourglass, ShieldCheck, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightStudent, RiskLevel } from "@/types/api";

const TONE: Record<RiskLevel, { bar: string; text: string; ring: string }> = {
  critical: { bar: "bg-destructive", text: "text-destructive", ring: "stroke-destructive" },
  high: { bar: "bg-warning", text: "text-warning", ring: "stroke-warning" },
  watch: { bar: "bg-primary", text: "text-primary", ring: "stroke-primary" },
  ok: { bar: "bg-success", text: "text-success", ring: "stroke-success" },
};

/** Compact score ring — reads faster than a number alone. */
const ScoreRing = ({ score, level }: { score: number; level: RiskLevel }) => {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-secondary" />
        <motion.circle
          cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
          className={TONE[level].ring}
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums ${TONE[level].text}`}>
        {score}
      </span>
    </div>
  );
};

const AIRiskPredictor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "insights"],
    queryFn: () => api.getDashboardInsights(),
    staleTime: 60_000,
  });

  const insights = data?.data;
  const students: InsightStudent[] = insights?.students ?? [];

  const reasonText = (r: InsightStudent["reasons"][number]) =>
    r.key === "rate" ? t("ai.reasonRate", { value: r.value })
    : r.key === "unjustified" ? t("ai.reasonUnjustified", { value: r.value })
    : t("ai.reasonLate", { count: r.value });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel flex flex-col"
    >
      <header className="p-6 pb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/[0.09] flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl leading-tight">{t("ai.riskTitle")}</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("ai.riskSubtitle")}</p>
          </div>
        </div>
        {insights?.has_data && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right leading-tight">
            {t("ai.cohortRate", { rate: insights.cohort.absence_rate })}
          </span>
        )}
      </header>

      <div className="px-6 pb-6 flex-1">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
          </div>
        ) : !insights?.has_data ? (
          <div className="text-center py-10 px-4 rounded-xl bg-secondary/50">
            <Hourglass className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("ai.riskNoData")}</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[38ch] mx-auto">{t("ai.riskNoDataHint")}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-xl bg-success/[0.07]">
            <ShieldCheck className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-sm font-medium text-success">{t("ai.riskEmpty")}</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[38ch] mx-auto">{t("ai.riskEmptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {students.map((s, i) => (
              <motion.li
                key={s.student_id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => navigate("/dashboard/risk")}
                  className="group w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-primary/35 hover:bg-secondary/40 transition-colors flex items-center gap-3.5"
                >
                  <ScoreRing score={s.score} level={s.level} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{s.student_name}</span>
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">{s.group_name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {s.reasons.map(reasonText).join(" · ")}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.score}%` }}
                        transition={{ duration: 0.8, delay: 0.25 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${TONE[s.level].bar}`}
                      />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}

        {students.length > 0 && (
          <footer className="mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
            {t("ai.scoreExplainer")}
          </footer>
        )}
      </div>
    </motion.section>
  );
};

export default AIRiskPredictor;
