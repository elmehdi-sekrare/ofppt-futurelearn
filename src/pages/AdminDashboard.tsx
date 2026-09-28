import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, GraduationCap, Clock, FileCheck, AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import StatCard from "@/components/StatCard";
import AttendanceChart from "@/components/AttendanceChart";
import RecentAbsences from "@/components/RecentAbsences";
import AttendanceHeatmap from "@/components/AttendanceHeatmap";
import AIRiskPredictor from "@/components/AIRiskPredictor";
import LiveActivityFeed from "@/components/LiveActivityFeed";
import SmartPatternDetector from "@/components/SmartPatternDetector";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { getDateLocale } from "@/i18n/i18n";

const greetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return "dashboard.morning";
  if (h < 18) return "dashboard.afternoon";
  return "dashboard.evening";
};

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const greeting = t(greetingKey());

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => api.getDashboardStats("admin"),
  });

  const stats = statsRes?.data;

  const today = new Date().toLocaleDateString(getDateLocale(i18n.language), {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Masthead: title left, date and role right — asymmetric, not centred */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="eyebrow">{t("dashboard.roleAdmin")}</p>
          <h1 className="page-title mt-2.5">
            {greeting}, {user?.first_name ?? t("dashboard.roleAdmin")}
          </h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4 max-w-[54ch]">{t("dashboard.adminSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/[0.09] text-primary text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" /> {t("dashboard.roleAdmin")}
          </span>
          <span className="text-[13px] text-muted-foreground first-letter:uppercase">{today}</span>
        </div>
      </motion.header>

      {/* Key figures */}
      <section aria-label={t("dashboard.keyFigures")} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-xl" />)
        ) : (
          <>
            <StatCard title={t("dashboard.statStudents")} value={stats?.total_students ?? 0} icon={<GraduationCap className="w-5 h-5" />} delay={0} />
            <StatCard title={t("dashboard.statTeachers")} value={stats?.total_teachers ?? 0} icon={<Users className="w-5 h-5" />} delay={0.05} />
            <StatCard title={t("dashboard.statAbsenceRate")} value={stats?.absence_rate ?? 0} suffix="%" icon={<AlertTriangle className="w-5 h-5" />} delay={0.1} />
            <StatCard title={t("dashboard.statPending")} value={stats?.pending_reviews ?? 0} icon={<FileCheck className="w-5 h-5" />} delay={0.15} />
            <StatCard title={t("dashboard.statHighRisk")} value={stats?.high_risk_students ?? 0} icon={<ShieldAlert className="w-5 h-5" />} delay={0.2} />
            <StatCard title={t("dashboard.statLate")} value={stats?.late_count ?? 0} icon={<Clock className="w-5 h-5" />} delay={0.25} />
          </>
        )}
      </section>

      {/* Trend takes the width it needs; heatmap and system info stack beside it */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <article className="xl:col-span-2 glass-panel p-6">
          <header className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display font-semibold text-xl">{t("dashboard.chartTitle")}</h2>
              <p className="text-[13px] text-muted-foreground mt-1">{t("dashboard.chartSubtitle")}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {t("dashboard.legendAbsence")}
            </div>
          </header>
          <AttendanceChart />
        </article>

        <div className="space-y-5">
          <article className="glass-panel p-6">
            <header className="mb-5">
              <h2 className="font-display font-semibold text-xl">{t("dashboard.heatmapTitle")}</h2>
              <p className="text-[13px] text-muted-foreground mt-1">{t("dashboard.heatmapSubtitle")}</p>
            </header>
            <AttendanceHeatmap />
          </article>

          <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-6"
          >
            <h2 className="eyebrow mb-4">{t("dashboard.sysInfo")}</h2>
            <dl className="space-y-2.5 text-sm">
              {[
                { term: t("dashboard.platform"), value: t("app.shortName") },
                { term: t("dashboard.academicYear"), value: "2025 – 2026" },
                { term: t("dashboard.semester"), value: "S2" },
              ].map((row) => (
                <div key={row.term} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{row.term}</dt>
                  <dd className="font-medium text-right">{row.value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 items-center">
                <dt className="text-muted-foreground">{t("dashboard.server")}</dt>
                <dd className="font-medium text-success inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  {t("dashboard.online")}
                </dd>
              </div>
            </dl>
          </motion.article>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AIRiskPredictor />
        <SmartPatternDetector />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <article className="xl:col-span-2 glass-panel p-6">
          <header className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display font-semibold text-xl">{t("dashboard.recentAbsences")}</h2>
              <p className="text-[13px] text-muted-foreground mt-1">{t("dashboard.recentSubtitle")}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground shrink-0">
              <Clock className="w-3 h-3" /> {t("dashboard.today")}
            </span>
          </header>
          <RecentAbsences />
        </article>
        <LiveActivityFeed />
      </section>
    </div>
  );
};

export default AdminDashboard;
