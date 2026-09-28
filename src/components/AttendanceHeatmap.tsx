import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CalendarRange } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getDateLocale } from "@/i18n/i18n";
import type { HeatmapCell } from "@/types/api";

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const AttendanceHeatmap = () => {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "heatmap"],
    queryFn: () => api.getDashboardHeatmap(),
    staleTime: 60_000,
  });

  const heat = data?.data;
  const weeks = heat?.weeks ?? [];
  const peak = heat?.peak_hours ?? 0;

  // Intensity is relative to the busiest day in view, so the grid stays
  // readable whether the peak is 2 hours or 200.
  const intensity = (hours: number) => {
    if (hours <= 0 || peak <= 0) return 0;
    const ratio = hours / peak;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const STEP = [
    "bg-secondary",
    "bg-primary/25",
    "bg-primary/45",
    "bg-primary/70",
    "bg-primary",
  ];

  const total = useMemo(
    () => weeks.reduce((sum, w) => sum + w.days.reduce((a, c) => a + c.hours, 0), 0),
    [weeks]
  );

  const dayLabels = DAY_KEYS.map((k) => t(`weekdays.${k}`));
  const locale = getDateLocale(i18n.language);

  if (isLoading) return <Skeleton className="w-full h-[190px] rounded-lg" />;

  if (!weeks.length || total === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-xl bg-secondary/50">
        <CalendarRange className="w-7 h-7 mx-auto mb-2.5 text-muted-foreground/50" />
        <p className="text-sm font-medium">{t("heatmap.empty")}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[30ch] mx-auto">{t("heatmap.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5 pl-9">
        {dayLabels.map((label) => (
          <div key={label} className="flex-1 text-[10px] text-muted-foreground text-center" title={label}>
            {label.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week.week_start} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-7 shrink-0 tabular-nums">{week.week}</span>
          {week.days.map((cell) => {
            const step = intensity(cell.hours);
            const label = new Date(cell.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
            return (
              <motion.div
                key={cell.date}
                whileHover={{ scale: 1.16 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                onMouseEnter={() => setHovered(cell)}
                onMouseLeave={() => setHovered(null)}
                role="img"
                aria-label={cell.hours > 0 ? t("heatmap.hoursOn", { hours: cell.hours, day: label }) : `${label} — ${t("heatmap.none")}`}
                className={`flex-1 aspect-square rounded-md flex items-center justify-center cursor-default
                  ${cell.future ? "bg-secondary/40 opacity-40" : STEP[step]}`}
              >
                {cell.hours > 0 && (
                  <span className={`text-[9px] font-semibold tabular-nums ${step >= 3 ? "text-primary-foreground" : "text-foreground"}`}>
                    {cell.hours}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      ))}

      {/* Reserved line so hovering does not shift the layout */}
      <div className="h-8 flex items-end justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted-foreground leading-tight min-h-[1.5rem]">
          {hovered
            ? hovered.hours > 0
              ? t("heatmap.cellDetail", {
                  date: new Date(hovered.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
                  hours: hovered.hours,
                  count: hovered.count,
                })
              : new Date(hovered.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
            : t("heatmap.totalInRange", { hours: Math.round(total * 10) / 10 })}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground">{t("heatmap.less")}</span>
          {STEP.map((cls, i) => <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />)}
          <span className="text-[10px] text-muted-foreground">{t("heatmap.more")}</span>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHeatmap;
