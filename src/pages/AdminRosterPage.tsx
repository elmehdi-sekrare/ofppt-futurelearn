import { useState } from "react";
import { FileUp, UsersRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { StyledSelect } from "@/components/ui/styled-select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { StudentImportRow } from "@/types/api";

type ImportRow = StudentImportRow & { action: "import" | "update" | "skip" };

const AdminRosterPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const { data: groupsRes } = useQuery({ queryKey: ["groups"], queryFn: api.getGroups });
  const groups = (groupsRes?.data ?? []).filter((group) => (group.status ?? "active") === "active");

  const preview = useMutation({
    mutationFn: (file: File) => api.previewStudentImport(groupId!, file),
    onSuccess: (response) => {
      setBatchId(response.data.batch_id);
      setRows(response.data.rows.map((row) => ({ ...row, action: row.status === "new" ? "import" : "skip" })));
    },
    onError: (error: Error) => toast({ title: "Import preview failed", description: error.message, variant: "destructive" }),
  });

  const commit = useMutation({
    mutationFn: () => api.commitStudentImport(batchId!, rows.map(({ index, action, first_name, last_name }) => ({ index, action, first_name, last_name }))),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-students", groupId] });
      setRows([]); setBatchId(null);
      toast({ title: "Roster saved", description: `${response.data.created} new, ${response.data.updated} existing students added, ${response.data.skipped} skipped.` });
    },
    onError: (error: Error) => toast({ title: "Import could not be saved", description: error.message, variant: "destructive" }),
  });

  const updateRow = (index: number, update: Partial<ImportRow>) => setRows((current) => current.map((row) => row.index === index ? { ...row, ...update } : row));
  const importable = rows.some((row) => row.action !== "skip" && row.status !== "invalid");

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-display font-bold">Manage Group Rosters</h1><p className="text-sm text-muted-foreground mt-1">Import students once, then share the group with any teacher.</p></div>
    <section className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2"><FileUp className="w-5 h-5 text-primary" /><h2 className="font-semibold">Import students into a group</h2></div>
      <p className="text-xs text-muted-foreground">Accepted files: CSV, XLSX, or table-based DOCX. Existing CNE/CIN records are reused and never duplicated.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <StyledSelect value={groupId ? String(groupId) : ""} onValueChange={(value) => { setGroupId(value ? Number(value) : null); setRows([]); setBatchId(null); }} placeholder="Select a group" options={groups.map((group) => ({ label: `${group.name} (${group.student_count} students)`, value: String(group.id) }))} />
        <Input type="file" accept=".csv,.xlsx,.docx" disabled={!groupId || preview.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file && groupId) preview.mutate(file); event.currentTarget.value = ""; }} className="input-glass file:mr-3 file:border-0 file:bg-transparent" />
      </div>
    </section>
    {rows.length > 0 && <section className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-border"><h2 className="font-semibold">Review import</h2><p className="text-xs text-muted-foreground mt-1">Existing students will be attached to this group without creating another account.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-secondary/30 text-left"><th className="p-3">Row</th><th className="p-3">First name</th><th className="p-3">Last name</th><th className="p-3">CIN/CNE</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.index} className="border-b border-border/50"><td className="p-3">{row.source_row}</td><td className="p-2"><Input value={row.first_name} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { first_name: event.target.value })} className="h-8 input-glass" /></td><td className="p-2"><Input value={row.last_name} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { last_name: event.target.value })} className="h-8 input-glass" /></td><td className="p-3 font-mono text-xs">{row.cne}</td><td className="p-3 text-xs">{row.message || row.status.replace("_", " ")}</td><td className="p-2"><select value={row.action} disabled={row.status === "invalid"} onChange={(event) => updateRow(row.index, { action: event.target.value as ImportRow["action"] })} className="h-8 rounded-md border border-border bg-background px-2 text-xs"><option value="import">Add to group</option><option value="skip">Skip</option></select></td></tr>)}</tbody></table></div>
      <div className="p-4 flex justify-end"><Button onClick={() => commit.mutate()} disabled={!batchId || !importable || commit.isPending} className="btn-glow border-0">{commit.isPending ? "Saving..." : "Confirm import"}</Button></div>
    </section>}
    <section className="glass-panel p-5 flex items-center gap-3"><UsersRound className="w-5 h-5 text-primary" /><p className="text-sm text-muted-foreground">Assign teachers to groups from the Teachers page. Teachers can view assigned rosters and record attendance only.</p></section>
  </div>;
};

export default AdminRosterPage;