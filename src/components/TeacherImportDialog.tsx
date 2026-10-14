import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, FileSpreadsheet, UploadCloud, Loader2, Users, BookOpen, Layers, AlertTriangle,
  CheckCircle2, ChevronDown, Download, Copy, Archive, UserCheck,
} from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { TeacherImportPreview, TeacherImportResult, TeacherImportTrainer } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

type EditableTrainer = TeacherImportTrainer & { include: boolean };
type Tab = "trainers" | "groups";

/** Credentials as a CSV Excel opens correctly (BOM for accents, ";" for French locales). */
const downloadCredentials = (rows: TeacherImportResult["credentials"], headers: [string, string, string]) => {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows.map((row) => [row.name, row.email, row.temporary_password])]
    .map((cells) => cells.map(escape).join(";"));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "formateurs-identifiants.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const TeacherImportDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<TeacherImportPreview | null>(null);
  const [trainers, setTrainers] = useState<EditableTrainer[]>([]);
  const [result, setResult] = useState<TeacherImportResult | null>(null);
  const [tab, setTab] = useState<Tab>("trainers");
  const [onlyToCheck, setOnlyToCheck] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => { setPortalRoot(document.body); }, []);

  const reset = () => {
    setFileName(""); setPreview(null); setTrainers([]); setResult(null);
    setTab("trainers"); setOnlyToCheck(false); setExpanded(null); setQuery("");
  };

  const close = () => { reset(); onClose(); };

  // Lock the page behind the dialog and close on Escape.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !commit.isPending) close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const previewMutation = useMutation({
    mutationFn: (file: File) => api.previewTeacherImport(file),
    onSuccess: (response) => {
      setPreview(response.data);
      setTrainers(response.data.trainers.map((trainer) => ({ ...trainer, include: true })));
    },
    onError: (error: Error) => toast({ title: t("teacherImport.readFailed"), description: error.message, variant: "destructive" }),
  });

  const commit = useMutation({
    mutationFn: () => api.commitTeacherImport(preview!.batch_id, trainers.map((trainer) => ({
      index: trainer.index,
      action: trainer.include ? "import" : "skip",
      first_name: trainer.first_name.trim(),
      last_name: trainer.last_name.trim(),
    }))),
    onSuccess: (response) => {
      setResult(response.data);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error: Error) => toast({ title: t("teacherImport.saveFailed"), description: error.message, variant: "destructive" }),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    previewMutation.mutate(file);
  };

  const update = (index: number, patch: Partial<EditableTrainer>) =>
    setTrainers((current) => current.map((trainer) => (trainer.index === index ? { ...trainer, ...patch } : trainer)));

  const included = trainers.filter((trainer) => trainer.include);
  const toCreate = included.filter((trainer) => trainer.status === "new").length;
  const toLink = included.length - toCreate;
  const missingName = included.some((trainer) => trainer.status === "new" && (!trainer.first_name.trim() || !trainer.last_name.trim()));
  const flagged = trainers.filter((trainer) => trainer.name_check && trainer.status === "new").length;
  const moduleCount = included.reduce((sum, trainer) => sum + trainer.modules.length, 0);
  const groupCounts = useMemo(() => ({
    new: preview?.groups.filter((group) => group.status === "new").length ?? 0,
    existing: preview?.groups.filter((group) => group.status === "existing").length ?? 0,
    archived: preview?.groups.filter((group) => group.status === "archived").length ?? 0,
  }), [preview]);

  const visibleTrainers = trainers.filter((trainer) => {
    if (onlyToCheck && !(trainer.name_check && trainer.status === "new")) return false;
    if (!query.trim()) return true;
    const haystack = `${trainer.source_name} ${trainer.first_name} ${trainer.last_name} ${trainer.groups.join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const allIncluded = trainers.length > 0 && trainers.every((trainer) => trainer.include);
  const skippedRows = preview ? preview.skipped.unassigned + preview.skipped.missing_group + preview.skipped.missing_module : 0;

  if (!portalRoot) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !commit.isPending && close()}
            className="fixed inset-0 z-[9990] bg-foreground/35 backdrop-blur-[2px]"
          />
          {/* Centred by a flex wrapper, not a translate: framer-motion owns the
              panel's transform for its entrance animation and would override it. */}
          <div className="fixed inset-0 z-[9991] flex items-center justify-center p-3 sm:p-6 pointer-events-none">
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="teacher-import-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className={`pointer-events-auto w-full max-w-[68rem] max-h-[92vh] ${preview && !result ? "h-full" : ""} bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <header className="shrink-0 px-6 py-5 border-b border-border flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="teacher-import-title" className="font-display font-bold text-xl leading-tight">{t("teacherImport.title")}</h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                    {result ? t("teacherImport.stepDone") : preview ? t("teacherImport.stepReview", { file: fileName }) : t("teacherImport.subtitle")}
                  </p>
                </div>
              </div>
              <button onClick={close} disabled={commit.isPending} aria-label={t("app.close")} className="p-1.5 -mr-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* ── Step 1: upload ── */}
            {!preview && !result && (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <label
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}
                  className={`relative flex flex-col items-center justify-center text-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors
                    ${dragging ? "border-primary bg-primary/[0.06]" : "border-border hover:border-primary/40 hover:bg-secondary/40"}
                    ${previewMutation.isPending ? "pointer-events-none" : ""}`}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".xlsx,.csv"
                    className="sr-only"
                    onChange={(event) => { pick(event.target.files?.[0]); event.currentTarget.value = ""; }}
                  />
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="font-semibold">{t("teacherImport.reading", { file: fileName })}</p>
                      <p className="text-sm text-muted-foreground">{t("teacherImport.readingHint")}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <p className="font-semibold text-lg">{t("teacherImport.drop")}</p>
                      <p className="text-sm text-muted-foreground">{t("teacherImport.formats")}</p>
                    </>
                  )}
                </label>

                <div className="mt-7 grid sm:grid-cols-3 gap-3">
                  {[
                    { icon: Users, title: t("teacherImport.whatTrainers"), body: t("teacherImport.whatTrainersBody") },
                    { icon: Layers, title: t("teacherImport.whatGroups"), body: t("teacherImport.whatGroupsBody") },
                    { icon: BookOpen, title: t("teacherImport.whatModules"), body: t("teacherImport.whatModulesBody") },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-xl border border-border bg-secondary/30 p-4">
                      <Icon className="w-5 h-5 text-primary mb-2" />
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{body}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-5">{t("teacherImport.columnsHint")}</p>
              </div>
            )}

            {/* ── Step 2: review ── */}
            {preview && !result && (
              <>
                <div className="shrink-0 px-6 pt-5 pb-4 space-y-4 border-b border-border">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat icon={Users} label={t("teacherImport.statTrainers")} value={included.length}
                      detail={t("teacherImport.statTrainersDetail", { created: toCreate, linked: toLink })} />
                    <Stat icon={Layers} label={t("teacherImport.statGroups")} value={preview.groups.length}
                      detail={t("teacherImport.statGroupsDetail", { created: groupCounts.new, existing: groupCounts.existing })} />
                    <Stat icon={BookOpen} label={t("teacherImport.statModules")} value={moduleCount}
                      detail={t("teacherImport.statModulesDetail", { year: preview.academic_year })} />
                    <Stat icon={AlertTriangle} label={t("teacherImport.statSkipped")} value={skippedRows}
                      detail={t("teacherImport.statSkippedDetail")} tone={skippedRows ? "warning" : undefined} />
                  </div>

                  {flagged > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3">
                      <p className="text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                        {t("teacherImport.checkNames", { count: flagged })}
                      </p>
                      <button onClick={() => setOnlyToCheck((value) => !value)} className="text-sm font-semibold text-primary hover:underline">
                        {onlyToCheck ? t("teacherImport.showAll") : t("teacherImport.showToCheck")}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {(["trainers", "groups"] as Tab[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
                      >
                        {key === "trainers" ? t("teacherImport.tabTrainers", { count: trainers.length }) : t("teacherImport.tabGroups", { count: preview.groups.length })}
                      </button>
                    ))}
                    {tab === "trainers" && (
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("teacherImport.search")}
                        aria-label={t("teacherImport.search")}
                        className="input-glass h-9 sm:ml-auto sm:max-w-xs"
                      />
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {tab === "trainers" ? (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                        <tr>
                          <th className="th-label w-10">
                            <input type="checkbox" className="accent-primary" checked={allIncluded} aria-label={t("app.all")}
                              onChange={() => setTrainers((current) => current.map((trainer) => ({ ...trainer, include: !allIncluded })))} />
                          </th>
                          <th className="th-label">{t("teacherImport.colSource")}</th>
                          <th className="th-label">{t("teachers.firstName")}</th>
                          <th className="th-label">{t("teachers.lastName")}</th>
                          <th className="th-label hidden md:table-cell">{t("teacherImport.colAssignment")}</th>
                          <th className="th-label">{t("teacherImport.colAccount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTrainers.map((trainer) => {
                          const open = expanded === trainer.index;
                          const editable = trainer.status === "new";
                          return (
                            <FragmentRow key={trainer.index}>
                              <tr className={`border-b border-border/60 transition-colors ${trainer.include ? "" : "opacity-45"} ${open ? "bg-secondary/40" : "hover:bg-secondary/25"}`}>
                                <td className="py-2.5 px-4 align-top pt-4">
                                  <input type="checkbox" className="accent-primary" checked={trainer.include} aria-label={trainer.source_name}
                                    onChange={(event) => update(trainer.index, { include: event.target.checked })} />
                                </td>
                                <td className="py-2.5 px-4 align-top pt-3.5">
                                  <p className="font-medium text-[13px] mono-figure">{trainer.source_name}</p>
                                  {trainer.name_check && editable && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-warning">
                                      <AlertTriangle className="w-3 h-3" /> {t("teacherImport.verifyName")}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <Input value={trainer.first_name} disabled={!editable || !trainer.include}
                                    onChange={(event) => update(trainer.index, { first_name: event.target.value })}
                                    aria-label={`${t("teachers.firstName")} — ${trainer.source_name}`}
                                    className={`h-9 input-glass ${trainer.name_check && editable ? "border-warning/50" : ""}`} />
                                </td>
                                <td className="py-2 px-2 align-top">
                                  <Input value={trainer.last_name} disabled={!editable || !trainer.include}
                                    onChange={(event) => update(trainer.index, { last_name: event.target.value })}
                                    aria-label={`${t("teachers.lastName")} — ${trainer.source_name}`}
                                    className={`h-9 input-glass ${trainer.name_check && editable ? "border-warning/50" : ""}`} />
                                </td>
                                <td className="py-2.5 px-4 align-top pt-3 hidden md:table-cell">
                                  <button onClick={() => setExpanded(open ? null : trainer.index)}
                                    className="text-left group" aria-expanded={open}>
                                    <span className="text-[13px] font-medium group-hover:text-primary transition-colors">
                                      {t("teacherImport.assignmentSummary", { groups: trainer.groups.length, modules: trainer.modules.length })}
                                    </span>
                                    <ChevronDown className={`inline w-3.5 h-3.5 ml-1 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                                    <span className="block text-[11px] text-muted-foreground truncate max-w-[16rem]">{trainer.groups.join(" · ")}</span>
                                  </button>
                                </td>
                                <td className="py-2.5 px-4 align-top pt-3.5">
                                  {trainer.status === "existing" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary" title={trainer.existing_email ?? ""}>
                                      <UserCheck className="w-3 h-3" /> {t("teacherImport.existing")}
                                    </span>
                                  ) : (
                                    <span className="inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                                      {t("teacherImport.newAccount")}
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {open && (
                                <tr className="border-b border-border/60 bg-secondary/40">
                                  <td />
                                  <td colSpan={5} className="px-4 pb-4 pt-1">
                                    <div className="grid md:grid-cols-[1fr_2fr] gap-4">
                                      <div>
                                        <p className="eyebrow mb-2">{t("teacherImport.groupsLabel")}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {trainer.groups.map((group) => (
                                            <span key={group} className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-card border border-border mono-figure">{group}</span>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="eyebrow mb-2">{t("teacherImport.modulesLabel")}</p>
                                        <ul className="space-y-1">
                                          {trainer.modules.map((module) => (
                                            <li key={module.name} className="text-[13px] flex gap-2">
                                              {module.code && <span className="mono-figure text-[11px] text-muted-foreground shrink-0 pt-px w-16">{module.code}</span>}
                                              <span>{module.name}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </FragmentRow>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                        <tr>
                          <th className="th-label">{t("groups.title")}</th>
                          <th className="th-label hidden sm:table-cell">{t("groups.degree")}</th>
                          <th className="th-label hidden md:table-cell">{t("teacherImport.colFiliere")}</th>
                          <th className="th-label">{t("teacherImport.colTrainers")}</th>
                          <th className="th-label">{t("groups.status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.groups.map((group) => (
                          <tr key={group.name} className="border-b border-border/60 hover:bg-secondary/25">
                            <td className="py-2.5 px-4 font-semibold mono-figure text-[13px]">{group.name}</td>
                            <td className="py-2.5 px-4 hidden sm:table-cell text-muted-foreground">
                              {[group.degree, group.study_year].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="py-2.5 px-4 hidden md:table-cell text-muted-foreground text-[13px]">{group.filiere ?? "—"}</td>
                            <td className="py-2.5 px-4 tabular-nums">{group.trainer_count}</td>
                            <td className="py-2.5 px-4">
                              {group.status === "new" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">{t("teacherImport.groupNew")}</span>}
                              {group.status === "existing" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t("teacherImport.groupExisting")}</span>}
                              {group.status === "archived" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning" title={t("teacherImport.groupArchivedHint")}>
                                  <Archive className="w-3 h-3" /> {t("teacherImport.groupArchived")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {tab === "trainers" && visibleTrainers.length === 0 && (
                    <p className="p-10 text-center text-sm text-muted-foreground">{t("teacherImport.noMatch")}</p>
                  )}
                </div>

                <footer className="shrink-0 px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/30">
                  <p className="text-[13px] text-muted-foreground">
                    {missingName
                      ? <span className="text-destructive font-medium">{t("teacherImport.missingName")}</span>
                      : t("teacherImport.footerSummary", { created: toCreate, linked: toLink, groups: groupCounts.new })}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={reset} disabled={commit.isPending}>{t("teacherImport.otherFile")}</Button>
                    <Button
                      onClick={() => commit.mutate()}
                      disabled={!included.length || missingName || commit.isPending}
                      className="btn-glow text-primary-foreground border-0 gap-2 min-w-[11rem]"
                    >
                      {commit.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("teacherImport.saving")}</> : t("teacherImport.confirm")}
                    </Button>
                  </div>
                </footer>
              </>
            )}

            {/* ── Step 3: result ── */}
            {result && (
              <>
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-xl">{t("teacherImport.doneTitle")}</p>
                      <p className="text-muted-foreground mt-1">
                        {t("teacherImport.doneBody", {
                          created: result.created, linked: result.linked,
                          groups: result.groups_created, modules: result.modules_created,
                        })}
                      </p>
                    </div>
                  </div>

                  {result.groups_archived.length > 0 && (
                    <div className="rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-sm">
                      <p className="font-semibold flex items-center gap-2"><Archive className="w-4 h-4 text-warning" /> {t("teacherImport.archivedTitle")}</p>
                      <p className="text-muted-foreground mt-1">{t("teacherImport.archivedBody", { groups: result.groups_archived.join(", ") })}</p>
                    </div>
                  )}

                  {result.credentials.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="font-display font-semibold text-lg">{t("teacherImport.credentialsTitle")}</h3>
                          <p className="text-[13px] text-muted-foreground mt-0.5">{t("teacherImport.credentialsHint")}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                            const text = result.credentials.map((row) => `${row.name}\t${row.email}\t${row.temporary_password}`).join("\n");
                            navigator.clipboard?.writeText(text).then(() => toast({ title: t("teacherImport.copied") }));
                          }}>
                            <Copy className="w-4 h-4" /> {t("teacherImport.copy")}
                          </Button>
                          <Button size="sm" className="gap-1.5 btn-glow text-primary-foreground border-0"
                            onClick={() => downloadCredentials(result.credentials, [t("teacherImport.colName"), t("auth.email"), t("teacherImport.colPassword")])}>
                            <Download className="w-4 h-4" /> {t("teacherImport.download")}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="max-h-[22rem] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-secondary">
                              <tr>
                                <th className="th-label">{t("teacherImport.colName")}</th>
                                <th className="th-label">{t("auth.email")}</th>
                                <th className="th-label">{t("teacherImport.colPassword")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.credentials.map((row) => (
                                <tr key={row.email} className="border-t border-border/60">
                                  <td className="py-2 px-4 font-medium">{row.name}</td>
                                  <td className="py-2 px-4 mono-figure text-[13px]">{row.email}</td>
                                  <td className="py-2 px-4 mono-figure text-[13px]">{row.temporary_password}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
                <footer className="shrink-0 px-6 py-4 border-t border-border flex justify-end bg-secondary/30">
                  <Button onClick={close} className="btn-glow text-primary-foreground border-0">{t("teacherImport.finish")}</Button>
                </footer>
              </>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    portalRoot,
  );
};

/** Keeps a row and its expandable detail row together without an extra DOM node. */
const FragmentRow = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const Stat = ({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Users; label: string; value: number; detail: string; tone?: "warning";
}) => (
  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${tone === "warning" ? "text-warning" : ""}`} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
    </div>
    <p className="text-2xl font-display font-bold tabular-nums leading-tight mt-1">{value}</p>
    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{detail}</p>
  </div>
);

export default TeacherImportDialog;
