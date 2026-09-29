import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Minus } from "lucide-react";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getDateLocale } from "@/i18n/i18n";

type Point = { date: string; absences: number; count: number };

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Admin trend panel: daily absence hours as an area curve, a period total with a
 * comparison against the previous period, and a rail of derived figures.
 * The chart grows to fill whatever height its grid row gives it.
 */
const AbsenceTrendPanel = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const [range, setRange] = useState<Range>(30);

  const { data: chartRes, isLoading } = useQuery({
    queryKey: ["dashboard", "chart"],
    queryFn: () => api.getDashboardChart(),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const all: Point[] = chartRes?.data ?? [];

  const view = useMemo(() => {
    const current = all.slice(-range);
    const previous = all.length >= range * 2 ? all.slice(-range * 2, -range) : null;
    const total = round1(current.reduce((s, p) => s + p.absences, 0));
    const prevTotal = previous ? round1(previous.reduce((s, p) => s + p.absences, 0)) : null;
    const records = current.reduce((s, p) => s + p.count, 0);
    const activeDays = current.filter((p) => p.absences > 0).length;
    const peakIndex = current.reduce((best, p, i) => (p.absences > (current[best]?.absences ?? 0) ? i : best), 0);
    const peak = current[peakIndex];
    const avg = activeDays ? round1(total / activeDays) : 0;
    const delta = prevTotal === null ? null : prevTotal === 0 ? (total > 0 ? null : 0) : Math.round(((total - prevTotal) / prevTotal) * 100);
    return { current, total, prevTotal, records, activeDays, peak, avg, delta };
  }, [all, range]);

  const axisLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, range === 7 ? { weekday: "short" } : { day: "numeric", month: "short" });
  const longLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const hasAbsences = view.total > 0;
  const rising = (view.delta ?? 0) > 0;

  const rail = [
    { label: t("trend.records"), value: String(view.records), unit: "" },
    { label: t("trend.activeDays"), value: String(view.activeDays), unit: `/ ${range}` },
    { label: t("trend.avgPerDay"), value: String(view.avg), unit: "h" },
    {
      label: t("trend.peak"),
      value: hasAbsences ? String(view.peak?.absences ?? 0) : "—",
      unit: hasAbsences ? "h" : "",
      note: hasAbsences && view.peak ? axisLabel(view.peak.date) : undefined,
    },
  ];

  return (
    <article className="glass-panel xl:col-span-2 flex flex-col overflow-hidden">
      <header className="px-6 pt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-xl">{t("dashboard.chartTitle")}</h2>
          <p className="text-[13px] text-muted-foreground mt-1">{t("trend.subtitle", { count: range })}</p>
        </div>

        <div role="radiogroup" aria-label={t("trend.period")} className="relative flex p-1 rounded-lg bg-secondary/80 border border-border/70">
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <button
                key={r}
                role="radio"
                aria-checked={active}
                onClick={() => setRange(r)}
                className={`relative z-10 px-3 py-1 text-[13px] font-semibold tabular-nums rounded-md transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="trend-range"
                    className="absolute inset-0 -z-10 rounded-md bg-card shadow-[var(--shadow-card)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {t("trend.days", { count: r })}
              </button>
            );
          })}
        </div>
      </header>

      {/* Headline figure */}
      <div className="px-6 mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
        {isLoading ? (
          <Skeleton className="h-12 w-40 rounded-lg" />
        ) : (
          <>
            <p className="font-display font-extrabold text-[2.75rem] leading-none tracking-[-0.04em] tabular-nums">
              {view.total}
              <span className="text-xl font-bold text-muted-foreground ml-1 tracking-normal">h</span>
            </p>
            <div className="pb-1.5 flex items-center gap-2.5 text-[13px]">
              {view.delta !== null ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold tabular-nums ${
                    view.delta === 0 ? "bg-secondary text-muted-foreground"
                    : rising ? "bg-destructive/[0.09] text-destructive" : "bg-success/[0.1] text-success"
                  }`}
                >
                  {view.delta === 0 ? <Minus className="w-3.5 h-3.5" /> : rising ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {view.delta > 0 ? "+" : ""}{view.delta} %
                </span>
              ) : null}
              <span className="text-muted-foreground">
                {view.prevTotal !== null
                  ? t("trend.vsPrevious", { hours: view.prevTotal, count: range })
                  : t("trend.inPeriod", { count: range })}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Chart grows into the row height so the panel never has a dead zone */}
      <div className="relative flex-1 min-h-[240px] mt-4 px-3">
        {isLoading ? (
          <Skeleton className="absolute inset-x-6 inset-y-2 rounded-lg" />
        ) : !hasAbsences ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2.5 px-6">
            <CheckCircle2 className="w-9 h-9 text-success" strokeWidth={1.6} />
            <p className="font-display font-semibold">{t("trend.empty", { count: range })}</p>
            <p className="text-sm text-muted-foreground max-w-[38ch]">{t("dashboard.chartEmptyHint")}</p>
          </div>
        ) : (
          <div className="absolute inset-0 px-3 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.current} margin={{ top: 18, right: 12, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id="absenceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={axisLabel}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={range === 30 ? 28 : 12}
                  tickMargin={6}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit="h"
                  allowDecimals={false}
                  width={40}
                />
                {view.avg > 0 && (
                  <ReferenceLine
                    y={view.total / range}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{
                      value: t("trend.dailyMean", { hours: round1(view.total / range) }),
                      position: "insideTopRight",
                      fontSize: 10.5,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                )}
                <Tooltip
                  cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Point | undefined;
                    if (!active || !p) return null;
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2.5 shadow-[var(--shadow-raised)] min-w-[150px]">
                        <p className="text-[11px] text-muted-foreground first-letter:uppercase">{longLabel(p.date)}</p>
                        <p className="mt-1 font-display font-bold text-lg leading-none tabular-nums">
                          {p.absences}<span className="text-sm text-muted-foreground font-semibold ml-0.5">h</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{t("trend.recordsCount", { count: p.count })}</p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="absences"
                  stroke="hsl(var(--primary))"
                  fill="url(#absenceGrad)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Derived figures */}
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 border-t border-border/80 bg-secondary/35">
        {rail.map((item, i) => (
          <div
            key={item.label}
            className={`px-6 py-4 ${i % 2 === 1 ? "border-l border-border/80" : ""} ${i >= 2 ? "border-t sm:border-t-0 border-border/80" : ""} ${i === 2 ? "sm:border-l" : ""}`}
          >
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</dt>
            <dd className="mt-1.5 flex items-baseline gap-1.5">
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <>
                  <span className="font-display font-bold text-[1.35rem] leading-none tabular-nums">{item.value}</span>
                  {item.unit && <span className="text-[13px] text-muted-foreground font-medium tabular-nums">{item.unit}</span>}
                  {item.note && <span className="text-[12px] text-muted-foreground truncate">· {item.note}</span>}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
};

export default AbsenceTrendPanel;
