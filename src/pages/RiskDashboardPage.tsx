import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock3, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { StyledSelect } from "@/components/ui/styled-select";

const riskStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-primary/10 text-primary border-primary/20",
  none: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const RiskDashboardPage = () => {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard", "risk"], queryFn: api.getRiskStudents });
  const students = data?.data ?? [];

  const filtered = useMemo(() => students.filter((student) => {
    const matchesSearch = `${student.student_name} ${student.group_name}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!riskFilter || student.risk_level === riskFilter);
  }), [students, search, riskFilter]);

  const counts = useMemo(() => ({
    high: students.filter((student) => student.risk_level === "high").length,
    medium: students.filter((student) => student.risk_level === "medium").length,
    low: students.filter((student) => student.risk_level === "low").length,
  }), [students]);

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-56" /><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></div>;

  return <div className="space-y-6">
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-display font-bold">Student Risk Dashboard</h1>
      <p className="text-muted-foreground text-sm mt-1">Early warnings based on absences, late arrivals, and pending justifications.</p>
    </motion.div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { label: "High risk", value: counts.high, icon: ShieldAlert, color: "text-destructive" },
        { label: "Medium risk", value: counts.medium, icon: AlertTriangle, color: "text-warning" },
        { label: "Needs monitoring", value: counts.low, icon: UserRoundCheck, color: "text-primary" },
      ].map((item) => {
        const Icon = item.icon;
        return <div key={item.label} className="glass-panel p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center ${item.color}`}><Icon className="w-5 h-5" /></div><div><p className={`text-2xl font-display font-bold ${item.color}`}>{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></div>;
      })}
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or group..." className="input-glass flex-1" />
      <StyledSelect value={riskFilter} onValueChange={setRiskFilter} className="min-w-[160px]" options={[{ label: "All risk levels", value: "" }, { label: "High risk", value: "high" }, { label: "Medium risk", value: "medium" }, { label: "Low risk", value: "low" }, { label: "No risk", value: "none" }]} />
    </div>

    {isError ? <div className="glass-panel p-8 text-center text-destructive">Could not load risk data.</div> : <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/30"><th className="text-left p-4 font-medium text-muted-foreground">Student</th><th className="text-left p-4 font-medium text-muted-foreground">Risk</th><th className="text-left p-4 font-medium text-muted-foreground">Absences</th><th className="text-left p-4 font-medium text-muted-foreground">Late arrivals</th><th className="text-left p-4 font-medium text-muted-foreground">Why flagged</th></tr></thead>
        <tbody>{filtered.map((student) => <tr key={student.student_id} className="border-b border-border/50 hover:bg-secondary/20"><td className="p-4"><p className="font-medium">{student.student_name}</p><p className="text-xs text-muted-foreground">{student.group_name}</p></td><td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${riskStyles[student.risk_level]}`}>{student.risk_level}</span></td><td className="p-4"><p>{student.absence_hours}h</p><p className="text-xs text-muted-foreground">{student.recent_absence_count} in 30 days</p></td><td className="p-4"><div className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5 text-warning" />{student.late_count}</div><p className="text-xs text-muted-foreground">{student.recent_late_count} in 30 days</p></td><td className="p-4 text-xs text-muted-foreground">{student.factors.length ? student.factors.join(" · ") : "No current risk factors"}</td></tr>)}</tbody>
      </table></div>
      {!filtered.length && <div className="p-12 text-center text-muted-foreground">No students match these filters.</div>}
    </div>}
  </div>;
};

export default RiskDashboardPage;
