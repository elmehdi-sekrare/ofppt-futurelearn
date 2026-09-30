import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit2, Trash2, X, GraduationCap, Filter, Download, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import SearchField from "@/components/SearchField";
import { Button } from "@/components/ui/button";
import { exportStudentsCSV } from "@/utils/exportUtils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import StudentStatsDialog from "@/components/StudentStatsDialog";
import type { Student } from "@/types/api";

const StudentsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statsStudent, setStatsStudent] = useState<Student | null>(null);
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
  // When the list is filtered to one group, "Add Student" targets that group directly.
  const preselectedGroup = groupFilter ? activeGroups.find((group) => group.name === groupFilter) : undefined;

  const saveMutation = useMutation({
    mutationFn: (data: { id?: number; payload: any }) => {
      if (data.id) return api.updateStudent(data.id, data.payload);
      return api.createStudent(data.payload);
    },
    onSuccess: (res: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      if (!vars.id && res?.credentials) {
        showSuccess({
          title: t("students.added"),
          description: `${t("auth.email")}: ${res.credentials.email} · ${t("auth.password")}: ${res.credentials.password}`,
          icon: "user-plus",
          accentColor: "#1b5aa8",
        });
      } else {
        showSuccess({
          title: vars.id ? t("students.updated") : t("students.added"),
          description: vars.id ? t("students.updatedDesc") : t("students.registered"),
          icon: vars.id ? "check" : "user-plus",
          accentColor: vars.id ? "#159a52" : "#1b5aa8",
        });
      }
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: t("app.error"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteConfirm(null);
      showSuccess({
        title: t("students.deleted"),
        description: t("students.deletedDesc"),
        icon: "trash",
        accentColor: "#c62839",
      });
    },
    onError: (err: Error) => {
      toast({ title: t("app.error"), description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => api.deleteStudents(selectedIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setSelectedIds([]);
      showSuccess({
        title: t("students.deleted"),
        description: t("studentsPage.bulkDeleted", { count: response.data.deleted }),
        icon: "trash",
        accentColor: "#c62839",
      });
    },
    onError: (err: Error) => toast({ title: t("app.error"), description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        `${s.first_name} ${s.last_name} ${s.email} ${s.cne}`.toLowerCase().includes(search.toLowerCase());
      // Students can belong to several groups, so match any membership.
      const groups = s.group_names?.length ? s.group_names : [s.group_name];
      const matchGroup = !groupFilter || groups.includes(groupFilter);
      return matchSearch && matchGroup;
    });
  }, [students, search, groupFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));
  const toggleStudent = (id: number) => setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  const toggleFiltered = () => setSelectedIds((current) => allFilteredSelected
    ? current.filter((id) => !filtered.some((student) => student.id === id))
    : Array.from(new Set([...current, ...filtered.map((student) => student.id)])));
  const deleteSelected = () => {
    if (!selectedIds.length || !window.confirm(t("studentsPage.confirmBulkDelete", { count: selectedIds.length }))) return;
    bulkDeleteMutation.mutate();
  };

  const openAdd = () => {
    if (activeGroups.length === 0) {
      toast({ title: t("studentsPage.noActiveGroup"), description: t("studentsPage.noActiveGroupHint"), variant: "destructive" });
      return;
    }
    setEditingStudent(null);
    setForm({ firstName: "", lastName: "", cne: "", groupId: preselectedGroup?.id ?? activeGroups[0].id, phone: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingStudent(s);
    setForm({ firstName: s.first_name, lastName: s.last_name, cne: s.cne, groupId: s.group_id, phone: s.phone });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.cne.trim()) {
      toast({ title: t("app.error"), description: t("studentsPage.requiredFields"), variant: "destructive" });
      return;
    }
    if (!form.groupId) {
      toast({ title: t("app.error"), description: t("studentsPage.selectGroupRequired"), variant: "destructive" });
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
    <StudentStatsDialog student={statsStudent} onClose={() => setStatsStudent(null)} />
    <div className="space-y-6">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="eyebrow">{t("nav.students")}</p>
          <h1 className="page-title mt-2.5">{t("students.title")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4">{t("studentsPage.registered", { count: students.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && <Button variant="destructive" className="gap-2" onClick={deleteSelected} disabled={bulkDeleteMutation.isPending}>
            <Trash2 className="w-4 h-4" /> {bulkDeleteMutation.isPending ? t("studentsPage.deleting") : t("studentsPage.deleteSelected", { count: selectedIds.length })}
          </Button>}
          <Button variant="outline" className="gap-2" onClick={() => { exportStudentsCSV(filtered as any); showSuccess({ title: t("studentsPage.exportDone"), description: t("studentsPage.exportDesc", { count: filtered.length }), icon: "check", accentColor: "#159a52" }); }}>
            <Download className="w-4 h-4" /> {t("app.export")}
          </Button>
          <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2">
            <Plus className="w-4 h-4" /> {preselectedGroup ? t("studentsPage.addTo", { group: preselectedGroup.name }) : t("students.add")}
          </Button>
        </div>
      </motion.header>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchField value={search} onChange={setSearch} placeholder={t("students.search")} className="flex-1 basis-[22rem]" />
        <StyledSelect
          value={groupFilter}
          onValueChange={setGroupFilter}
          icon={<Filter className="w-4 h-4" />}
          className="w-full sm:w-[170px] shrink-0"
          options={[{ label: t("students.allGroups"), value: "" }, ...activeGroups.map((g) => ({ label: g.name, value: g.name }))]}
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left py-3 px-4 w-10"><input type="checkbox" aria-label={t("app.all")} checked={allFilteredSelected} onChange={toggleFiltered} className="accent-primary" /></th>
                <th className="th-label">{t("students.tableStudent")}</th>
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{t("students.cne")}</th>
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">{t("auth.email")}</th>
                <th className="th-label">{t("students.tableGroup")}</th>
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">{t("stats.absenceHours")}</th>
                <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">{t("app.actions")}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 px-4"><input type="checkbox" aria-label={`${s.first_name} ${s.last_name}`} checked={selectedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} className="accent-primary" /></td>
                    <td className="py-3 px-4">
                      <button onClick={() => setStatsStudent(s)} className="flex items-center gap-3 text-left group rounded-lg" title={t("stats.viewStats")}>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary text-[11px] font-semibold">
                          {`${s.first_name[0] ?? ""}${s.last_name[0] ?? ""}`.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden mono-figure">{s.cne}</p>
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell mono-figure text-xs">{s.cne}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell text-xs">{s.email}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">{s.group_name}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold tabular-nums ${s.total_absence_hours > 48 ? "text-destructive" : s.total_absence_hours > 30 ? "text-warning" : "text-foreground"}`}>
                          {s.total_absence_hours}h
                        </span>
                        {s.total_absence_hours > 48 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive uppercase tracking-wide">{t("studentsPage.danger")}</span>
                        )}
                        {s.total_absence_hours > 30 && s.total_absence_hours <= 48 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning/10 text-warning uppercase tracking-wide">{t("studentsPage.warning")}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {deleteConfirm === s.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(s.id)} className="h-7 text-xs">{t("app.confirm")}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)} className="h-7 text-xs">{t("app.cancel")}</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setStatsStudent(s)} title={t("stats.viewStats")} aria-label={t("stats.viewStats")} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(s)} title={t("app.edit")} aria-label={t("app.edit")} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(s.id)} title={t("app.delete")} aria-label={t("app.delete")} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
            <div className="text-center py-16 px-6">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-medium">{t("students.empty")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("students.emptyHint")}</p>
              {students.length === 0 && (
                <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2 mt-5">
                  <Plus className="w-4 h-4" /> {t("students.add")}
                </Button>
              )}
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
                  <h2 className="font-display font-semibold text-lg">{editingStudent ? t("students.edit") : t("students.add")}</h2>
                  <button onClick={() => setDialogOpen(false)} aria-label={t("app.close")} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="student-first" className="text-sm font-medium">{t("students.firstName")}</label>
                    <Input id="student-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="student-last" className="text-sm font-medium">{t("students.lastName")}</label>
                    <Input id="student-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="student-cne" className="text-sm font-medium">{t("students.cne")}</label>
                    <Input id="student-cne" value={form.cne} onChange={(e) => setForm({ ...form, cne: e.target.value })} className="input-glass mono-figure" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="student-phone" className="text-sm font-medium">{t("students.phone")}</label>
                    <Input id="student-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-glass" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium">{t("students.group")}</label>
                    <StyledSelect
                      value={form.groupId ? String(form.groupId) : ""}
                      onValueChange={(v) => setForm({ ...form, groupId: v ? Number(v) : 0 })}
                      placeholder={t("students.selectGroup")}
                      options={activeGroups.map((g) => ({ label: `${g.name} — ${g.level}`, value: String(g.id) }))}
                    />
                    {activeGroups.length === 0 && <p className="text-xs text-warning">{t("students.needGroup")}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending} className="btn-glow text-primary-foreground border-0">
                    {saveMutation.isPending ? t("app.saving") : editingStudent ? t("app.update") : t("app.add")}
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
