import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Calendar, Clock, BookOpen, Users, Filter, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  justified: "bg-emerald-500/10 text-emerald-400",
  unjustified: "bg-destructive/10 text-destructive",
};

const TeacherHistoryPage = () => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: number; name: string; group: string } | null>(null);
  const [lookupGroupId, setLookupGroupId] = useState<number | null>(null);
  const [lookupStudentId, setLookupStudentId] = useState<number | null>(null);

  const { data: absencesRes, isLoading } = useQuery({
    queryKey: ["absences", "teacher-history"],
    queryFn: () => api.getAbsences(),
  });

  const {
    data: studentHistoryRes,
    isLoading: isStudentHistoryLoading,
    isFetching: isStudentHistoryFetching,
    error: studentHistoryError,
  } = useQuery({
    queryKey: ["absences", "student-history", selectedStudent?.id],
    queryFn: () => {
      const apiWithHistory = api as typeof api & {
        getStudentAbsenceHistory?: (studentId: number) => Promise<{ data: typeof studentHistoryRes extends { data: infer T } ? T : never }>;
      };

      if (apiWithHistory.getStudentAbsenceHistory) {
        return apiWithHistory.getStudentAbsenceHistory(selectedStudent!.id);
      }

      return api.getAbsences({ student_id: selectedStudent!.id, sort: "latest" });
    },
    enabled: !!selectedStudent,
  });

  const myAbsences = absencesRes?.data ?? [];
  const studentHistory = studentHistoryRes?.data ?? [];

  const { data: groupsRes } = useQuery({
    queryKey: ["groups", "teacher-history"],
    queryFn: () => api.getGroups(),
  });

  const { data: groupStudentsRes } = useQuery({
    queryKey: ["group-students", "teacher-history", lookupGroupId],
    queryFn: () => api.getGroupStudents(lookupGroupId!),
    enabled: !!lookupGroupId,
  });

  const teacherGroups = groupsRes?.data ?? [];
  const lookupStudents = groupStudentsRes?.data ?? [];

  const filtered = useMemo(() => {
    return myAbsences.filter((a) => {
      const matchSearch = `${a.student_name} ${a.subject}`.toLowerCase().includes(search.toLowerCase());
      const matchGroup = !groupFilter || a.group_name === groupFilter;
      const matchDate = !dateFilter || a.date === dateFilter;
      return matchSearch && matchGroup && matchDate;
    });
  }, [myAbsences, search, groupFilter, dateFilter]);

  const myGroups = [...new Set(myAbsences.map((a) => a.group_name))];
  const totalHours = filtered.reduce((sum, a) => sum + a.hours, 0);

  const groupedByDate = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const studentHistoryHours = useMemo(
    () => studentHistory.reduce((sum, absence) => sum + absence.hours, 0),
    [studentHistory],
  );

  const studentStatusCounts = useMemo(() => {
    return studentHistory.reduce(
      (acc, absence) => {
        acc[absence.status] += 1;
        return acc;
      },
      { pending: 0, justified: 0, unjustified: 0 },
    );
  }, [studentHistory]);

  const openStudentHistory = (studentId: number, studentName: string, groupName: string) => {
    setSelectedStudent({ id: studentId, name: studentName, group: groupName });
  };

  const openStudentHistoryFromLookup = () => {
    if (!lookupStudentId) return;
    const student = lookupStudents.find((s) => s.id === lookupStudentId);
    if (!student) return;
    openStudentHistory(student.id, `${student.first_name} ${student.last_name}`, student.group_name);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">Attendance History</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} records · {totalHours}h total absences marked</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-display font-bold text-primary">{myGroups.length}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Groups</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-display font-bold">{myAbsences.length}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Users className="w-3.5 h-3.5" /> Records</p>
        </div>
        <div className="glass-panel p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-display font-bold text-warning">{totalHours}h</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5" /> Total Hours</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or subject..." className="pl-10 input-glass" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="pl-10 pr-4 h-10 rounded-md bg-secondary/50 border border-white/[0.08] text-sm text-foreground appearance-none cursor-pointer min-w-[130px]">
            <option value="">All Groups</option>
            {myGroups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input-glass w-auto" />
      </div>

      <div className="glass-panel p-4 space-y-3">
        <p className="text-sm font-medium">Open student history directly</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={lookupGroupId ?? ""}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : null;
              setLookupGroupId(next);
              setLookupStudentId(null);
            }}
            className="h-10 rounded-md bg-secondary/50 border border-white/[0.08] text-sm text-foreground px-3"
          >
            <option value="">Select group</option>
            {teacherGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            value={lookupStudentId ?? ""}
            onChange={(e) => setLookupStudentId(e.target.value ? Number(e.target.value) : null)}
            disabled={!lookupGroupId}
            className="h-10 rounded-md bg-secondary/50 border border-white/[0.08] text-sm text-foreground px-3 disabled:opacity-60"
          >
            <option value="">Select student</option>
            {lookupStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>

          <Button onClick={openStudentHistoryFromLookup} disabled={!lookupStudentId} className="btn-glow border-0">
            View History
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <AnimatePresence>
          {groupedByDate.map(([date, absences], di) => (
            <motion.div key={date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">{new Date(date).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">{absences.length} absence(s) · {absences.reduce((s, a) => s + a.hours, 0)}h</p>
                </div>
              </div>

              <div className="ml-4 border-l-2 border-border/50 pl-6 space-y-3">
                {absences.map((a) => (
                  <div key={a.id} className="glass-panel p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => openStudentHistory(a.student_id, a.student_name, a.group_name)}
                          className="font-medium text-left underline-offset-4 transition-colors hover:text-primary hover:underline"
                        >
                          {a.student_name}
                        </button>
                        <p className="text-xs text-muted-foreground">{a.subject} · {a.group_name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.start_time} - {a.end_time}</span>
                          <span>{a.hours}h</span>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0 ${statusColors[a.status]}`}>{a.status}</span>
                    </div>
                    {a.notes && <p className="text-xs text-muted-foreground mt-2 italic">"{a.notes}"</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {groupedByDate.length === 0 && (
          <div className="glass-panel text-center py-12 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No records found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              {selectedStudent?.name}
            </DialogTitle>
            <DialogDescription>
              Complete absence history for this student, including class and teacher who marked each record.
            </DialogDescription>
            <p className="text-xs text-muted-foreground">Group: {selectedStudent?.group}</p>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-4">
            {(isStudentHistoryLoading || isStudentHistoryFetching) && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
              </div>
            )}

            {!isStudentHistoryLoading && !isStudentHistoryFetching && studentHistoryError && (
              <div className="glass-panel p-6 text-center">
                <p className="font-medium text-destructive">Could not load student history</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {studentHistoryError instanceof Error ? studentHistoryError.message : "Unexpected error"}
                </p>
              </div>
            )}

            {!isStudentHistoryLoading && !isStudentHistoryFetching && !studentHistoryError && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="glass-panel p-3 text-center">
                    <p className="text-xl font-display font-bold">{studentHistory.length}</p>
                    <p className="text-xs text-muted-foreground">Records</p>
                  </div>
                  <div className="glass-panel p-3 text-center">
                    <p className="text-xl font-display font-bold text-warning">{studentHistoryHours}h</p>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                  </div>
                  <div className="glass-panel p-3 text-center">
                    <p className="text-xl font-display font-bold text-emerald-400">{studentStatusCounts.justified}</p>
                    <p className="text-xs text-muted-foreground">Justified</p>
                  </div>
                  <div className="glass-panel p-3 text-center">
                    <p className="text-xl font-display font-bold text-destructive">{studentStatusCounts.unjustified}</p>
                    <p className="text-xs text-muted-foreground">Unjustified</p>
                  </div>
                </div>

                {studentHistory.length === 0 ? (
                  <div className="glass-panel text-center py-10 text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No history for this student</p>
                  </div>
                ) : (
                  <div className="glass-panel overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Class</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Group</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Marked By</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Hours</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentHistory.map((absence) => (
                            <tr key={absence.id} className="border-b border-border/40 hover:bg-secondary/15 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap">
                                {new Date(absence.date).toLocaleDateString("fr-FR")}
                              </td>
                              <td className="py-3 px-4">{absence.subject}</td>
                              <td className="py-3 px-4">{absence.group_name}</td>
                              <td className="py-3 px-4">{absence.teacher_name}</td>
                              <td className="py-3 px-4 whitespace-nowrap">{absence.start_time} - {absence.end_time}</td>
                              <td className="py-3 px-4">{absence.hours}h</td>
                              <td className="py-3 px-4">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[absence.status]}`}>
                                  {absence.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherHistoryPage;
