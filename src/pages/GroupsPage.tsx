import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit2, Trash2, X, BookOpen, Users, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Group, Student } from "@/types/api";

const degreeOptions = ["Spécialisation", "Qualification", "Technicien", "Technicien Spécialisé"];
const studyYearOptions = ["1ère année", "2ème année", "3ème année"];
const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 7 }, (_, index) => {
  const start = currentYear - 2 + index;
  return `${start}-${start + 1}`;
});

const GroupsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const { toast } = useToast();
  const { showSuccess, NotificationComponent } = useSuccessNotification();

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const [form, setForm] = useState({ name: "", degree: "", studyYear: "", academicYear: "", status: "active" as "active" | "archived" });

  const { data: groupsRes, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const groups = groupsRes?.data ?? [];
  const levels = Array.from(new Set(groups.map((group) => group.degree ?? group.level))).filter(Boolean);

  // Fetch students for expanded group
  const { data: groupStudentsRes } = useQuery({
    queryKey: ["group-students", expandedGroup],
    queryFn: () => api.getGroupStudents(expandedGroup!),
    enabled: !!expandedGroup,
  });

  const groupStudents: Student[] = groupStudentsRes?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; payload: any }) => {
      if (data.id) return api.updateGroup(data.id, data.payload);
      return api.createGroup(data.payload);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      showSuccess({
        title: vars.id ? "Group Updated" : "Group Added",
        description: vars.id ? "Group details saved successfully" : "New group created",
        icon: vars.id ? "check" : "book",
        accentColor: vars.id ? "#10b981" : "#06b6d4",
      });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDeleteConfirm(null);
      showSuccess({
        title: "Group Archived",
        description: "Group archived while attendance history is preserved",
        icon: "trash",
        accentColor: "#ef4444",
      });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (action: "archive" | "restore" | "delete") => api.updateGroupsStatus(selectedIds, action),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedIds([]);
      showSuccess({ title: "Groups Updated", description: `${response.data.archived ?? response.data.restored ?? response.data.deleted ?? 0} groups updated`, icon: "check", accentColor: "#10b981" });
    },
    onError: (err: Error) => toast({ title: "Group action failed", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
      const matchLevel = !levelFilter || g.level === levelFilter;
      const matchStatus = (g.status ?? "active") === statusFilter;
      return matchSearch && matchLevel && matchStatus;
    });
  }, [groups, search, levelFilter, statusFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((group) => selectedIds.includes(group.id));
  const toggleGroup = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  const toggleFiltered = () => setSelectedIds((current) => allFilteredSelected
    ? current.filter((id) => !filtered.some((group) => group.id === id))
    : Array.from(new Set([...current, ...filtered.map((group) => group.id)])));
  const runGroupAction = (action: "archive" | "restore" | "delete") => {
    const message = action === "archive"
      ? `Archive ${selectedIds.length} selected groups? Attendance history will be preserved.`
      : action === "restore"
        ? `Restore ${selectedIds.length} selected groups?`
        : `Permanently delete ${selectedIds.length} selected groups? This cannot be undone.`;
    if (!selectedIds.length || !window.confirm(message)) return;
    bulkStatusMutation.mutate(action);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", degree: "", studyYear: "", academicYear: "", status: "active" });
    setDialogOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setForm({ name: g.name, degree: g.degree ?? g.level, studyYear: g.study_year ?? "", academicYear: g.academic_year ?? "", status: g.status ?? "active" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Validation Error", description: "Group name is required", variant: "destructive" });
      return;
    }
    if (!form.degree || !form.studyYear || !form.academicYear) {
      toast({ title: "Validation Error", description: "Degree, study year, and academic year are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: editing?.id, payload: { name: form.name, level: form.degree, degree: form.degree, study_year: form.studyYear, academic_year: form.academicYear, status: form.status } });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <>
    {NotificationComponent}
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">{groups.filter((group) => (group.status ?? "active") === "active").length} active groups · {groups.length} total records</p>
        </div>
        {selectedIds.length > 0 && statusFilter === "active" && <Button variant="destructive" onClick={() => runGroupAction("archive")} disabled={bulkStatusMutation.isPending} className="gap-2">
          <Trash2 className="w-4 h-4" /> {bulkStatusMutation.isPending ? "Archiving..." : `Archive ${selectedIds.length}`}
        </Button>}
        {selectedIds.length > 0 && statusFilter === "archived" && <>
          <Button variant="outline" onClick={() => runGroupAction("restore")} disabled={bulkStatusMutation.isPending}>Restore {selectedIds.length}</Button>
          <Button variant="destructive" onClick={() => runGroupAction("delete")} disabled={bulkStatusMutation.isPending}>Delete permanently</Button>
        </>}
        <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2">
          <Plus className="w-4 h-4" /> Add Group
        </Button>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups..." className="pl-10 input-glass" />
        </div>
        <StyledSelect
          value={levelFilter}
          onValueChange={setLevelFilter}
          className="min-w-[150px]"
          options={[{ label: "All Levels", value: "" }, ...levels.map((l) => ({ label: l, value: l }))]}
        />
        <StyledSelect value={statusFilter} onValueChange={(value) => { setStatusFilter(value as "active" | "archived"); setSelectedIds([]); }} className="min-w-[150px]" options={[{ label: "Active Groups", value: "active" }, { label: "Archived Groups", value: "archived" }]} />
      </div>

      {filtered.length > 0 && <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" aria-label="Select all visible groups" checked={allFilteredSelected} onChange={toggleFiltered} />
        Select all visible groups
      </label>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filtered.map((g, i) => {
            const isExpanded = expandedGroup === g.id;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="glass-panel p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" aria-label={`Select ${g.name}`} checked={selectedIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{g.name}</h3>
                      <p className="text-xs text-muted-foreground">{g.degree ?? g.level}{g.study_year ? ` · ${g.study_year}` : ""}{g.academic_year ? ` · ${g.academic_year}` : ""}</p>
                                          {g.status === "archived" && <span className="text-[10px] uppercase tracking-wide text-amber-500">Archived</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {deleteConfirm === g.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(g.id)} className="h-7 text-xs">Confirm</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)} className="h-7 text-xs">Cancel</Button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        {g.status !== "archived" && <button onClick={() => setDeleteConfirm(g.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Archive group"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{g.student_count} Students</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{g.teacher_count ?? 0} Teachers</span>
                  </div>
                </div>

                <button onClick={() => setExpandedGroup(isExpanded ? null : g.id)} className="text-xs text-primary hover:underline">
                  {isExpanded ? "Hide students" : "Show students"}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        {groupStudents.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No students in this group</p>
                        ) : groupStudents.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-sm py-1.5">
                            <span>{s.first_name} {s.last_name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{s.cne}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="glass-panel text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No groups found</p>
        </div>
      )}

      {portalRoot && createPortal(
        <AnimatePresence>
          {dialogOpen && (
            <>
              <div onClick={() => setDialogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)' }} />
              <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, width: '90vw', maxWidth: '28rem' }} className="bg-card rounded-xl border border-border p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">{editing ? "Edit Group" : "Add Group"}</h2>
                <button onClick={() => setDialogOpen(false)} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Group Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DEV-301" className="input-glass" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Degree / Diploma</label>
                  <StyledSelect value={form.degree} onValueChange={(value) => setForm({ ...form, degree: value })} placeholder="Select a diploma" options={degreeOptions.map((degree) => ({ label: degree, value: degree }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Study year</label>
                  <StyledSelect value={form.studyYear} onValueChange={(value) => setForm({ ...form, studyYear: value })} placeholder="Select 1st, 2nd, or 3rd year" options={studyYearOptions.map((year) => ({ label: year, value: year }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Academic year</label>
                  <StyledSelect value={form.academicYear} onValueChange={(value) => setForm({ ...form, academicYear: value })} placeholder="Select an academic year" options={academicYearOptions.map((year) => ({ label: year, value: year }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">Group status</label>
                  <StyledSelect value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "archived" })} options={[{ label: "Active", value: "active" }, { label: "Archived", value: "archived" }]} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="btn-glow text-primary-foreground border-0">
                  {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"} Group
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

export default GroupsPage;
