import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck, ClipboardCheck, CheckCircle2, XCircle, Ban, AlertTriangle, FileUp, History, ChevronDown, Quote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import SearchField from "@/components/SearchField";
import { getDateLocale } from "@/i18n/i18n";
import type { AuditLog } from "@/types/api";

type Category = "all" | "attendance" | "decisions" | "alerts" | "imports" | "other";

const EASE = [0.22, 1, 0.36, 1] as const;

const categoryOf = (event: string): Exclude<Category, "all"> =>
  event === "attendance.marked" ? "attendance"
  : event.startsWith("absence.") ? "decisions"
  : event === "attendance.risk_alert" ? "alerts"
  : event.endsWith(".imported") ? "imports"
  : "other";

const EVENT_STYLE: Record<string, { icon: typeof History; tone: string }> = {
  "attendance.marked": { icon: ClipboardCheck, tone: "bg-primary/[0.09] text-primary" },
  "absence.justified": { icon: CheckCircle2, tone: "bg-success/10 text-success" },
  "absence.unjustified": { icon: XCircle, tone: "bg-destructive/[0.09] text-destructive" },
  "absence.voided": { icon: Ban, tone: "bg-secondary text-muted-foreground" },
  "attendance.risk_alert": { icon: AlertTriangle, tone: "bg-warning/[0.12] text-warning" },
  "students.imported": { icon: FileUp, tone: "bg-accent/10 text-accent" },
};
const styleOf = (event: string) => EVENT_STYLE[event] ?? { icon: History, tone: "bg-secondary text-muted-foreground" };

/** "X marked Y as present for Module." → "Module" */
const subjectOf = (description: string) => description.match(/ for (.+?)\.?$/)?.[1] ?? "";

type Entry =
  | { kind: "single"; id: string; log: AuditLog }
  | { kind: "session"; id: string; logs: AuditLog[]; subject: string };

/**
 * Roll calls are logged one line per student. Consecutive lines from the same
 * teacher for the same module within 30 minutes read as one session.
 */
