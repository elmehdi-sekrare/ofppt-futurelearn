import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock3, ShieldCheck, Scale, ChevronRight, CalendarX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import SearchField from "@/components/SearchField";
import { StyledSelect } from "@/components/ui/styled-select";
import StudentStatsDialog from "@/components/StudentStatsDialog";
import { getDateLocale } from "@/i18n/i18n";
import type { RiskStudent, Student } from "@/types/api";

type Level = RiskStudent["risk_level"];
type SortKey = "level" | "score" | "unexcused" | "name";

const EASE = [0.22, 1, 0.36, 1] as const;
const LEVELS: Level[] = ["high", "medium", "low", "none"];
/** Official alert threshold for unjustified hours (mirrors AttendanceRiskService). */
const UNEXCUSED_LIMIT = 10;

const LEVEL_TONE: Record<Level, { dot: string; bar: string; pill: string }> = {
  high: { dot: "bg-destructive", bar: "bg-destructive", pill: "bg-destructive/[0.09] text-destructive" },
  medium: { dot: "bg-warning", bar: "bg-warning", pill: "bg-warning/[0.11] text-warning" },
  low: { dot: "bg-primary", bar: "bg-primary", pill: "bg-primary/[0.09] text-primary" },
  none: { dot: "bg-success", bar: "bg-success/70", pill: "bg-success/[0.09] text-success" },
};

