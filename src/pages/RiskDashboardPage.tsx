import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock3, ShieldAlert, UserRoundCheck, Search, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/styled-select";

const riskStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/25",
  medium: "bg-warning/10 text-warning border-warning/25",
  low: "bg-primary/10 text-primary border-primary/25",
  none: "bg-success/10 text-success border-success/25",
};

const RiskDashboardPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard", "risk"], queryFn: api.getRiskStudents });
  const students = data?.data ?? [];

  const filtered = useMemo(() => students.filter((student) => {
    const matchesSearch = `${student.student_name} ${student.group_name}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!riskFilter || student.risk_level === riskFilter);
  }), [students, search, riskFilter]);

  const counts = useMemo(() => ({
    high: students.filter((s) => s.risk_level === "high").length,
    medium: students.filter((s) => s.risk_level === "medium").length,
    low: students.filter((s) => s.risk_level === "low").length,
  }), [students]);

  const riskLabel = (level: string) => t(`risk.${level}`, level);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <p className="eyebrow">{t("nav.risk")}</p>
        <h1 className="page-title mt-2.5">{t("risk.heading")}</h1>
          <span className="brand-rule" />
        <p className="text-muted-foreground mt-4 max-w-[64ch]">{t("risk.subtitle")}</p>
      </motion.header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: "high", label: t("risk.high"), value: counts.high, icon: ShieldAlert, color: "text-destructive" },
          { key: "medium", label: t("risk.medium"), value: counts.medium, icon: AlertTriangle, color: "text-warning" },
          { key: "low", label: t("risk.monitoring"), value: counts.low, icon: UserRoundCheck, color: "text-primary" },
        ].map(({ key, label, value, icon: Icon, color }) => (
          <div key={key} className="glass-panel p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-2xl font-display font-bold tabular-nums leading-none ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("risk.searchPlaceholder")}
            aria-label={t("risk.searchPlaceholder")}
            className="input-glass pl-10"
          />
        </div>
        <StyledSelect
          value={riskFilter}
          onValueChange={setRiskFilter}
          className="w-full sm:w-[180px] shrink-0"
          options={[
            { label: t("risk.allLevels"), value: "" },
            { label: t("risk.high"), value: "high" },
            { label: t("risk.medium"), value: "medium" },
            { label: t("risk.low"), value: "low" },
            { label: t("risk.none"), value: "none" },
          ]}
        />
      </div>

      {isError ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-sm font-medium text-destructive">{t("risk.loadFailed")}</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left">
                  <th className="th-label">{t("risk.student")}</th>
                  <th className="th-label">{t("nav.risk")}</th>
                  <th className="th-label">{t("risk.absences")}</th>
                  <th className="th-label">{t("risk.lateArrivals")}</th>
                  <th className="th-label">{t("risk.whyFlagged")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.student_id} className="border-b border-border/50 hover:bg-secondary/25 transition-colors">
                    <td className="p-4">
                      <p className="font-medium">{student.student_name}</p>
                      <p className="text-xs text-muted-foreground">{student.group_name}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[student.risk_level]}`}>
                        {riskLabel(student.risk_level)}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="tabular-nums font-medium">{student.absence_hours}h</p>
                      <p className="text-xs text-muted-foreground">{t("risk.inLast30", { count: student.recent_absence_count })}</p>
                    </td>
                    <td className="p-4">
                      <p className="flex items-center gap-1.5 tabular-nums font-medium">
                        <Clock3 className="w-3.5 h-3.5 text-warning" />{student.late_count}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("risk.inLast30", { count: student.recent_late_count })}</p>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground max-w-[26rem]">
                      {student.factors.length ? student.factors.join(" · ") : t("risk.noFactors")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="p-14 text-center">
              <ShieldCheck className="w-9 h-9 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("risk.noMatch")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RiskDashboardPage;
