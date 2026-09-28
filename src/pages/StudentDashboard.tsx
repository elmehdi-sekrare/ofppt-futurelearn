import { motion } from "framer-motion";
import { Clock, FileCheck, AlertTriangle, Award, TrendingDown } from "lucide-react";
import StatCard from "@/components/StatCard";
import AttendanceLeaderboard from "@/components/AttendanceLeaderboard";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";

const MAX_ABSENCE_HOURS = 60; // Maximum allowed before disciplinary action

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const StudentDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const greeting = getGreeting();

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: () => api.getDashboardStats("student"),
  });

  const stats = statsRes?.data;
  const attendancePct = stats?.attendance_rate ?? 0;
  const absenceHours = stats?.absence_hours ?? 0;
  const progressPct = Math.min((absenceHours / MAX_ABSENCE_HOURS) * 100, 100);
  const isWarning = progressPct >= 50 && progressPct < 80;
  const isDanger = progressPct >= 80;
  const isPerfect = absenceHours === 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">{greeting}, {user?.first_name ?? "Student"} &#x1F44B;</h1>
        <p className="text-muted-foreground text-sm mt-1">Your attendance summary at a glance</p>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
          <Award className="w-3.5 h-3.5" /> Student
        </span>
        <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </motion.div>

      {/* Danger Zone Alert */}
      {!isLoading && isDanger && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-500/30 bg-destructive/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-sm text-destructive">Danger Zone!</p>
            <p className="text-xs text-muted-foreground">You've reached {progressPct.toFixed(0)}% of the maximum allowed absences ({absenceHours}h / {MAX_ABSENCE_HOURS}h). Contact administration immediately.</p>
          </div>
        </motion.div>
      )}
      {!isLoading && isWarning && !isDanger && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-yellow-500/30 bg-warning/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="font-semibold text-sm text-warning">Warning</p>
            <p className="text-xs text-muted-foreground">You're at {progressPct.toFixed(0)}% of the maximum allowed absences ({absenceHours}h / {MAX_ABSENCE_HOURS}h). Try to improve your attendance.</p>
          </div>
        </motion.div>
      )}
      {!isLoading && isPerfect && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-green-500/30 bg-success/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-semibold text-sm text-success">Perfect Attendance!</p>
            <p className="text-xs text-muted-foreground">You have zero absence hours. Keep up the excellent work!</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Absence Hours" value={stats?.absence_hours ?? 0} icon={<Clock className="w-5 h-5" />} delay={0} />
            <StatCard title="Pending Reviews" value={stats?.pending_justifications ?? 0} icon={<FileCheck className="w-5 h-5" />} delay={0.1} />
            <StatCard title="Unjustified" value={stats?.unjustified_count ?? 0} icon={<AlertTriangle className="w-5 h-5" />} delay={0.2} />
          </>
        )}
      </div>

      {/* Attendance Gauge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-8 text-center"
      >
        <h3 className="font-display font-semibold mb-6">Attendance Rate</h3>
        {isLoading ? (
          <Skeleton className="w-40 h-40 rounded-full mx-auto" />
        ) : (
          <div className="relative w-40 h-40 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${attendancePct * 3.27} 327`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-display font-bold">{attendancePct.toFixed(1)}%</span>
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-4">Keep it above 80% to stay in good standing</p>
      </motion.div>

      {/* Leaderboard */}
      <AttendanceLeaderboard />

      {/* Absence Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel p-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-sm">Absence Limit Tracker</h3>
          <span className={`text-xs font-semibold ${isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-success"}`}>
            {absenceHours}h / {MAX_ABSENCE_HOURS}h
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
            className={`h-full rounded-full ${isDanger ? "bg-destructive" : isWarning ? "bg-warning" : "bg-success"}`}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          <span>0h</span>
          <span className="text-warning">30h</span>
          <span className="text-destructive">48h</span>
          <span>{MAX_ABSENCE_HOURS}h</span>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentDashboard;