const scoreTone = (score: number) =>
  score >= 70 ? { bar: "bg-destructive", text: "text-destructive" }
  : score >= 45 ? { bar: "bg-warning", text: "text-warning" }
  : score >= 20 ? { bar: "bg-primary", text: "text-primary" }
  : { bar: "bg-success", text: "text-success" };

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const RiskDashboardPage = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<Level | "">("");
  const [sort, setSort] = useState<SortKey>("level");
  const [selected, setSelected] = useState<Student | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard", "risk"], queryFn: api.getRiskStudents });
  // Cached by the Students page; used to open the same statistics panel from a row.
  const { data: studentsRes } = useQuery({ queryKey: ["students"], queryFn: () => api.getStudents(), staleTime: 60_000 });

  const students = useMemo(() => data?.data ?? [], [data]);
  const studentById = useMemo(() => new Map((studentsRes?.data ?? []).map((s) => [s.id, s])), [studentsRes]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { high: 0, medium: 0, low: 0, none: 0 };
    students.forEach((s) => { c[s.risk_level] += 1; });
    return c;
  }, [students]);

  const flagged = counts.high + counts.medium + counts.low;
  const watchlist = students.filter((s) => s.risk_level === "none" && s.score >= 45).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = students.filter((s) =>
      (!levelFilter || s.risk_level === levelFilter) &&
      (!q || `${s.student_name} ${s.group_name}`.toLowerCase().includes(q))
    );
    const rank = (l: Level) => LEVELS.indexOf(l);
    return [...list].sort((a, b) =>
      sort === "name" ? a.student_name.localeCompare(b.student_name)
      : sort === "unexcused" ? b.unexcused_hours - a.unexcused_hours
      : sort === "score" ? b.score - a.score
      : rank(a.risk_level) - rank(b.risk_level) || b.score - a.score
    );
  }, [students, search, levelFilter, sort]);

  const factorText = (f: RiskStudent["factor_codes"][number]) => t(`risk.factor.${f.key}`, { count: f.value, value: f.value });
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <Skeleton className="h-24 w-80" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-[1400px]">
      <StudentStatsDialog student={selected} onClose={() => setSelected(null)} />

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="grid gap-6 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-end"
      >
        <div>
          <p className="eyebrow">{t("nav.risk")}</p>
          <h1 className="page-title mt-2.5">{t("risk.heading")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4 max-w-[60ch]">{t("risk.subtitle")}</p>
        </div>

        {/* The rules, stated plainly, so a level is never a black box */}
        <aside className="rounded-xl border border-border bg-card/70 px-5 py-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Scale className="w-3.5 h-3.5 text-primary" /> {t("risk.rulesTitle")}
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[13px]">
            {(t("risk.rules", { returnObjects: true }) as string[]).map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span className="mt-[7px] w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </aside>
      </motion.header>

      {/* Cohort overview: one distribution, the legend doubles as a filter */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.4, ease: EASE }}
        className="glass-panel p-6 grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr]"
      >
        <div className="lg:border-r lg:border-border/80 lg:pr-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("risk.inAlert")}</p>
          <p className="mt-2 font-display font-extrabold text-[3rem] leading-none tracking-[-0.04em] tabular-nums">
            {flagged}
            <span className="text-lg font-semibold text-muted-foreground tracking-normal ml-1.5">/ {students.length}</span>
          </p>
          <p className="text-[13px] text-muted-foreground mt-2.5 leading-snug">
            {watchlist > 0 ? t("risk.watchlistNote", { count: watchlist }) : t("risk.monitoredNote", { count: students.length })}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex h-3 rounded-full overflow-hidden bg-secondary" role="img" aria-label={t("risk.distribution")}>
            {LEVELS.map((l, i) => counts[l] > 0 && (
              <motion.div
                key={l}
                initial={{ width: 0 }}
                animate={{ width: `${(counts[l] / Math.max(1, students.length)) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.06, ease: EASE }}
                className={`${LEVEL_TONE[l].bar} ${levelFilter && levelFilter !== l ? "opacity-25" : ""} transition-opacity border-r-2 border-card last:border-r-0`}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LEVELS.map((l) => {
              const active = levelFilter === l;
              return (
                <button
                  key={l}
                  onClick={() => setLevelFilter(active ? "" : l)}
                  aria-pressed={active}
                  className={`text-left rounded-lg border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200 ${
                    active ? "border-foreground/30 bg-secondary/70 shadow-[var(--shadow-card)]" : "border-border/70 hover:border-foreground/20 hover:bg-secondary/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <span className={`w-2 h-2 rounded-full ${LEVEL_TONE[l].dot}`} />
                    {t(`risk.${l}`)}
                  </span>
                  <span className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-display font-bold text-2xl leading-none tabular-nums">{counts[l]}</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {students.length ? Math.round((counts[l] / students.length) * 100) : 0} %
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchField value={search} onChange={setSearch} placeholder={t("risk.searchPlaceholder")} className="flex-1 basis-[22rem]" />
        <StyledSelect
          value={sort}
          onValueChange={(v) => setSort(v as SortKey)}
          className="w-full sm:w-[220px] shrink-0"
          options={[
            { label: t("risk.sortLevel"), value: "level" },
            { label: t("risk.sortScore"), value: "score" },
            { label: t("risk.sortUnexcused"), value: "unexcused" },
            { label: t("risk.sortName"), value: "name" },
          ]}
        />
      </div>

      {isError ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-sm font-medium text-destructive">{t("risk.loadFailed")}</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="px-5 py-3 border-b border-border/80 flex items-center justify-between gap-3 text-[12.5px] text-muted-foreground">
            <span className="tabular-nums">{t("risk.showing", { count: rows.length, total: students.length })}</span>
            {levelFilter && (
              <button onClick={() => setLevelFilter("")} className="font-semibold text-primary hover:underline underline-offset-4">
                {t("risk.clearFilter")}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="th-label">{t("risk.student")}</th>
                  <th className="th-label">{t("risk.officialAlert")}</th>
                  <th className="th-label min-w-[150px]">{t("risk.vigilance")}</th>
                  <th className="th-label min-w-[170px] hidden lg:table-cell">{t("risk.unexcusedThreshold")}</th>
                  <th className="th-label hidden md:table-cell">{t("risk.absences")}</th>
                  <th className="th-label hidden md:table-cell">{t("risk.lateArrivals")}</th>
                  <th className="th-label hidden xl:table-cell">{t("risk.whyFlagged")}</th>
                  <th className="w-10" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const tone = LEVEL_TONE[s.risk_level];
                  const st = scoreTone(s.score);
                  const limitPct = Math.min(100, (s.unexcused_hours / UNEXCUSED_LIMIT) * 100);
                  const student = studentById.get(s.student_id);
                  return (
                    <motion.tr
                      key={s.student_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 12) * 0.025 }}
                      onClick={() => student && setSelected(student)}
                      onKeyDown={(e) => { if (student && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelected(student); } }}
                      tabIndex={student ? 0 : -1}
                      className={`group border-b border-border/50 last:border-b-0 transition-colors ${student ? "cursor-pointer hover:bg-secondary/35 focus-visible:bg-secondary/35" : ""}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold shrink-0 ${tone.pill}`}>
                            {initialsOf(s.student_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.student_name}</p>
                            <p className="text-[12px] text-muted-foreground truncate">
                              {s.group_name}
                              {s.last_absence_date && <> · {t("risk.lastAbsence", { date: shortDate(s.last_absence_date) })}</>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap ${tone.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                          {t(`risk.${s.risk_level}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`font-display font-bold tabular-nums w-7 text-right ${st.text}`}>{s.score}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden max-w-[90px]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.score}%` }}
                              transition={{ duration: 0.7, delay: 0.1 + Math.min(i, 12) * 0.03, ease: EASE }}
                              className={`h-full rounded-full ${st.bar}`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <div className="flex items-baseline justify-between gap-2 text-[12px] max-w-[150px]">
                          <span className="font-semibold tabular-nums text-foreground">{s.unexcused_hours} h</span>
                          <span className="text-muted-foreground tabular-nums">/ {UNEXCUSED_LIMIT} h</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden max-w-[150px]">
                          <div
                            className={`h-full rounded-full ${limitPct >= 100 ? "bg-destructive" : limitPct >= 60 ? "bg-warning" : "bg-foreground/35"}`}
                            style={{ width: `${limitPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="tabular-nums font-medium flex items-center gap-1.5"><CalendarX className="w-3.5 h-3.5 text-muted-foreground" />{s.absence_hours} h</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{t("risk.inLast30", { count: s.recent_absence_count })}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="tabular-nums font-medium flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5 text-muted-foreground" />{s.late_count}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{t("risk.inLast30", { count: s.recent_late_count })}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell max-w-[22rem]">
                        {s.factor_codes.length ? (
                          <div className="flex flex-wrap gap-1">
                            {s.factor_codes.map((f) => (
                              <span key={f.key} className="text-[11.5px] px-1.5 py-0.5 rounded bg-secondary text-foreground/80">{factorText(f)}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">
                            {s.score >= 45 ? t("risk.belowButWatch") : t("risk.noFactors")}
                          </span>
                        )}
                      </td>
                      <td className="pr-4">
                        {student && <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="p-14 text-center">
              <ShieldCheck className="w-9 h-9 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("risk.noMatch")}</p>
            </div>
          )}
          <footer className="px-5 py-3 border-t border-border/70 bg-secondary/30 text-[11.5px] text-muted-foreground">
            {t("risk.vigilanceExplainer")}
          </footer>
        </div>
      )}
    </div>
  );
};

export default RiskDashboardPage;
