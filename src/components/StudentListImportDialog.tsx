import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, FileSpreadsheet, UploadCloud, Loader2, Users, Layers, AlertTriangle, CheckCircle2,
  ChevronDown, Download, Copy, Archive, ShieldCheck, Sparkles, Info,
} from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { StudentListImportPreview, StudentListImportResult, StudentListImportStudent } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "groups" | "students" | "skipped";

/** Credentials as a CSV Excel opens correctly (BOM for accents, ";" for French locales). */
const downloadCredentials = (rows: StudentListImportResult["credentials"], headers: [string, string, string, string]) => {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows.map((row) => [row.name, row.group, row.email, row.temporary_password])]
    .map((cells) => cells.map(escape).join(";"));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stagiaires-identifiants.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const StudentListImportDialog = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<StudentListImportPreview | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<StudentListImportResult | null>(null);
  const [tab, setTab] = useState<Tab>("groups");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => { setPortalRoot(document.body); }, []);

  const reset = () => {
    setFileName(""); setPreview(null); setExcluded(new Set()); setResult(null);
    setTab("groups"); setExpanded(null); setQuery("");
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
    mutationFn: (file: File) => api.previewStudentListImport(file),
    onSuccess: (response) => setPreview(response.data),
    onError: (error: Error) => toast({ title: t("studentListImport.readFailed"), description: error.message, variant: "destructive" }),
  });

  const commit = useMutation({
    mutationFn: () => api.commitStudentListImport(preview!.batch_id, Array.from(excluded)),
    onSuccess: (response) => {
      setResult(response.data);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error: Error) => toast({ title: t("studentListImport.saveFailed"), description: error.message, variant: "destructive" }),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    previewMutation.mutate(file);
  };

  const toggleGroup = (key: string) => setExcluded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Everything the footer and the stat cards report follows the groups left ticked.
  const summary = useMemo(() => {
    if (!preview) return null;
    const importable = preview.groups.filter((group) => group.status !== "archived");
    const included = importable.filter((group) => !excluded.has(group.key));
    const includedKeys = new Set(included.map((group) => group.key));
    const students = preview.students.filter((student) => includedKeys.has(student.group));
    return {
      importable,
      included,
      newGroups: included.filter((group) => group.status === "new"),
      archived: preview.groups.filter((group) => group.status === "archived"),
      students: students.length,
      created: students.filter((student) => student.status === "new").length,
      joining: students.filter((student) => student.status === "existing").length,
      existing: students.filter((student) => student.status !== "new").length,
    };
  }, [preview, excluded]);

  const groupNames = useMemo(() => new Map(preview?.groups.map((group) => [group.key, group.name]) ?? []), [preview]);
  const studentsByGroup = useMemo(() => {
    const map = new Map<string, StudentListImportStudent[]>();
    preview?.students.forEach((student) => map.set(student.group, [...(map.get(student.group) ?? []), student]));
    return map;
  }, [preview]);

  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!preview || !needle) return preview?.students ?? [];
    return preview.students.filter((student) =>
      `${student.last_name} ${student.first_name} ${student.cne} ${student.matricule} ${groupNames.get(student.group) ?? ""}`.toLowerCase().includes(needle));
  }, [preview, query, groupNames]);

  const allIncluded = !!summary && summary.importable.length > 0 && summary.included.length === summary.importable.length;
  const toggleAll = () => setExcluded(allIncluded ? new Set(summary!.importable.map((group) => group.key)) : new Set());

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
            role="dialog" aria-modal="true" aria-labelledby="student-list-import-title"
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
                  <h2 id="student-list-import-title" className="font-display font-bold text-xl leading-tight">{t("studentListImport.title")}</h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                    {result ? t("studentListImport.stepDone") : preview ? t("studentListImport.stepReview", { file: fileName }) : t("studentListImport.subtitle")}
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
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    className="sr-only"
                    onChange={(event) => { pick(event.target.files?.[0]); event.currentTarget.value = ""; }}
                  />
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="font-semibold">{t("studentListImport.reading", { file: fileName })}</p>
                      <p className="text-sm text-muted-foreground">{t("studentListImport.readingHint")}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <p className="font-semibold text-lg">{t("studentListImport.drop")}</p>
                      <p className="text-sm text-muted-foreground">{t("studentListImport.formats")}</p>
                    </>
                  )}
                </label>

                <div className="mt-7 grid sm:grid-cols-3 gap-3">
                  {[
                    { icon: Layers, title: t("studentListImport.whatGroups"), body: t("studentListImport.whatGroupsBody") },
                    { icon: Users, title: t("studentListImport.whatStudents"), body: t("studentListImport.whatStudentsBody") },
                    { icon: ShieldCheck, title: t("studentListImport.whatReview"), body: t("studentListImport.whatReviewBody") },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-xl border border-border bg-secondary/30 p-4">
                      <Icon className="w-5 h-5 text-primary mb-2" />
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{body}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-5">{t("studentListImport.columnsHint")}</p>
              </div>
            )}

            {/* ── Step 2: review ── */}
            {preview && summary && !result && (
              <>
                <div className="shrink-0 px-6 pt-5 pb-4 space-y-3 border-b border-border max-h-[45%] overflow-y-auto">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat icon={Users} label={t("studentListImport.statStudents")} value={summary.students}
                      detail={t("studentListImport.statStudentsDetail", { created: summary.created, existing: summary.existing })} />
                    <Stat icon={Layers} label={t("studentListImport.statGroups")} value={summary.included.length}
                      detail={t("studentListImport.statGroupsDetail", { created: summary.newGroups.length, existing: summary.included.length - summary.newGroups.length })} />
                    <Stat icon={Sparkles} label={t("studentListImport.statNewGroups")} value={summary.newGroups.length}
                      detail={t("studentListImport.statNewGroupsDetail", { year: preview.academic_year })} tone={summary.newGroups.length ? "success" : undefined} />
                    <Stat icon={AlertTriangle} label={t("studentListImport.statSkipped")} value={preview.skipped.length}
                      detail={t("studentListImport.statSkippedDetail")} tone={preview.skipped.length ? "warning" : undefined} />
                  </div>

                  {summary.newGroups.length > 0 ? (
                    <div className="rounded-xl border border-success/30 bg-success/[0.06] px-4 py-3">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-success shrink-0" />
                        {t("studentListImport.newGroupsTitle", { count: summary.newGroups.length })}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {summary.newGroups.map((group) => (
                          <span key={group.key} title={[group.degree, group.study_year, group.filiere].filter(Boolean).join(" · ")}
                            className="text-[11.5px] font-semibold px-2 py-0.5 rounded-md bg-card border border-success/30 mono-figure">
                            {group.name} <span className="text-muted-foreground font-medium">· {group.student_count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> {t("studentListImport.newGroupsNone")}
                    </p>
                  )}

                  {summary.joining > 0 && (
                    <p className="text-[13px] text-muted-foreground flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-px" /> {t("studentListImport.movedNotice", { count: summary.joining })}
                    </p>
                  )}
                  {summary.archived.length > 0 && (
                    <p className="text-[13px] flex items-start gap-2">
                      <Archive className="w-4 h-4 text-warning shrink-0 mt-px" />
                      {t("studentListImport.archivedNotice", { count: summary.archived.length, groups: summary.archived.map((group) => group.name).join(", ") })}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(["groups", "students", "skipped"] as Tab[])
                      .filter((key) => key !== "skipped" || preview.skipped.length > 0)
                      .map((key) => (
                        <button
                          key={key}
                          onClick={() => setTab(key)}
                          className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
                        >
                          {key === "groups" && t("studentListImport.tabGroups", { count: preview.groups.length })}
                          {key === "students" && t("studentListImport.tabStudents", { count: preview.students.length })}
                          {key === "skipped" && t("studentListImport.tabSkipped", { count: preview.skipped.length })}
                        </button>
                      ))}
                    {tab === "students" && (
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t("studentListImport.search")}
                        aria-label={t("studentListImport.search")}
                        className="input-glass h-9 sm:ml-auto sm:max-w-xs"
                      />
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {tab === "groups" && (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                        <tr>
                          <th className="th-label w-10">
                            <input type="checkbox" className="accent-primary" checked={allIncluded} aria-label={t("app.all")} onChange={toggleAll} />
                          </th>
                          <th className="th-label">{t("studentListImport.colGroup")}</th>
                          <th className="th-label hidden sm:table-cell">{t("studentListImport.colDiploma")}</th>
                          <th className="th-label hidden md:table-cell">{t("studentListImport.colFiliere")}</th>
                          <th className="th-label">{t("studentListImport.colStudents")}</th>
                          <th className="th-label">{t("studentListImport.colStatus")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.groups.map((group) => {
                          const archived = group.status === "archived";
                          const included = !archived && !excluded.has(group.key);
                          const isOpen = expanded === group.key;
                          return (
                            <Fragment key={group.key}>
                              <tr className={`border-b border-border/60 transition-colors ${included ? "" : "opacity-45"} ${isOpen ? "bg-secondary/40" : "hover:bg-secondary/25"}`}>
                                <td className="py-2.5 px-4">
                                  <input type="checkbox" className="accent-primary" checked={included} disabled={archived} aria-label={group.name}
                                    onChange={() => toggleGroup(group.key)} />
                                </td>
                                <td className="py-2.5 px-4">
                                  <button onClick={() => setExpanded(isOpen ? null : group.key)} aria-expanded={isOpen}
                                    className="font-semibold mono-figure text-[13px] hover:text-primary transition-colors inline-flex items-center gap-1">
                                    {group.name}
                                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                  </button>
                                </td>
                                <td className="py-2.5 px-4 hidden sm:table-cell text-muted-foreground">
                                  {[group.degree, group.study_year].filter(Boolean).join(" · ") || "—"}
                                </td>
                                <td className="py-2.5 px-4 hidden md:table-cell text-muted-foreground text-[13px] max-w-[18rem] truncate" title={group.filiere ?? ""}>{group.filiere ?? "—"}</td>
                                <td className="py-2.5 px-4">
                                  <span className="tabular-nums font-semibold">{group.student_count}</span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {t("studentListImport.studentsBreakdown", { created: group.new_students, existing: group.existing_students + group.unchanged_students })}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4">
                                  {group.status === "new" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">{t("studentListImport.groupNew")}</span>}
                                  {group.status === "existing" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t("studentListImport.groupExisting")}</span>}
                                  {archived && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning" title={t("studentListImport.groupArchivedHint")}>
                                      <Archive className="w-3 h-3" /> {t("studentListImport.groupArchived")}
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {isOpen && (
                                <tr className="border-b border-border/60 bg-secondary/40">
                                  <td />
                                  <td colSpan={5} className="px-4 pb-4 pt-1">
                                    <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                      {(studentsByGroup.get(group.key) ?? []).map((student, position) => (
                                        <li key={student.index} className="text-[13px] flex items-center gap-2 min-w-0">
                                          <span className="w-6 text-[11px] text-muted-foreground tabular-nums text-right shrink-0">{position + 1}</span>
                                          <span className="truncate">{student.last_name} {student.first_name}</span>
                                          {student.status !== "new" && <StudentBadge status={student.status} compact />}
                                        </li>
                                      ))}
                                    </ol>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {tab === "students" && (
                    <>
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                          <tr>
                            <th className="th-label">{t("studentListImport.colLastName")}</th>
                            <th className="th-label">{t("studentListImport.colFirstName")}</th>
                            <th className="th-label hidden sm:table-cell">{t("studentListImport.colIdentifier")}</th>
                            <th className="th-label">{t("studentListImport.colGroup")}</th>
                            <th className="th-label hidden md:table-cell">{t("studentListImport.colStatus")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleStudents.map((student) => (
                            <tr key={student.index} className={`border-b border-border/60 hover:bg-secondary/25 ${excluded.has(student.group) ? "opacity-45" : ""}`}>
                              <td className="py-2 px-4 font-medium">{student.last_name}</td>
                              <td className="py-2 px-4">{student.first_name}</td>
                              <td className="py-2 px-4 hidden sm:table-cell mono-figure text-[12.5px]" title={student.cin ? "" : t("studentListImport.matriculeHint")}>
                                {student.cne}{!student.cin && <span className="ml-1 text-muted-foreground">*</span>}
                              </td>
                              <td className="py-2 px-4 mono-figure text-[12.5px] font-semibold">{groupNames.get(student.group)}</td>
                              <td className="py-2 px-4 hidden md:table-cell">
                                <StudentBadge status={student.status} />
                                {student.status === "existing" && student.current_groups.length > 0 && (
                                  <span className="block text-[11px] text-muted-foreground mt-0.5 truncate max-w-[14rem]">
                                    {t("studentListImport.alsoIn", { groups: student.current_groups.join(", ") })}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {visibleStudents.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">{t("studentListImport.noMatch")}</p>}
                      {preview.students.some((student) => !student.cin) && (
                        <p className="px-4 py-3 text-[11.5px] text-muted-foreground">* {t("studentListImport.matriculeHint")}</p>
                      )}
                    </>
                  )}

                  {tab === "skipped" && (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                        <tr>
                          <th className="th-label w-20">{t("studentListImport.colRow")}</th>
                          <th className="th-label">{t("studentListImport.colName")}</th>
                          <th className="th-label hidden sm:table-cell">{t("studentListImport.colGroup")}</th>
                          <th className="th-label">{t("studentListImport.colReason")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.skipped.map((row) => (
                          <tr key={row.source_row} className="border-b border-border/60">
                            <td className="py-2 px-4 tabular-nums text-muted-foreground">{row.source_row}</td>
                            <td className="py-2 px-4 font-medium">{row.name || "—"}</td>
                            <td className="py-2 px-4 hidden sm:table-cell mono-figure text-[12.5px]">{row.group || "—"}</td>
                            <td className="py-2 px-4 text-warning text-[13px] font-medium">{t(`studentListImport.reason.${row.reason}`)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <footer className="shrink-0 px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/30">
                  <p className="text-[13px] text-muted-foreground">
                    {summary.included.length === 0
                      ? <span className="text-destructive font-medium">{t("studentListImport.nothingSelected")}</span>
                      : t("studentListImport.footerSummary", { students: summary.students, groups: summary.included.length, newGroups: summary.newGroups.length })}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={reset} disabled={commit.isPending}>{t("studentListImport.otherFile")}</Button>
                    <Button
                      onClick={() => commit.mutate()}
                      disabled={summary.included.length === 0 || commit.isPending}
                      className="btn-glow text-primary-foreground border-0 gap-2 min-w-[11rem]"
                    >
                      {commit.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("studentListImport.saving")}</> : t("studentListImport.confirm")}
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
                      <p className="font-display font-bold text-xl">{t("studentListImport.doneTitle")}</p>
                      <p className="text-muted-foreground mt-1">
                        {t("studentListImport.doneBody", {
                          created: result.students_created, added: result.students_added,
                          unchanged: result.students_unchanged, groups: result.groups_created,
                        })}
                      </p>
                    </div>
                  </div>

                  {result.groups_archived.length > 0 && (
                    <div className="rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-sm">
                      <p className="font-semibold flex items-center gap-2"><Archive className="w-4 h-4 text-warning" /> {t("studentListImport.archivedTitle")}</p>
                      <p className="text-muted-foreground mt-1">{t("studentListImport.archivedBody", { groups: result.groups_archived.join(", ") })}</p>
                    </div>
                  )}

                  {result.credentials.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="font-display font-semibold text-lg">{t("studentListImport.credentialsTitle")}</h3>
                          <p className="text-[13px] text-muted-foreground mt-0.5">{t("studentListImport.credentialsHint")}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                            const text = result.credentials.map((row) => `${row.name}\t${row.group}\t${row.email}\t${row.temporary_password}`).join("\n");
                            navigator.clipboard?.writeText(text).then(() => toast({ title: t("studentListImport.copied") }));
                          }}>
                            <Copy className="w-4 h-4" /> {t("studentListImport.copy")}
                          </Button>
                          <Button size="sm" className="gap-1.5 btn-glow text-primary-foreground border-0"
                            onClick={() => downloadCredentials(result.credentials, [t("studentListImport.colName"), t("studentListImport.colGroup"), t("auth.email"), t("studentListImport.colPassword")])}>
                            <Download className="w-4 h-4" /> {t("studentListImport.download")}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="max-h-[22rem] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-secondary">
                              <tr>
                                <th className="th-label">{t("studentListImport.colName")}</th>
                                <th className="th-label hidden sm:table-cell">{t("studentListImport.colGroup")}</th>
                                <th className="th-label">{t("auth.email")}</th>
                                <th className="th-label hidden md:table-cell">{t("studentListImport.colPassword")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.credentials.map((row) => (
                                <tr key={row.email} className="border-t border-border/60">
                                  <td className="py-2 px-4 font-medium">{row.name}</td>
                                  <td className="py-2 px-4 hidden sm:table-cell mono-figure text-[13px]">{row.group}</td>
                                  <td className="py-2 px-4 mono-figure text-[13px]">{row.email}</td>
                                  <td className="py-2 px-4 hidden md:table-cell mono-figure text-[13px]">{row.temporary_password}</td>
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
                  <Button onClick={close} className="btn-glow text-primary-foreground border-0">{t("studentListImport.finish")}</Button>
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

const StudentBadge = ({ status, compact }: { status: StudentListImportStudent["status"]; compact?: boolean }) => {
  const { t } = useTranslation();
  const style = status === "new" ? "bg-success/10 text-success" : status === "existing" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground";
  const label = status === "new" ? t("studentListImport.studentNew") : status === "existing" ? t("studentListImport.studentExisting") : t("studentListImport.studentUnchanged");
  return <span className={`inline-flex shrink-0 font-semibold rounded-full ${compact ? "text-[10px] px-1.5" : "text-[11px] px-2 py-0.5"} ${style}`}>{label}</span>;
};

const Stat = ({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Users; label: string; value: number; detail: string; tone?: "warning" | "success";
}) => (
  <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : ""}`} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
    </div>
    <p className="text-2xl font-display font-bold tabular-nums leading-tight mt-1">{value}</p>
    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{detail}</p>
  </div>
);

export default StudentListImportDialog;
