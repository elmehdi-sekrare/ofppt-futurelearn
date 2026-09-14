import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

type ChartPoint = { day: string; date: string; attendance: number; absences: number; count: number };

const AttendanceChart = () => {
  const { data: chartRes, isLoading } = useQuery({
    queryKey: ["dashboard", "chart"],
    queryFn: () => api.getDashboardChart(),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const data: ChartPoint[] = chartRes?.data ?? [];

  if (isLoading) {
    return <Skeleton className="w-full h-[260px] rounded-lg" />;
  }

  const hasAbsences = data.some((d) => d.absences > 0);

  if (!hasAbsences) {
    return (
      <div className="w-full h-[260px] flex flex-col items-center justify-center text-center gap-2">
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
          <span className="text-2xl">✓</span>
        </div>
        <p className="font-display font-semibold text-foreground">No absences this month</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Attendance has been perfect over the last 30 days. Absences will appear here as they're recorded.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="absenceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(340, 82%, 60%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(340, 82%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" vertical={false} />
        <XAxis
          dataKey="day"
          stroke="hsl(215, 20%, 55%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          stroke="hsl(215, 20%, 55%)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          unit="h"
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(222, 44%, 10%)",
            border: "1px solid hsl(222, 30%, 18%)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelFormatter={(_, payload) => {
            const p = payload?.[0]?.payload as ChartPoint | undefined;
            return p ? new Date(p.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
          }}
          formatter={(value: number, name: string) => {
            if (name === "absences") return [`${value}h`, "Absence hours"];
            if (name === "count") return [value, "Absences"];
            return [value, name];
          }}
        />
        <Area
          type="monotone"
          dataKey="absences"
          stroke="hsl(340, 82%, 60%)"
          fill="url(#absenceGrad)"
          strokeWidth={2.5}
          name="absences"
          dot={false}
          activeDot={{ r: 5, fill: "hsl(340, 82%, 60%)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default AttendanceChart;