const collapse = (logs: AuditLog[]): Entry[] => {
  const out: Entry[] = [];
  for (const log of logs) {
    const prev = out[out.length - 1];
    if (log.event === "attendance.marked" && prev?.kind === "session") {
      const last = prev.logs[prev.logs.length - 1];
      const sameActor = last.actor_name === log.actor_name;
      const sameSubject = prev.subject === subjectOf(log.description);
      const close = Math.abs(new Date(last.created_at).getTime() - new Date(log.created_at).getTime()) < 30 * 60_000;
      if (sameActor && sameSubject && close) { prev.logs.push(log); continue; }
    }
    out.push(log.event === "attendance.marked"
      ? { kind: "session", id: `s-${log.id}`, logs: [log], subject: subjectOf(log.description) }
      : { kind: "single", id: `l-${log.id}`, log });
  }
  return out;
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const AuditLogPage = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError } = useQuery({ queryKey: ["audit-logs"], queryFn: () => api.getAuditLogs(250) });
  const logs = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: logs.length, attendance: 0, decisions: 0, alerts: 0, imports: 0, other: 0 };
    logs.forEach((l) => { c[categoryOf(l.event)] += 1; });
    return c;
  }, [logs]);

  const days = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = logs.filter((l) =>
      (category === "all" || categoryOf(l.event) === category) &&
      (!q || `${l.actor_name} ${l.event} ${l.description}`.toLowerCase().includes(q))
    );
    const byDay = new Map<string, AuditLog[]>();
    filtered.forEach((l) => {
      const key = new Date(l.created_at).toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), l]);
    });
    return Array.from(byDay.entries()).map(([key, list]) => ({ key, date: new Date(list[0].created_at), entries: collapse(list) }));
  }, [logs, search, category]);

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const dayLabel = (d: Date) =>
    d.toDateString() === today ? t("audit.today")
    : d.toDateString() === yesterday ? t("audit.yesterday")
    : d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const full = (iso: string) => new Date(iso).toLocaleString(locale);
  const roleLabel = (role?: string | null) => role ? t(`layout.role${role.charAt(0).toUpperCase()}${role.slice(1)}`, role) : t("audit.system");
  const eventLabel = (event: string) => t(`audit.events.${event.replace(/\./g, "_")}`, event);

  const todayCount = logs.filter((l) => new Date(l.created_at).toDateString() === today).length;
  const actors = new Set(logs.map((l) => l.actor_name)).size;

  const CATEGORIES: Category[] = ["all", "attendance", "decisions", "alerts", "imports", "other"];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1100px]">
        <Skeleton className="h-24 w-72" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-7 max-w-[1100px]">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <div>
          <p className="eyebrow">{t("nav.audit")}</p>
          <h1 className="page-title mt-2.5">{t("audit.heading")}</h1>
          <span className="brand-rule" />
          <p className="text-muted-foreground mt-4 max-w-[56ch]">{t("audit.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground shrink-0 px-3 py-1.5 rounded-lg border border-border bg-card/70">
          <ShieldCheck className="w-4 h-4 text-primary" /> {t("audit.adminOnly")}
        </span>
      </motion.header>

      <dl className="glass-panel grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
        {[
          { label: t("audit.statEvents"), value: logs.length },
          { label: t("audit.statToday"), value: todayCount },
          { label: t("audit.statDecisions"), value: counts.decisions },
          { label: t("audit.statActors"), value: actors },
        ].map((s, i) => (
          <div key={s.label} className={`px-5 py-4 ${i % 2 === 1 ? "border-l border-border/80" : ""} ${i >= 2 ? "border-t sm:border-t-0 border-border/80" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{s.label}</dt>
            <dd className="mt-1.5 font-display font-bold text-[1.75rem] leading-none tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3">
        <SearchField value={search} onChange={setSearch} placeholder={t("audit.searchPlaceholder")} />
        <div role="tablist" aria-label={t("audit.filterLabel")} className="flex flex-wrap gap-1.5">
          {CATEGORIES.filter((c) => c === "all" || counts[c] > 0).map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                  active ? "bg-foreground text-background border-foreground" : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-foreground/25"
                }`}
              >
                {t(`audit.category.${c}`)}
                <span className="tabular-nums opacity-60">{counts[c]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isError ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-sm font-medium text-destructive">{t("audit.loadFailed")}</p>
        </div>
      ) : !days.length ? (
        <div className="glass-panel p-14 text-center">
          <History className="w-9 h-9 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("audit.noMatch")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day, di) => (
            <motion.section
              key={day.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(di, 6) * 0.05, duration: 0.35, ease: EASE }}
            >
              <h2 className="flex items-baseline gap-3 mb-3 px-1">
                <span className="font-display font-semibold text-[15px] first-letter:uppercase">{dayLabel(day.date)}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">{t("audit.entries", { count: day.entries.length })}</span>
              </h2>

              <ol className="glass-panel divide-y divide-border/60 overflow-hidden">
                {day.entries.map((entry) => {
                  const head = entry.kind === "single" ? entry.log : entry.logs[0];
                  const { icon: Icon, tone } = styleOf(head.event);
                  const isOpen = !!open[entry.id];
                  const note = entry.kind === "single" ? (entry.log.metadata?.note as string | undefined) : undefined;
                  const meta = entry.kind === "single" ? entry.log.metadata ?? {} : {};
                  const breakdown = entry.kind === "session"
                    ? entry.logs.reduce<Record<string, number>>((acc, l) => {
                        const k = String(l.metadata?.attendance_status ?? "present");
                        acc[k] = (acc[k] ?? 0) + 1;
                        return acc;
                      }, {})
                    : null;

                  return (
                    <li key={entry.id} className="px-5 py-4 flex gap-4">
                      <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                          <p className="font-medium leading-snug">
                            {entry.kind === "session"
                              ? t("audit.sessionTitle", { count: entry.logs.length, subject: entry.subject || "—" })
                              : eventLabel(head.event)}
                          </p>
                          <time dateTime={head.created_at} title={full(head.created_at)} className="text-[12px] text-muted-foreground whitespace-nowrap tabular-nums">
                            {time(head.created_at)}
                          </time>
                        </div>

                        {entry.kind === "single" && (
                          <p className="text-[13.5px] text-muted-foreground mt-0.5">{entry.log.description}</p>
                        )}

                        {breakdown && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.entries(breakdown).map(([k, n]) => (
                              <span key={k} className="text-[11.5px] px-1.5 py-0.5 rounded bg-secondary text-foreground/80 tabular-nums">
                                {n} {t(`audit.status.${k}`, k)}
                              </span>
                            ))}
                          </div>
                        )}

                        {note && (
                          <p className="mt-2 flex gap-2 text-[13px] text-foreground/80 border-l-2 border-border pl-3">
                            <Quote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="italic">{note}</span>
                          </p>
                        )}

                        {head.event === "students.imported" && (
                          <p className="mt-2 text-[12px] text-muted-foreground tabular-nums">
                            {t("audit.importMeta", { created: meta.created ?? 0, updated: meta.updated ?? 0, skipped: meta.skipped ?? 0 })}
                          </p>
                        )}

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground min-w-0">
                            <span className="w-5 h-5 rounded-md bg-secondary text-[9.5px] font-bold text-foreground/70 flex items-center justify-center shrink-0">
                              {initialsOf(head.actor_name)}
                            </span>
                            <span className="truncate">{head.actor_name} · {roleLabel(head.actor_role)}</span>
                          </span>
                          {entry.kind === "session" && (
                            <button
                              onClick={() => setOpen((o) => ({ ...o, [entry.id]: !isOpen }))}
                              aria-expanded={isOpen}
                              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary shrink-0 hover:underline underline-offset-4"
                            >
                              {isOpen ? t("audit.hideDetail") : t("audit.showDetail")}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </div>

                        <AnimatePresence initial={false}>
                          {entry.kind === "session" && isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <ul className="mt-3 rounded-lg border border-border/70 bg-secondary/30 divide-y divide-border/50 max-h-72 overflow-y-auto">
                                {entry.logs.map((l) => (
                                  <li key={l.id} className="px-3 py-2 flex justify-between gap-3 text-[12.5px]">
                                    <span className="text-foreground/85 truncate">{l.description}</span>
                                    <time className="text-muted-foreground tabular-nums shrink-0">{time(l.created_at)}</time>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
