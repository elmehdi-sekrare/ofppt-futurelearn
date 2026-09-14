import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, ShieldCheck, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const AuditLogPage = () => {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["audit-logs"], queryFn: () => api.getAuditLogs() });
  const logs = data?.data ?? [];
  const filtered = useMemo(() => logs.filter((log) => `${log.actor_name} ${log.event} ${log.description}`.toLowerCase().includes(search.toLowerCase())), [logs, search]);

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-10 w-52" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  return <div className="space-y-6">
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><h1 className="text-2xl font-display font-bold">Audit Trail</h1><p className="text-muted-foreground text-sm mt-1">A permanent record of attendance and justification decisions.</p></div><div className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 text-primary" /> Admin-only access</div></motion.div>
    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actions, people, or events..." className="input-glass" />
    {isError ? <div className="glass-panel p-8 text-center text-destructive">Could not load the audit trail.</div> : <div className="glass-panel divide-y divide-border/50">{filtered.map((log) => <div key={log.id} className="p-4 flex gap-3"><div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><History className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><p className="text-sm font-medium">{log.description}</p><time className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("fr-FR")}</time></div><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><UserRound className="w-3 h-3" />{log.actor_name} {log.actor_role ? `· ${log.actor_role}` : ""} · {log.event}</p></div></div>)}{!filtered.length && <div className="p-12 text-center text-muted-foreground">No audit records match your search.</div>}</div>}
  </div>;
};

export default AuditLogPage;
