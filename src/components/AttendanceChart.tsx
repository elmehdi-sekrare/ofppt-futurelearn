import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getDateLocale } from "@/i18n/i18n";

type ChartPoint = { day: string; date: string; attendance: number; absences: number; count: number };

const AttendanceChart = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  const { data: chartRes, isLoading } = useQuery({
    queryKey: ["dashboard", "chart"],
    queryFn: () => api.getDashboardChart(),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  // The API sends English day abbreviations; re-derive them from the date so
  // the axis follows the selected language.
  const data: ChartPoint[] = (chartRes?.data ?? []).map((point) => ({
    ...point,
    day: new Date(point.date).toLocaleDateString(locale, { weekday: "short" }),
  }));

  if (isLoading) {
    return <Skeleton className="w-full h-[260px] rounded-lg" />;
  }

  const hasAbsences = data.some((d) => d.absences > 0);

  if (!hasAbsences) {
    return (
      <div className="w-full h-[260px] flex flex-col items-center justify-center text-center gap-2.5 px-6">
        <CheckCircle2 className="w-9 h-9 text-success" strokeWidth={1.6} />
        <p className="font-display font-semibold">{t("dashboard.chartEmpty")}</p>
        <p className="text-sm text-muted-foreground max-w-[38ch]">{t("dashboard.chartEmptyHint")}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          {/* Brand blue, so the chart belongs to the same palette as the page */}
          <linearGradient id="absenceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
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
        <Tooltip
          cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            fontSize: "12px",
            color: "hsl(var(--popover-foreground))",
            boxShadow: "var(--shadow-raised)",
          }}
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as ChartPoint | undefined;
            return p ? new Date(p.date).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" }) : "";
          }}
          formatter={(value: number, name: string) => {
            if (name === "absences") return [`${value}h`, t("dashboard.legendAbsence")];
            if (name === "count") return [value, t("absences.title")];
            return [value, name];
          }}
        />
        <Area
          type="monotone"
          dataKey="absences"
          stroke="hsl(var(--primary))"
          fill="url(#absenceGrad)"
          strokeWidth={2.5}
          name="absences"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default AttendanceChart;
