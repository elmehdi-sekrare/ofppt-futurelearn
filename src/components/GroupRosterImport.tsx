import { useState, useImperativeHandle, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { FileUp, FileCheck2, X, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { StudentImportRow } from "@/types/api";

type ImportRow = StudentImportRow & { action: "import" | "update" | "skip" };

export interface GroupRosterImportHandle {
  /** Upload the staged file into the given group, then commit every valid row. */
  runDeferredImport: (groupId: number) => Promise<{ created: number; updated: number; skipped: number } | null>;
  hasStagedFile: () => boolean;
  reset: () => void;
}

interface Props {
  /** Existing group to import into. Omit while creating a group: the file is staged instead. */
  groupId?: number | null;
  /** Hides the review table and only stages the file (used inside the create-group dialog). */
  deferred?: boolean;
  onImported?: (result: { created: number; updated: number; skipped: number }) => void;
}

const GroupRosterImport = forwardRef<GroupRosterImportHandle, Props>(({ groupId, deferred = false, onImported }, ref) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [running, setRunning] = useState(false);

  const reset = () => { setStagedFile(null); setBatchId(null); setRows([]); setRunning(false); };

  const preview = useMutation({
    mutationFn: (file: File) => api.previewStudentImport(groupId!, file),
    onSuccess: (response) => {
      setBatchId(response.data.batch_id);
      setRows(response.data.rows.map((row) => ({ ...row, action: row.status === "new" ? "import" : "skip" })));
    },
    onError: (error: Error) => toast({ title: t("groupsPage.previewFailed"), description: error.message, variant: "destructive" }),
  });

  const commit = useMutation({
    mutationFn: () => api.commitStudentImport(batchId!, rows.map(({ index, action, first_name, last_name }) => ({ index, action, first_name, last_name }))),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["group-students", groupId] });
      reset();
      onImported?.(response.data);
      toast({ title: t("groupsPage.rosterSaved"), description: t("groupsPage.rosterSavedDesc", { created: response.data.created, updated: response.data.updated, skipped: response.data.skipped }) });
    },
    onError: (error: Error) => toast({ title: t("groupsPage.importFailed"), description: error.message, variant: "destructive" }),
  });

  useImperativeHandle(ref, () => ({
    hasStagedFile: () => !!stagedFile,
    reset,
    // Runs after the new group exists: preview against it, then import every valid row.
    runDeferredImport: async (newGroupId: number) => {
      if (!stagedFile) return null;
      setRunning(true);
      try {
        const previewResponse = await api.previewStudentImport(newGroupId, stagedFile);
        const staged = previewResponse.data.rows.map((row) => ({
          index: row.index,
          action: (row.status === "invalid" || row.status === "duplicate_locked" ? "skip" : "import") as ImportRow["action"],
          first_name: row.first_name,
          last_name: row.last_name,
        }));
        const result = await api.commitStudentImport(previewResponse.data.batch_id, staged);
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["students"] });
        reset();
        return result.data;
      } finally {
        setRunning(false);
      }
    },
  }), [stagedFile, queryClient]);

  const updateRow = (index: number, update: Partial<ImportRow>) => setRows((current) => current.map((row) => row.index === index ? { ...row, ...update } : row));
  const importable = rows.some((row) => row.action !== "skip" && row.status !== "invalid");

  if (deferred) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("groupsPage.studentList")}</label>
        {stagedFile ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 className="w-4 h-4 text-success shrink-0" />
              <span className="text-sm truncate">{stagedFile.name}</span>
            </div>
            <button type="button" onClick={() => setStagedFile(null)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground shrink-0" aria-label={t("groupsPage.removeFile")}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Input
            type="file"
            accept=".csv,.xlsx,.docx"
            onChange={(event) => { setStagedFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}
            className="input-glass file:mr-3 file:border-0 file:bg-transparent"
          />
        )}
        <p className="text-xs text-muted-foreground">
          {running ? t("groupsPage.importing") : t("groupsPage.studentListHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><FileUp className="w-4 h-4 text-primary" /><p className="text-sm font-medium">{t("groupsPage.importTitle")}</p></div>
      <Input
        type="file"
        accept=".csv,.xlsx,.docx"
        disabled={!groupId || preview.isPending}
        onChange={(event) => { const file = event.target.files?.[0]; if (file && groupId) preview.mutate(file); event.currentTarget.value = ""; }}
        className="input-glass file:mr-3 file:border-0 file:bg-transparent"
      />
      <p className="text-xs text-muted-foreground">{t("groupsPage.importHint")}</p>

      {preview.isPending && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("groupsPage.reading")}</p>}

      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="p-3 border-b border-border bg-secondary/30">
            <p className="text-sm font-medium">{t("groupsPage.reviewTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("groupsPage.reviewHint")}</p>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-left text-muted-foreground">
                  <th className="p-2.5 font-medium">{t("groupsPage.rowNumber")}</th>
                  <th className="p-2.5 font-medium">{t("students.firstName")}</th>
                  <th className="p-2.5 font-medium">{t("students.lastName")}</th>
                  <th className="p-2.5 font-medium">{t("students.cne")}</th>
                  <th className="p-2.5 font-medium">{t("groupsPage.statusCol")}</th>
                  <th className="p-2.5 font-medium">{t("groupsPage.actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index} className="border-b border-border/50">
                    <td className="p-2.5">{row.source_row}</td>
                    <td className="p-1.5"><Input value={row.first_name} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { first_name: event.target.value })} className="h-8 input-glass" /></td>
                    <td className="p-1.5"><Input value={row.last_name} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { last_name: event.target.value })} className="h-8 input-glass" /></td>
                    <td className="p-2.5 mono-figure text-xs">{row.cne}</td>
                    <td className="p-2.5 text-xs">{row.message || row.status.replace("_", " ")}</td>
                    <td className="p-1.5">
                      <select value={row.action} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { action: event.target.value as ImportRow["action"] })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                        <option value="import">{t("groupsPage.addToGroup")}</option>
                        <option value="skip">{t("groupsPage.skip")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex justify-end gap-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={reset}>{t("app.cancel")}</Button>
            <Button size="sm" onClick={() => commit.mutate()} disabled={!batchId || !importable || commit.isPending} className="btn-glow border-0">
              {commit.isPending ? t("app.saving") : t("groupsPage.confirmImport")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

GroupRosterImport.displayName = "GroupRosterImport";

export default GroupRosterImport;
