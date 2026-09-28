import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { History, ShieldCheck, UserRound, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDateLocale } from "@/i18n/i18n";

const AuditLogPage = () => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["audit-logs"], queryFn: () => api.getAuditLogs() });
  const logs = data?.data ?? [];

  const filtered = useMemo(
    () => logs.filter((log) => `${log.actor_name} ${log.event} ${log.description}`.toLowerCase().includes(search.toLowerCase())),
    [logs, search]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <p className="eyebrow">{t("nav.audit")}</p>
          <h1 className="page-title mt-2.5">{t("audit.heading")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4 max-w-[56ch]">{t("audit.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" /> {t("audit.adminOnly")}
        </span>
      </motion.header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("audit.searchPlaceholder")}
          aria-label={t("audit.searchPlaceholder")}
          className="input-glass pl-10"
        />
      </div>

      {isError ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-sm font-medium text-destructive">{t("audit.loadFailed")}</p>
        </div>
      ) : (
        <div className="glass-panel divide-y divide-border/60 overflow-hidden">
          {filtered.map((log) => (
            <article key={log.id} className="p-4 flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <p className="text-sm font-medium">{log.description}</p>
                  <time dateTime={log.created_at} className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(log.created_at).toLocaleString(getDateLocale(i18n.language))}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <UserRound className="w-3 h-3 shrink-0" />
                  {log.actor_name}{log.actor_role ? ` · ${log.actor_role}` : ""} · {log.event}
                </p>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <div className="p-14 text-center">
              <History className="w-9 h-9 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("audit.noMatch")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
