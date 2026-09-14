import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, BookOpen, Users, Send, CheckCircle2, Timer, CircleAlert, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import QRSessionCode from "@/components/QRSessionCode";
import { useTranslation } from "react-i18next";
import type { AttendanceStatus } from "@/types/api";

const attendanceOptionsBase: { value: AttendanceStatus; className: string; icon: typeof CheckCircle2 }[] = [
  { value: "present", className: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10", icon: CheckCircle2 },
  { value: "late", className: "border-amber-500/30 text-amber-400 bg-amber-500/10", icon: Timer },
  { value: "absent", className: "border-destructive/30 text-destructive bg-destructive/10", icon: CircleAlert },
  { value: "excused", className: "border-primary/30 text-primary bg-primary/10", icon: BadgeCheck },
];

const MarkAbsencePage = () => {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("10:30");
  const [moduleId, setModuleId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<number, number>>({});
    const { toast } = useToast();
  const { showSuccess, NotificationComponent } = useSuccessNotification();
  const { t } = useTranslation();

  const attendanceOptions = useMemo(
    () =>
      attendanceOptionsBase.map((opt) => ({
        ...opt,
        label: t(`mark.${opt.value}` as const),
      })),
    [t]
  );

  const { data: groupsRes, isLoading: loadingGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const groups = (groupsRes?.data ?? []).filter((group) => (group.status ?? "active") === "active");

  const { data: modulesRes, isLoading: loadingModules } = useQuery({
    queryKey: ["modules"],
    queryFn: () => api.getModules(),
  });
  const modules = modulesRes?.data ?? [];

  // Pre-select the first group once groups have loaded so the page isn't empty
  useEffect(() => {
    if (selectedGroup == null && groups.length > 0) {
      setSelectedGroup(groups[0].id);
    }
  }, [groups, selectedGroup]);

  useEffect(() => {
    if (moduleId == null && modules.length > 0) setModuleId(modules[0].id);
  }, [modules, moduleId]);

  const { data: studentsRes, isLoading: loadingStudents } = useQuery({
    queryKey: ["group-students", selectedGroup],
    queryFn: () => api.getGroupStudents(selectedGroup!),
    enabled: !!selectedGroup,
  });

  const groupStudents = studentsRes?.data ?? [];

  const submitMutation = useMutation({
    mutationFn: () => api.createAbsence({
      attendance_records: groupStudents.map((student) => ({
        student_id: student.id,
        attendance_status: attendance[student.id] ?? "present",
        late_minutes: attendance[student.id] === "late" ? (lateMinutes[student.id] ?? 10) : undefined,
      })),
      group_id: selectedGroup!,
      date,
      start_time: startTime,
      end_time: endTime,
      module_id: moduleId!,
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["absences", "teacher-history"] });
      const group = groups.find((g) => g.id === selectedGroup);
      showSuccess({
        title: "Absences Recorded",
        description: `Attendance saved for ${groupStudents.length} students in ${group?.name}`,
        icon: "send",
        accentColor: "#3b82f6",
      });
      setAttendance({});
      setLateMinutes({});
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setStudentStatus = (id: number, status: AttendanceStatus) => {
    setAttendance((previous) => ({ ...previous, [id]: status }));
    if (status !== "late") {
      setLateMinutes((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    }
  };

  const markAllPresent = () => {
    setAttendance({});
    setLateMinutes({});
  };

  const handleSubmit = () => {
    if (!selectedGroup || !moduleId || groupStudents.length === 0) {
      toast({ title: "Validation Error", description: "Select a group, one of your modules, and a group with students", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  const hours = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  })();
  const statusCounts = groupStudents.reduce<Record<AttendanceStatus, number>>((counts, student) => {
    const status = attendance[student.id] ?? "present";
    counts[status] += 1;
    return counts;
  }, { present: 0, late: 0, absent: 0, excused: 0 });
  const selectedModule = modules.find((module) => module.id === moduleId);

  return (
    <>
    {NotificationComponent}
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-display font-bold">{t("mark.heading", { defaultValue: "Mark Attendance" })}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("mark.subtitle", { defaultValue: "Record present, late, absent, or excused attendance for this session" })}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-1.5">
          <label className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Group</label>
          {loadingGroups ? <Skeleton className="h-10 w-full" /> : (
            <StyledSelect
              value={selectedGroup ? String(selectedGroup) : ""}
              onValueChange={(v) => { setSelectedGroup(v ? Number(v) : null); markAllPresent(); }}
                            placeholder={t("mark.selectGroup")}
              options={groups.map((g) => ({ label: `${g.name} (${g.student_count} students)`, value: String(g.id) }))}
            />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-glass" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-1.5">
          <label className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Time Range</label>
          <div className="flex items-center gap-2">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-glass" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-glass" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Module</label>
          {loadingModules ? <Skeleton className="h-10 w-full" /> : (
            <StyledSelect
              value={moduleId ? String(moduleId) : ""}
              onValueChange={(value) => setModuleId(value ? Number(value) : null)}
              placeholder={modules.length ? "Select a module" : "Create a module first"}
              options={modules.map((module) => ({ label: module.name, value: String(module.id) }))}
            />
          )}
          {!loadingModules && modules.length === 0 && <p className="text-xs text-amber-500">No modules yet. Create one from My Modules before recording attendance.</p>}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-1.5">
        <label className="text-sm text-muted-foreground">Notes (optional)</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="input-glass" />
      </motion.div>

      {/* QR Session Code */}
      {selectedGroup && selectedModule && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <QRSessionCode
            groupName={groups.find((g) => g.id === selectedGroup)?.name ?? ""}
            groupId={selectedGroup}
            date={date}
            startTime={startTime}
            endTime={endTime}
            subject={selectedModule.name}
          />
        </motion.div>
      )}

      {selectedGroup ? (
        loadingStudents ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-display font-semibold text-sm">Student Roster</h3>
                                    <p className="text-xs text-muted-foreground">{statusCounts.present} {t("mark.present")} · {statusCounts.late} {t("mark.late")} · {statusCounts.absent} {t("mark.absent")} · {statusCounts.excused} {t("mark.excused")} · {hours}h {t("mark.session", { defaultValue: "session" })}</p>
                </div>
              </div>
                            <button onClick={markAllPresent} className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
                {t("mark.markAll")}
              </button>
            </div>

            <div className="divide-y divide-border/50">
              {groupStudents.map((s) => {
                const status = attendance[s.id] ?? "present";
                return (
                  <div
                    key={s.id}
                    className={`w-full flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${status === "absent" ? "bg-destructive/5" : "hover:bg-secondary/20"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${status === "absent" ? "text-destructive" : ""}`}>
                        {s.first_name} {s.last_name}
                      </p>
                                            <p className="text-xs text-muted-foreground">{s.cne} · {t("mark.totalAbsent", { hours: s.total_absence_hours, defaultValue: "Total: {{hours}}h absent" })}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {attendanceOptions.map((option) => {
                        const Icon = option.icon;
                        const active = status === option.value;
                        return <button key={option.value} type="button" onClick={() => setStudentStatus(s.id, option.value)} className={`h-8 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1 transition-colors ${active ? option.className : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}><Icon className="w-3.5 h-3.5" />{option.label}</button>;
                      })}
                                          {status === "late" && <Input aria-label={t("mark.lateMinutesAria", { name: `${s.first_name} ${s.last_name}`, defaultValue: "Late minutes for {{name}}" })} type="number" min="1" max="480" value={lateMinutes[s.id] ?? 10} onChange={(e) => setLateMinutes((previous) => ({ ...previous, [s.id]: Number(e.target.value) || 1 }))} className="h-8 w-20 input-glass text-xs" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={groupStudents.length === 0 || !moduleId || submitMutation.isPending}
                className="btn-glow text-primary-foreground border-0 gap-2"
              >
                                {submitMutation.isPending ? (
                  t("mark.submitting")
                ) : (
                  <>
                    <Send className="w-4 h-4" /> {t("mark.save")}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <h3 className="font-display font-semibold mb-1">{t("mark.selectGroup")}</h3>
          <p className="text-sm text-muted-foreground">{t("mark.selectGroupHint")}</p>
        </motion.div>
      )}
    </div>
    </>
  );
};

export default MarkAbsencePage;
