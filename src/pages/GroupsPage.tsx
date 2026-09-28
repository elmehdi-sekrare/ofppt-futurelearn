import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Edit2, Trash2, X, BookOpen, Users, GraduationCap, FileUp, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import SearchField from "@/components/SearchField";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuccessNotification } from "@/components/SuccessNotification";
import { StyledSelect } from "@/components/ui/styled-select";
import GroupRosterImport, { type GroupRosterImportHandle } from "@/components/GroupRosterImport";
import type { Group, Student } from "@/types/api";

const degreeOptions = ["Spécialisation", "Qualification", "Technicien", "Technicien Spécialisé"];
const studyYearOptions = ["1ère année", "2ème année", "3ème année"];
const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 7 }, (_, index) => {
  const start = currentYear - 2 + index;
  return `${start}-${start + 1}`;
});

const GroupsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [importGroup, setImportGroup] = useState<Group | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const rosterRef = useRef<GroupRosterImportHandle>(null);
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
    onSuccess: async (response: any, vars) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });

      // A file staged in the create dialog is imported once the group has an id.
      let importedNote = "";
      const newGroupId = response?.data?.id;
      if (!vars.id && newGroupId && rosterRef.current?.hasStagedFile()) {
        try {
          const result = await rosterRef.current.runDeferredImport(newGroupId);
          if (result) importedNote = t("groupsPage.createdWithImport", { count: result.created + result.updated });
        } catch (error) {
          toast({
            title: t("groupsPage.importAfterCreate"),
            description: (error as Error).message,
            variant: "destructive",
          });
        }
      }

      showSuccess({
        title: vars.id ? t("groups.updated") : t("groups.added"),
        description: vars.id ? t("groups.updatedDesc") : (importedNote || t("groups.createdDesc")),
        icon: vars.id ? "check" : "book",
        accentColor: vars.id ? "#159a52" : "#1b5aa8",
      });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: t("app.error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setDeleteConfirm(null);
      showSuccess({
        title: t("groups.archivedTitle"),
        description: t("groups.archivedDesc"),
        icon: "trash",
        accentColor: "#c62839",
      });
    },
    onError: (err: Error) => toast({ title: t("app.error"), description: err.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (action: "archive" | "restore" | "delete") => api.updateGroupsStatus(selectedIds, action),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedIds([]);
      showSuccess({ title: t("groups.groupsUpdated"), description: t("groups.groupsUpdatedDesc", { count: response.data.archived ?? response.data.restored ?? response.data.deleted ?? 0 }), icon: "check", accentColor: "#159a52" });
    },
    onError: (err: Error) => toast({ title: t("app.error"), description: err.message, variant: "destructive" }),
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
    const count = selectedIds.length;
    const message = action === "archive"
      ? t("groups.confirmArchive", { count })
      : action === "restore"
        ? t("groups.confirmRestore", { count })
        : t("groups.confirmDelete", { count });
    if (!count || !window.confirm(message)) return;
    bulkStatusMutation.mutate(action);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", degree: "", studyYear: "", academicYear: "", status: "active" });
    rosterRef.current?.reset();
    setDialogOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setForm({ name: g.name, degree: g.degree ?? g.level, studyYear: g.study_year ?? "", academicYear: g.academic_year ?? "", status: g.status ?? "active" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: t("app.error"), description: t("groups.nameRequired"), variant: "destructive" });
      return;
    }
    if (!form.degree || !form.studyYear || !form.academicYear) {
      toast({ title: t("app.error"), description: t("groups.fieldsRequired"), variant: "destructive" });
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
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="eyebrow">{t("nav.groups")}</p>
          <h1 className="page-title mt-2.5">{t("groups.title")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4">
            {t("groups.summary", { active: groups.filter((group) => (group.status ?? "active") === "active").length, total: groups.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && statusFilter === "active" && <Button variant="destructive" onClick={() => runGroupAction("archive")} disabled={bulkStatusMutation.isPending} className="gap-2">
            <Trash2 className="w-4 h-4" /> {bulkStatusMutation.isPending ? t("groups.archiving") : t("groups.archiveN", { count: selectedIds.length })}
          </Button>}
          {selectedIds.length > 0 && statusFilter === "archived" && <>
            <Button variant="outline" onClick={() => runGroupAction("restore")} disabled={bulkStatusMutation.isPending}>{t("groups.restoreN", { count: selectedIds.length })}</Button>
            <Button variant="destructive" onClick={() => runGroupAction("delete")} disabled={bulkStatusMutation.isPending}>{t("groups.deletePermanently")}</Button>
          </>}
          <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2">
            <Plus className="w-4 h-4" /> {t("groups.add")}
          </Button>
        </div>
      </motion.header>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchField value={search} onChange={setSearch} placeholder={t("groups.search")} className="flex-1 basis-[22rem]" />
        <StyledSelect
          value={levelFilter}
          onValueChange={setLevelFilter}
          className="w-full sm:w-[170px] shrink-0"
          options={[{ label: t("groups.allLevels"), value: "" }, ...levels.map((l) => ({ label: l, value: l }))]}
        />
        <StyledSelect value={statusFilter} onValueChange={(value) => { setStatusFilter(value as "active" | "archived"); setSelectedIds([]); }} className="w-full sm:w-[170px] shrink-0" options={[{ label: t("groups.activeGroups"), value: "active" }, { label: t("groups.archivedGroups"), value: "archived" }]} />
      </div>

      {filtered.length > 0 && <label className="flex items-center gap-2 text-sm text-muted-foreground w-fit cursor-pointer">
        <input type="checkbox" checked={allFilteredSelected} onChange={toggleFiltered} className="accent-primary" />
        {t("groups.selectAll")}
      </label>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filtered.map((g, i) => {
            const isExpanded = expandedGroup === g.id;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="glass-panel p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" aria-label={g.name} checked={selectedIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="accent-primary shrink-0" />
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold truncate">{g.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{g.degree ?? g.level}{g.study_year ? ` · ${g.study_year}` : ""}{g.academic_year ? ` · ${g.academic_year}` : ""}</p>
                      {g.status === "archived" && <span className="text-[10px] uppercase tracking-wide text-warning font-semibold">{t("groups.archived")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {deleteConfirm === g.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(g.id)} className="h-7 text-xs">{t("app.confirm")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)} className="h-7 text-xs">{t("app.cancel")}</Button>
                      </>
                    ) : (
                      <>
                        {g.status !== "archived" && <button onClick={() => setImportGroup(importGroup?.id === g.id ? null : g)} title={t("groupsPage.importList")} aria-label={t("groupsPage.importList")} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Upload className="w-3.5 h-3.5" /></button>}
                        <button onClick={() => openEdit(g)} title={t("app.edit")} aria-label={t("app.edit")} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        {g.status !== "archived" && <button onClick={() => setDeleteConfirm(g.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t("groups.archived")} aria-label={t("groups.archived")}><Trash2 className="w-3.5 h-3.5" /></button>}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span className="tabular-nums">{t("groupsPage.studentsCount", { count: g.student_count })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="tabular-nums">{t("groupsPage.teachersCount", { count: g.teacher_count ?? 0 })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => setExpandedGroup(isExpanded ? null : g.id)} className="text-xs font-medium text-primary hover:underline">
                    {isExpanded ? t("groupsPage.hideStudents") : t("groupsPage.showStudents")}
                  </button>
                  {g.status !== "archived" && (
                    <button onClick={() => setImportGroup(importGroup?.id === g.id ? null : g)} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      <FileUp className="w-3 h-3" /> {importGroup?.id === g.id ? t("groupsPage.closeImport") : t("groupsPage.importList")}
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {importGroup?.id === g.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="pt-3 border-t border-border/50">
                        <GroupRosterImport
                          groupId={g.id}
                          onImported={() => { setImportGroup(null); queryClient.invalidateQueries({ queryKey: ["group-students", g.id] }); }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        {groupStudents.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">{t("groupsPage.noStudents")}</p>
                        ) : groupStudents.map((s) => (
                          <div key={s.id} className="flex items-center justify-between gap-3 text-sm py-1.5">
                            <span className="truncate">{s.first_name} {s.last_name}</span>
                            <span className="text-xs text-muted-foreground mono-figure shrink-0">{s.cne}</span>
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
        <div className="glass-panel text-center py-16 px-6">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">{t("groups.empty")}</p>
          {groups.length === 0 && (
            <Button onClick={openAdd} className="btn-glow text-primary-foreground border-0 gap-2 mt-5">
              <Plus className="w-4 h-4" /> {t("groups.add")}
            </Button>
          )}
        </div>
      )}

      {portalRoot && createPortal(
        <AnimatePresence>
          {dialogOpen && (
            <>
              <div onClick={() => setDialogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)' }} />
              <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, width: '90vw', maxWidth: '28rem' }} className="bg-card rounded-xl border border-border p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">{editing ? t("groups.edit") : t("groups.add")}</h2>
                <button onClick={() => setDialogOpen(false)} aria-label={t("app.close")} className="p-1 hover:bg-secondary rounded-md text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="group-name" className="text-sm font-medium">{t("groups.title")}</label>
                  <Input id="group-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("groups.namePlaceholder")} className="input-glass" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("groups.degree")}</label>
                  <StyledSelect value={form.degree} onValueChange={(value) => setForm({ ...form, degree: value })} placeholder={t("groups.selectDiploma")} options={degreeOptions.map((degree) => ({ label: degree, value: degree }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("groups.studyYear")}</label>
                  <StyledSelect value={form.studyYear} onValueChange={(value) => setForm({ ...form, studyYear: value })} placeholder={t("groups.selectYear")} options={studyYearOptions.map((year) => ({ label: year, value: year }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("groups.academicYear")}</label>
                  <StyledSelect value={form.academicYear} onValueChange={(value) => setForm({ ...form, academicYear: value })} placeholder={t("groups.selectAcademic")} options={academicYearOptions.map((year) => ({ label: year, value: year }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("groups.status")}</label>
                  <StyledSelect value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "archived" })} options={[{ label: t("groups.active"), value: "active" }, { label: t("groups.archived"), value: "archived" }]} />
                </div>
                {!editing && (
                  <div className="pt-2 border-t border-border/50">
                    <GroupRosterImport ref={rosterRef} deferred />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("app.cancel")}</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="btn-glow text-primary-foreground border-0">
                  {saveMutation.isPending ? t("app.saving") : editing ? t("app.update") : t("app.add")}
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
