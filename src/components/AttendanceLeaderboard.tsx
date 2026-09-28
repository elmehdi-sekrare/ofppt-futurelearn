import { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Flame, Star, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";

interface RankedStudent {
  id: number;
  name: string;
  group: string;
  absenceHours: number;
  attendancePct: number;
  streak: number; // computed "virtual streak"
  badge: "gold" | "silver" | "bronze" | null;
}

const MAX_HOURS = 60;

// Calculate a virtual streak from absence data (no additional API needed)
const computeStreak = (absHours: number): number => {
  // Students with fewer absences have longer virtual "good attendance streaks"
  if (absHours === 0) return 30;
  if (absHours <= 2) return 21;
  if (absHours <= 5) return 14;
  if (absHours <= 10) return 7;
  if (absHours <= 20) return 3;
  return 0;
};

const AttendanceLeaderboard = () => {
  const currentUser = useAuthStore((s) => s.user);

  const { data: studentsRes, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => api.getStudents(),
  });

  const { ranked, myRank } = useMemo(() => {
    const students = studentsRes?.data ?? [];
    if (!students.length) return { ranked: [], myRank: null as RankedStudent | null };

    const list: RankedStudent[] = students
      .map((s) => {
        const hours = s.total_absence_hours ?? 0;
        const pct = Math.max(0, Math.round(((MAX_HOURS - hours) / MAX_HOURS) * 100));
        return {
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          group: s.group_name,
          absenceHours: hours,
          attendancePct: pct,
          streak: computeStreak(hours),
          badge: null as "gold" | "silver" | "bronze" | null,
        };
      })
      .sort((a, b) => a.absenceHours - b.absenceHours);

    // Assign badges
    if (list.length > 0) list[0].badge = "gold";
    if (list.length > 1) list[1].badge = "silver";
    if (list.length > 2) list[2].badge = "bronze";

    const me = list.find((s) => s.name === `${currentUser?.first_name} ${currentUser?.last_name}`);

    return { ranked: list.slice(0, 10), myRank: me ?? null };
  }, [studentsRes, currentUser]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-4 h-4 text-warning" />;
    if (index === 1) return <Medal className="w-4 h-4 text-gray-300" />;
    if (index === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">#{index + 1}</span>;
  };

  const getBadgeBg = (badge: string | null) => {
    if (badge === "gold") return "from-yellow-500/10 to-amber-500/5 border-yellow-500/20";
    if (badge === "silver") return "from-gray-300/10 to-slate-400/5 border-gray-300/20";
    if (badge === "bronze") return "from-amber-600/10 to-orange-600/5 border-amber-600/20";
    return "border-border/30";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-panel overflow-hidden"
    >
      {/* Header */}
      <div className="relative p-5 pb-3">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/3 via-transparent to-amber-500/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-sm">Leaderboard</h3>
              <p className="text-xs text-muted-foreground">Top attendance rankings</p>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {studentsRes?.data?.length ?? 0} students
          </span>
        </div>
      </div>

      {/* My Rank Banner */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mx-5 mb-3 rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Your Rank</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{myRank.attendancePct}% attendance</span>
            <span className="text-sm font-bold text-primary">
              #{ranked.findIndex((r) => r.id === myRank.id) + 1 || "—"}
            </span>
          </div>
        </motion.div>
      )}

      {/* Rankings */}
      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No students yet</p>
        ) : (
          <div className="space-y-1.5">
            {ranked.map((student, i) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.06 }}
                className={`flex items-center gap-3 p-2.5 rounded-lg border bg-gradient-to-r transition-colors hover:bg-secondary/40 ${getBadgeBg(student.badge)}`}
              >
                {/* Rank */}
                <div className="w-7 flex items-center justify-center shrink-0">
                  {getRankIcon(i)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {student.name}
                    {student.id === myRank?.id && (
                      <span className="ml-1.5 text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">YOU</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{student.group}</p>
                </div>

                {/* Streak */}
                {student.streak > 0 && (
                  <div className="flex items-center gap-0.5 text-warning">
                    <Flame className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{student.streak}d</span>
                  </div>
                )}

                {/* Attendance bar */}
                <div className="w-20 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${student.attendancePct}%` }}
                      transition={{ duration: 0.8, delay: 0.7 + i * 0.06 }}
                      className={`h-full rounded-full ${
                        student.attendancePct >= 90
                          ? "bg-success"
                          : student.attendancePct >= 70
                          ? "bg-warning"
                          : "bg-destructive"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-medium w-7 text-right">{student.attendancePct}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer stats */}
        {ranked.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-success" />
              Top student: {ranked[0]?.absenceHours ?? 0}h absent
            </div>
            <span>{ranked.filter((r) => r.attendancePct >= 90).length} students above 90%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AttendanceLeaderboard;
