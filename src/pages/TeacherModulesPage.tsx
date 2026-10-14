import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpenCheck, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { ModuleImportRow } from "@/types/api";

type EditableModule = ModuleImportRow & { action: "import" | "skip" };

const TeacherModulesPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [rows, setRows] = useState<EditableModule[]>([]);
  const { data, isLoading } = useQuery({ queryKey: ["modules"], queryFn: api.getModules });
  const modules = data?.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["modules"] });

  const add = useMutation({ mutationFn: () => api.createModule({ name: name.trim() }), onSuccess: () => { refresh(); setName(""); toast({ title: t("teacherSpace.added") }); }, onError: (error: Error) => toast({ title: t("teacherSpace.addFailed"), description: error.message, variant: "destructive" }) });
  const save = useMutation({ mutationFn: () => api.updateModule(editing!.id, { name: editing!.name.trim() }), onSuccess: () => { refresh(); setEditing(null); toast({ title: t("teacherSpace.updated") }); }, onError: (error: Error) => toast({ title: t("teacherSpace.updateFailed"), description: error.message, variant: "destructive" }) });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteModule(id), onSuccess: refresh, onError: (error: Error) => toast({ title: t("teacherSpace.deleteFailed"), description: error.message, variant: "destructive" }) });
  const preview = useMutation({ mutationFn: api.previewModuleImport, onSuccess: (response) => { setBatchId(response.data.batch_id); setRows(response.data.rows.map((row) => ({ ...row, action: row.status === "new" ? "import" : "skip" }))); }, onError: (error: Error) => toast({ title: t("teacherSpace.importFailed"), description: error.message, variant: "destructive" }) });
  const commit = useMutation({ mutationFn: () => api.commitModuleImport(batchId!, rows.map(({ index, action, name }) => ({ index, action, name }))), onSuccess: (response) => { refresh(); setRows([]); setBatchId(null); toast({ title: t("teacherSpace.imported"), description: t("teacherSpace.importedDesc", { created: response.data.created, skipped: response.data.skipped }) }); }, onError: (error: Error) => toast({ title: t("teacherSpace.saveFailed"), description: error.message, variant: "destructive" }) });
  const updateRow = (index: number, update: Partial<EditableModule>) => setRows((current) => current.map((row) => row.index === index ? { ...row, ...update } : row));

  return <div className="space-y-6">
    <header><p className="eyebrow">{t("nav.modules")}</p><h1 className="page-title mt-2.5">{t("teacherSpace.modulesTitle")}</h1><span className="brand-rule" /><p className="text-muted-foreground mt-4">{t("teacherSpace.modulesSubtitle")}</p></header>
    <section className="glass-panel p-5 space-y-3"><div className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /><h2 className="font-semibold">{t("teacherSpace.addModule")}</h2></div><div className="flex flex-col sm:flex-row gap-3"><Input aria-label={t("teacherSpace.newModuleName")} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("teacherSpace.modulePlaceholder")} className="input-glass" onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) add.mutate(); }} /><Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()} className="btn-glow border-0">{add.isPending ? t("teacherSpace.adding") : t("teacherSpace.add")}</Button></div></section>
    <section className="glass-panel p-5 space-y-3"><div className="flex items-center gap-2"><FileUp className="w-5 h-5 text-primary" /><h2 className="font-semibold">{t("teacherSpace.importTitle")}</h2></div><p className="text-xs text-muted-foreground">{t("teacherSpace.importHint")}</p><Input aria-label={t("teacherSpace.importFile")} type="file" accept=".csv,.xlsx,.docx" disabled={preview.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) preview.mutate(file); event.currentTarget.value = ""; }} className="input-glass file:mr-3 file:border-0 file:bg-transparent" /></section>
    {rows.length > 0 && <section className="glass-panel overflow-hidden"><div className="p-4 border-b border-border"><h2 className="font-semibold">{t("teacherSpace.reviewTitle")}</h2></div><div className="divide-y divide-border/50">{rows.map((row) => <div key={row.index} className="p-3 grid sm:grid-cols-[3rem_1fr_12rem] gap-3 items-center"><span className="text-xs text-muted-foreground">{row.source_row}</span><div><Input aria-label={t("teacherSpace.rowAria", { row: row.source_row })} value={row.name} disabled={row.status !== "new"} onChange={(event) => updateRow(row.index, { name: event.target.value })} className="h-9 input-glass" />{row.message && <p className="text-xs text-muted-foreground mt-1">{row.message}</p>}</div><select aria-label={t("teacherSpace.rowAria", { row: row.source_row })} value={row.action} disabled={row.status !== "new"} onChange={(event) => updateRow(row.index, { action: event.target.value as EditableModule["action"] })} className="h-9 rounded-md border border-border bg-background px-2 text-sm"><option value="import">{t("teacherSpace.import")}</option><option value="skip">{t("teacherSpace.skip")}</option></select></div>)}</div><div className="p-4 flex justify-end"><Button disabled={!batchId || !rows.some((row) => row.action === "import") || commit.isPending} onClick={() => commit.mutate()} className="btn-glow border-0">{commit.isPending ? t("teacherSpace.saving") : t("teacherSpace.confirmImport")}</Button></div></section>}
    <section className="glass-panel overflow-hidden"><div className="p-4 border-b border-border flex items-center gap-2"><BookOpenCheck className="w-5 h-5 text-primary" /><h2 className="font-semibold">{isLoading ? t("teacherSpace.modulesTitle") : t("teacherSpace.yourModules", { count: modules.length })}</h2></div>{isLoading ? <Skeleton className="h-32 m-4" /> : <div className="divide-y divide-border/50">{modules.map((module) => <div key={module.id} className="p-4 flex items-center justify-between gap-3">{editing?.id === module.id ? <Input aria-label={t("teacherSpace.editName")} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="h-9 input-glass max-w-md" /> : <span className="font-medium text-sm">{module.name}</span>}<div className="flex gap-2">{editing?.id === module.id ? <><Button size="sm" onClick={() => save.mutate()} disabled={!editing.name.trim() || save.isPending}>{t("app.save")}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t("app.cancel")}</Button></> : <><Button size="icon" variant="ghost" aria-label={t("teacherSpace.editAria", { name: module.name })} onClick={() => setEditing({ id: module.id, name: module.name })}><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" aria-label={t("teacherSpace.deleteAria", { name: module.name })} onClick={() => remove.mutate(module.id)} disabled={remove.isPending}><Trash2 className="w-4 h-4 text-destructive" /></Button></>}</div></div>)}{modules.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("teacherSpace.noModules")}</p>}</div>}</section>
  </div>;
};

export default TeacherModulesPage;
