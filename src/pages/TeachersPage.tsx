import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit2, Trash2, X, Users, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Teacher } from "@/types/api";

const TeachersPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { toast } = useToast();
  const { showSuccess, NotificationComponent } = useSuccessNotification();

  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [groupIds, setGroupIds] = useState<number[]>([]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const { data: teachersRes, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api.getTeachers(),
  });

  const teachers = teachersRes?.data ?? [];
  const { data: groupsRes } = useQuery({ queryKey: ["groups"], queryFn: api.getGroups });
  const groups = (groupsRes?.data ?? []).filter((group) => (group.status ?? "active") === "active");
  const subjectOptions = Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects ?? []).filter(Boolean)));

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; payload: any }) => {
      if (data.id) return api.updateTeacher(data.id, data.payload);
      return api.createTeacher(data.payload);
    },
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      if (!vars.id && res?.credentials) {
        showSuccess({
          title: "Teacher Added",
          description: `Login: ${res.credentials.email} | Password: ${res.credentials.password}`,
          icon: "user-plus",
          accentColor: "#8b5cf6",
        });
      } else {
        showSuccess({
          title: vars.id ? "Teacher Updated" : "Teacher Added",
          description: vars.id ? "Teacher details saved successfully" : "New teacher registered",
          icon: vars.id ? "check" : "user-plus",
          accentColor: vars.id ? "#10b981" : "#8b5cf6",
        });
      }
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setDeleteConfirm(null);
      showSuccess({
        title: "Teacher Deleted",
        description: "Teacher removed from the system",
        icon: "trash",
        accentColor: "#ef4444",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      const matchSearch = `${t.first_name} ${t.last_name} ${t.email} ${t.subject}`.toLowerCase().includes(search.toLowerCase());
      const matchSubject = !subjectFilter || (t.subjects ?? []).includes(subjectFilter);
      return matchSearch && matchSubject;
    });
  }, [teachers, search, subjectFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({ firstName: "", lastName: "", phone: "" });
    setGroupIds([]);
    setDialogOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({ firstName: t.first_name, lastName: t.last_name, phone: t.phone || "" });
    setGroupIds(t.group_ids ?? groups.filter((group) => t.groups_assigned.includes(group.name)).map((group) => group.id));
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: "Validation Error", description: "First name and last name are required", variant: "destructive" });
      return;
    }
    const payload = { first_name: form.firstName, last_name: form.lastName, phone: form.phone, group_ids: groupIds };
    saveMutation.mutate({ id: editing?.id, payload });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
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
          <h1 className="text-2xl font-display font-bold">Teachers</h1>
          <p className="text-muted-foreground text-sm mt-1">{teachers.length} teachers registered</p>
        </div>
        <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2">
          <Plus className="w-4 h-4" /> Add Teacher
        </Button>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teachers..." className="pl-10 input-glass" />
        </div>
        <StyledSelect
          value={subjectFilter}
          onValueChange={setSubjectFilter}
          icon={<Filter className="w-4 h-4" />}
          className="min-w-[180px]"
          options={[{ label: "All Subjects", value: "" }, ...subjectOptions.map((subject) => ({ label: subject, value: subject }))]}
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Subject</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Groups</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((t, i) => (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{t.first_name} {t.last_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{t.subject}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                      {(t.subjects ?? []).length > 0 ? t.subjects?.join(", ") : "No subjects created"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{t.email}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {t.groups_assigned.map((g) => (
                          <span key={g} className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{g}</span>
                        ))}
                        {t.groups_assigned.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {deleteConfirm === t.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(t.id)} className="h-7 text-xs">Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)} className="h-7 text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No teachers found</p>
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
                  <h2 className="font-display font-semibold text-lg">{editing ? "Edit Teacher" : "Add Teacher"}</h2>
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
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-muted-foreground">Assigned Groups</label>
                    <p className="text-xs text-muted-foreground">Choose the active groups this teacher can access. Subjects are managed by the teacher through My Modules.</p>
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60 p-2 space-y-1">
                      {groups.length === 0 ? <p className="text-xs text-muted-foreground p-2">Create groups first.</p> : groups.map((group) => (
                        <label key={group.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-secondary/50">
                          <input type="checkbox" checked={groupIds.includes(group.id)} onChange={(event) => setGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />
                          <span>{group.name}</span><span className="text-xs text-muted-foreground">({group.student_count})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending} className="btn-glow text-primary-foreground border-0">
                    {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"} Teacher
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

export default TeachersPage;
