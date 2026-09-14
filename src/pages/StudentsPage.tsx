import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit2, Trash2, X, GraduationCap, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportStudentsCSV } from "@/utils/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Student } from "@/types/api";

const StudentsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { toast } = useToast();
  const { showSuccess, NotificationComponent } = useSuccessNotification();

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const [form, setForm] = useState({ firstName: "", lastName: "", cne: "", groupId: 0, phone: "" });

  const { data: studentsRes, isLoading: loadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => api.getStudents(),
  });

  const { data: groupsRes, isLoading: loadingGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const students = studentsRes?.data ?? [];
  const groups = groupsRes?.data ?? [];
  const activeGroups = groups.filter((group) => (group.status ?? "active") === "active");

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; payload: any }) => {
      if (data.id) return api.updateStudent(data.id, data.payload);
      return api.createStudent(data.payload);
    },
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      if (!vars.id && res?.credentials) {
        showSuccess({
          title: "Student Added",
          description: `Login: ${res.credentials.email} | Password: ${res.credentials.password}`,
          icon: "user-plus",
          accentColor: "#3b82f6",
        });
      } else {
        showSuccess({
          title: vars.id ? "Student Updated" : "Student Added",
          description: vars.id ? "Student details saved successfully" : "New student registered",
          icon: vars.id ? "check" : "user-plus",
          accentColor: vars.id ? "#10b981" : "#3b82f6",
        });
      }
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteConfirm(null);
      showSuccess({
        title: "Student Deleted",
        description: "Student removed from the system",
        icon: "trash",
        accentColor: "#ef4444",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => api.deleteStudents(selectedIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setSelectedIds([]);
      showSuccess({
        title: "Students Deleted",
        description: `${response.data.deleted} students removed from the system`,
        icon: "trash",
        accentColor: "#ef4444",
      });
    },
    onError: (err: Error) => toast({ title: "Bulk deletion failed", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        `${s.first_name} ${s.last_name} ${s.email} ${s.cne}`.toLowerCase().includes(search.toLowerCase());
      const matchGroup = !groupFilter || s.group_name === groupFilter;
      return matchSearch && matchGroup;
    });
  }, [students, search, groupFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));
  const toggleStudent = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  const toggleFiltered = () => setSelectedIds((current) => allFilteredSelected
    ? current.filter((id) => !filtered.some((student) => student.id === id))
    : Array.from(new Set([...current, ...filtered.map((student) => student.id)])));
  const deleteSelected = () => {
    if (!selectedIds.length || !window.confirm(`Delete ${selectedIds.length} selected students? Their attendance history will also be deleted.`)) return;
    bulkDeleteMutation.mutate();
  };

  const openAdd = () => {
    setEditingStudent(null);
    setForm({ firstName: "", lastName: "", cne: "", groupId: activeGroups[0]?.id || 0, phone: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingStudent(s);
    setForm({ firstName: s.first_name, lastName: s.last_name, cne: s.cne, groupId: s.group_id, phone: s.phone });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.cne.trim()) {
      toast({ title: "Validation Error", description: "First name, last name, and CNE are required", variant: "destructive" });
      return;
    }
    const payload = {
      first_name: form.firstName,
      last_name: form.lastName,
      cne: form.cne,
      phone: form.phone,
      group_id: form.groupId,
    };
    saveMutation.mutate({ id: editingStudent?.id, payload });
  };

  if (loadingStudents || loadingGroups) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3"><Skeleton className="h-10 flex-1" /><Skeleton className="h-10 w-40" /></div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
    {NotificationComponent}
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} students registered</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" className="gap-2" onClick={deleteSelected} disabled={bulkDeleteMutation.isPending}>
            <Trash2 className="w-4 h-4" /> {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.length}`}
          </Button>}
          <Button variant="outline" className="gap-2 border-white/[0.08]" onClick={() => { exportStudentsCSV(filtered as any); showSuccess({ title: "Export Complete", description: `${filtered.length} students exported to CSV`, icon: "check", accentColor: "#10b981" }); }}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={openAdd} disabled={activeGroups.length === 0} className="btn-glow text-primary-foreground border-0 gap-2">
            <Plus className="w-4 h-4" /> Add Student
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." className="pl-10 input-glass" />
        </div>
        <StyledSelect
          value={groupFilter}
          onValueChange={setGroupFilter}
          icon={<Filter className="w-4 h-4" />}
          className="min-w-[150px]"
          options={[{ label: "All Active Groups", value: "" }, ...activeGroups.map((g) => ({ label: g.name, value: g.name }))]}
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground"><input type="checkbox" aria-label="Select all filtered students" checked={allFilteredSelected} onChange={toggleFiltered} /></th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">CNE</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Group</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Absence Hours</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4"><input type="checkbox" aria-label={`Select ${s.first_name} ${s.last_name}`} checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{s.cne}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell font-mono text-xs">{s.cne}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{s.email}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">{s.group_name}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${s.total_absence_hours > 48 ? "text-destructive" : s.total_absence_hours > 30 ? "text-yellow-500" : "text-foreground"}`}>
                          {s.total_absence_hours}h
                        </span>
                        {s.total_absence_hours > 48 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 uppercase">Danger</span>
                        )}
                        {s.total_absence_hours > 30 && s.total_absence_hours <= 48 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 uppercase">Warning</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {deleteConfirm === s.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(s.id)} className="h-7 text-xs">Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)} className="h-7 text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No students found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {portalRoot && createPortal(
        <AnimatePresence>
          {dialogOpen && (
            <>
              <div onClick={() => setDialogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)' }} />
              <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, width: '90vw', maxWidth: '32rem' }} className="bg-card rounded-xl border border-border p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-lg">{editingStudent ? "Edit Student" : "Add Student"}</h2>
                  <button onClick={() => setDialogOpen(false)} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">First Name</label>
                    <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Last Name</label>
                    <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">CNE</label>
                    <Input value={form.cne} onChange={(e) => setForm({ ...form, cne: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Group</label>
                    <StyledSelect
                      value={form.groupId ? String(form.groupId) : ""}
                      onValueChange={(v) => setForm({ ...form, groupId: v ? Number(v) : 0 })}
                      placeholder="Select a group"
                      options={activeGroups.map((g) => ({ label: `${g.name} — ${g.level}`, value: String(g.id) }))}
                    />
                    {activeGroups.length === 0 && <p className="text-xs text-amber-500">Create or restore an active group before adding students.</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending} className="btn-glow text-primary-foreground border-0">
                    {saveMutation.isPending ? "Saving..." : editingStudent ? "Update" : "Add"} Student
                  </Button>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>,
        portalRoot
      )}
    </div>
    </>
  );
};

export default StudentsPage;
