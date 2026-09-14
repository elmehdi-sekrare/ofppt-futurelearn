import { motion } from "framer-motion";
import { BookOpen, ClipboardList, Users, Briefcase, ArrowRight, History, CalendarDays, Clock } from "lucide-react";
import StatCard from "@/components/StatCard";
import AttendanceChart from "@/components/AttendanceChart";
import RecentAbsences from "@/components/RecentAbsences";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/i18n/i18n";

const getGreetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return "teacher.greetingMorning";
  if (h < 18) return "teacher.greetingAfternoon";
  return "teacher.greetingEvening";
};

const TeacherDashboard = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const greeting = t(getGreetingKey());
  const navigate = useNavigate();

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["dashboard", "teacher", user?.id],
    queryFn: () => api.getDashboardStats("teacher"),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const stats = statsRes?.data;
  const today = new Date().toLocaleDateString(getDateLocale(i18n.language), { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      {/* Hero header with ambient gradient */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-blue-500/5 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                                <Briefcase className="w-3.5 h-3.5" /> {t("auth.teacher")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" /> {today}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-balance">
              {greeting}, Prof. {user?.last_name ?? t("auth.teacher")} <span className="inline-block">&#x1F44B;</span>
            </h1>
                        <p className="text-muted-foreground text-sm mt-1.5">{t("teacher.overview")}</p>
          </div>
          <button
            onClick={() => navigate("/teacher/mark")}
            className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl btn-glow text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 transition-transform active:scale-[0.98] shrink-0"
          >
                        <ClipboardList className="w-4 h-4" />
            {t("teacher.markAttendance")}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="My Groups" value={stats?.my_groups ?? 0} icon={<BookOpen className="w-5 h-5" />} delay={0} />
            <StatCard title="Students" value={stats?.my_students ?? 0} icon={<Users className="w-5 h-5" />} delay={0.1} />
            <StatCard title="Today's Absences" value={stats?.today_absences ?? 0} icon={<ClipboardList className="w-5 h-5" />} delay={0.2} />
            <StatCard title="Today's Late" value={stats?.today_late ?? 0} icon={<Clock className="w-5 h-5" />} delay={0.3} />
          </>
        )}
      </div>

      {/* Chart + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 glass-panel p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
                            <h3 className="font-display font-semibold">{t("teacher.absenceTrend")}</h3>
              <p className="text-xs text-muted-foreground">{t("teacher.chartSubtitle")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(340,82%,60%)]" />
              {t("teacher.absenceHours")}
            </span>
          </div>
          <AttendanceChart />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-5 flex flex-col"
        >
                    <h3 className="font-display font-semibold mb-1">{t("teacher.quickActions")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("teacher.quickSubtitle")}</p>
          <div className="space-y-2.5">
            <button
              onClick={() => navigate("/teacher/mark")}
              className="group w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-white/[0.04] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <ClipboardList className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium">{t("teacher.qaMark")}</span>
                <span className="block text-xs text-muted-foreground">{t("teacher.qaMarkDesc")}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => navigate("/teacher/history")}
              className="group w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 border border-white/[0.04] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <History className="w-[18px] h-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium">{t("teacher.qaHistory")}</span>
                <span className="block text-xs text-muted-foreground">{t("teacher.qaHistoryDesc")}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Recent absences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-panel p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
                        <h3 className="font-display font-semibold">{t("teacher.recentTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("teacher.recentSubtitle")}</p>
          </div>
          <button
            onClick={() => navigate("/teacher/history")}
            className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
                        {t("app.viewAll")} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <RecentAbsences />
      </motion.div>
    </div>
  );
};

export default TeacherDashboard;