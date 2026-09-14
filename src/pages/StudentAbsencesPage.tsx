import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Filter, BookOpen, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { StyledSelect } from "@/components/ui/styled-select";

const statusConfig = {
  pending: { icon: Clock, label: "Pending", className: "bg-warning/10 text-warning" },
  justified: { icon: CheckCircle, label: "Justified", className: "bg-success/10 text-success" },
  unjustified: { icon: XCircle, label: "Unjustified", className: "bg-destructive/10 text-destructive" },
  voided: { icon: XCircle, label: "Removed", className: "bg-muted text-muted-foreground" },
};

const StudentAbsencesPage = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const { data: absencesRes, isLoading } = useQuery({
    queryKey: ["absences", "student"],
    queryFn: () => api.getAbsences(),
  });

  const absences = (absencesRes?.data ?? []).filter((absence) => absence.status !== "voided");

  const filtered = useMemo(() => {
    return absences.filter((a) => {
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchMonth = !monthFilter || a.date.startsWith(monthFilter);
      return matchStatus && matchMonth;
    });
  }, [absences, statusFilter, monthFilter]);

  const totalHours = absences.reduce((sum, a) => sum + a.hours, 0);
  const justifiedHours = absences.filter((a) => a.status === "justified").reduce((sum, a) => sum + a.hours, 0);
  const unjustifiedHours = absences.filter((a) => a.status === "unjustified").reduce((sum, a) => sum + a.hours, 0);
  const pendingHours = absences.filter((a) => a.status === "pending").reduce((sum, a) => sum + a.hours, 0);

  const totalPossibleHours = 300;
  const attendanceRate = totalPossibleHours > 0 ? Math.max(0, ((totalPossibleHours - totalHours) / totalPossibleHours) * 100) : 100;

  const months = [...new Set(absences.map((a) => a.date.substring(0, 7)))].sort().reverse();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">Absence History</h1>
        <p className="text-muted-foreground text-sm mt-1">View and track all your absences</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 lg:col-span-1 glass-panel p-5 flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(222, 30%, 18%)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={attendanceRate >= 80 ? "hsl(160, 70%, 45%)" : attendanceRate >= 60 ? "hsl(38, 92%, 55%)" : "hsl(0, 72%, 55%)"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${attendanceRate * 2.136} 213.6`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-display font-bold">{attendanceRate.toFixed(0)}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Attendance</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-4">
          <Clock className="w-5 h-5 text-primary mb-2" />
          <p className="text-xl font-display font-bold">{totalHours}h</p>
          <p className="text-xs text-muted-foreground">Total Absent</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-4">
          <CheckCircle className="w-5 h-5 text-success mb-2" />
          <p className="text-xl font-display font-bold text-success">{justifiedHours}h</p>
          <p className="text-xs text-muted-foreground">Justified</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-4">
          <XCircle className="w-5 h-5 text-destructive mb-2" />
          <p className="text-xl font-display font-bold text-destructive">{unjustifiedHours}h</p>
          <p className="text-xs text-muted-foreground">Unjustified</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-4">
          <AlertTriangle className="w-5 h-5 text-warning mb-2" />
          <p className="text-xl font-display font-bold text-warning">{pendingHours}h</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Absence Breakdown</p>
          <p className="text-xs text-muted-foreground">{totalHours}h total</p>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
          {justifiedHours > 0 && totalHours > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${(justifiedHours / totalHours) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 }} className="bg-success h-full" />
          )}
          {pendingHours > 0 && totalHours > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${(pendingHours / totalHours) * 100}%` }} transition={{ duration: 0.8, delay: 0.5 }} className="bg-warning h-full" />
          )}
          {unjustifiedHours > 0 && totalHours > 0 && (
            <motion.div initial={{ width: 0 }} animate={{ width: `${(unjustifiedHours / totalHours) * 100}%` }} transition={{ duration: 0.8, delay: 0.7 }} className="bg-destructive h-full" />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-full bg-success" /> Justified</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-full bg-warning" /> Pending</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-full bg-destructive" /> Unjustified</span>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <StyledSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          icon={<Filter className="w-4 h-4" />}
          className="min-w-[140px]"
          options={[
            { label: "All Status", value: "" },
            { label: "Pending", value: "pending" },
            { label: "Justified", value: "justified" },
            { label: "Unjustified", value: "unjustified" },
          ]}
        />
        <StyledSelect
          value={monthFilter}
          onValueChange={setMonthFilter}
          icon={<Calendar className="w-4 h-4" />}
          className="min-w-[160px]"
          options={[
            { label: "All Months", value: "" },
            ...months.map((m) => ({
              label: new Date(m + "-01").toLocaleDateString("en", { year: "numeric", month: "long" }),
              value: m,
            })),
          ]}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((a, i) => {
          const StatusIcon = statusConfig[a.status].icon;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`glass-panel-hover p-4 flex items-start gap-4 ${a.status === "justified" ? "opacity-70" : ""}`}>
              <div className="flex flex-col items-center pt-1 shrink-0">
                <div className={`w-3 h-3 rounded-full ${a.status === "justified" ? "bg-success" : a.status === "unjustified" ? "bg-destructive" : "bg-warning"}`} />
                {i < filtered.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-medium text-sm">{a.subject}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig[a.status].className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig[a.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{a.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.start_time} — {a.end_time}</span>
                  <span>{a.hours}h</span>
                  <span>·</span>
                  <span>{a.teacher_name}</span>
                </div>
                {a.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">"{a.notes}"</p>}
                {a.status === "justified" && (
                  <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Excused — this absence no longer counts against you.
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="text-lg font-display font-bold">{a.hours}h</span>
              </div>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-display font-semibold">No absences found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAbsencesPage;
