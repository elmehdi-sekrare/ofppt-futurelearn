import { motion } from "framer-motion";
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

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const AdminDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const greeting = getGreeting();

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: () => api.getDashboardStats("admin"),
  });

  const stats = statsRes?.data;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">{greeting}, {user?.first_name ?? "Admin"} &#x1F44B;</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening with attendance today</p>
      </motion.div>

      {/* Role badge */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" /> Administrator
        </span>
        <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard title="Total Students" value={stats?.total_students ?? 0} icon={<GraduationCap className="w-5 h-5" />} delay={0} />
            <StatCard title="Total Teachers" value={stats?.total_teachers ?? 0} icon={<Users className="w-5 h-5" />} delay={0.1} />
            <StatCard title="Absence Rate" value={stats?.absence_rate ?? 0} suffix="%" icon={<AlertTriangle className="w-5 h-5" />} delay={0.2} />
            <StatCard title="Pending Reviews" value={stats?.pending_reviews ?? 0} icon={<FileCheck className="w-5 h-5" />} delay={0.3} />
            <StatCard title="High Risk" value={stats?.high_risk_students ?? 0} icon={<ShieldAlert className="w-5 h-5" />} delay={0.4} />
            <StatCard title="Late Arrivals" value={stats?.late_count ?? 0} icon={<Clock className="w-5 h-5" />} delay={0.5} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Absence Trend</h3>
              <p className="text-xs text-muted-foreground">Absence hours · last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(340,82%,60%)]" />
              Absence hours
            </div>
          </div>
          <AttendanceChart />
        </div>
        <div className="space-y-4">
          <div className="glass-panel p-5">
            <h3 className="font-display font-semibold mb-1">Weekly Heatmap</h3>
            <p className="text-xs text-muted-foreground mb-4">Absence intensity by day</p>
            <AttendanceHeatmap />
          </div>
          {/* System info card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-panel p-5">
            <h3 className="font-display font-semibold mb-3 text-sm">System Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Platform</span><span className="font-medium">OFPPT Smart Attendance</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Academic Year</span><span className="font-medium">2025 - 2026</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Semester</span><span className="font-medium">S2</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Server</span><span className="font-medium text-green-400">Online</span></div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* AI Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIRiskPredictor />
        <SmartPatternDetector />
      </div>

      {/* Recent absences + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Recent Absences</h3>
              <p className="text-xs text-muted-foreground">Latest absence records</p>
            </div>
            <div className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground">
              <Clock className="w-3 h-3" /> Today
            </div>
          </div>
          <RecentAbsences />
        </div>
        <LiveActivityFeed />
      </div>
    </div>
  );
};

export default AdminDashboard;
