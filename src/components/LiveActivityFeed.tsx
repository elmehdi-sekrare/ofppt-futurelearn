import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Activity, Clock, FileCheck, AlertTriangle, UserMinus, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { getDateLocale } from "@/i18n/i18n";
import { Skeleton } from "@/components/ui/skeleton";

interface FeedEvent {
  id: string;
  type: "absence" | "justification_submitted" | "justification_approved" | "justification_rejected";
  title: string;
  description: string;
  time: string;
  icon: JSX.Element;
  color: string;
}

const LiveActivityFeed = () => {
  const { t, i18n } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(5);
  const [pulse, setPulse] = useState(false);

  const { data: absencesRes, isLoading: loadingAbs } = useQuery({
    queryKey: ["absences"],
    queryFn: () => api.getAbsences({ limit: 20, sort: "latest" }),
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const { data: justRes, isLoading: loadingJust } = useQuery({
    queryKey: ["justifications"],
    queryFn: () => api.getJustifications(),
    refetchInterval: 30000,
  });

  // Pulse effect on refetch
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1500);
    return () => clearTimeout(t);
  }, [absencesRes, justRes]);

  const events = useMemo<FeedEvent[]>(() => {
    const items: FeedEvent[] = [];

    const absences = absencesRes?.data ?? [];
    const justifications = justRes?.data ?? [];

    absences.forEach((a) => {
      items.push({
        id: `abs-${a.id}`,
        type: "absence",
        title: t("feed.absenceRecorded"),
        description: `${a.student_name} · ${a.subject} · ${a.hours}h`,
        time: a.date,
        icon: <UserMinus className="w-3.5 h-3.5" />,
        color: "text-destructive",
      });
    });

    justifications.forEach((j) => {
      if (j.status === "pending") {
        items.push({
          id: `just-sub-${j.id}`,
          type: "justification_submitted",
          title: t("feed.justificationSubmitted"),
          description: `${j.student_name} · ${j.reason.slice(0, 40)}...`,
          time: j.submitted_at,
          icon: <FileCheck className="w-3.5 h-3.5" />,
          color: "text-primary",
        });
      } else if (j.status === "approved") {
        items.push({
          id: `just-app-${j.id}`,
          type: "justification_approved",
          title: t("feed.justificationApproved"),
          description: `${j.student_name} · ${j.hours}h justified`,
          time: j.submitted_at,
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          color: "text-success",
        });
      } else if (j.status === "rejected") {
        items.push({
          id: `just-rej-${j.id}`,
          type: "justification_rejected",
          title: t("feed.justificationRejected"),
          description: `${j.student_name} · ${j.reason.slice(0, 40)}...`,
          time: j.submitted_at,
          icon: <XCircle className="w-3.5 h-3.5" />,
          color: "text-warning",
        });
      }
    });

    // Sort by time descending
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return items;
  }, [absencesRes, justRes]);

  const isLoading = loadingAbs || loadingJust;

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t("feed.justNow");
    if (diffMins < 60) return t("feed.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("feed.hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("feed.daysAgo", { count: diffDays });
    return d.toLocaleDateString(getDateLocale(i18n.language), { day: "numeric", month: "short" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-panel overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-primary/[0.09] flex items-center justify-center transition-all ${pulse ? "scale-110" : ""}`}>
            <Activity className={`w-5 h-5 text-primary transition-transform ${pulse ? "scale-110" : ""}`} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg leading-tight">{t("feed.title")}</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">{t("feed.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-success ${pulse ? "animate-ping" : "animate-pulse"}`} />
          <span className="text-[10px] text-muted-foreground">{t("feed.autoRefresh")}</span>
        </div>
      </div>

      {/* Events */}
      <div className="px-5 pb-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground">{t("feed.empty")}</p>
          </div>
        ) : (
          <>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />

              <AnimatePresence>
                {events.slice(0, visibleCount).map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative flex items-start gap-3 py-2 group"
                  >
                    {/* Timeline dot */}
                    <div className={`relative z-10 w-[30px] h-[30px] rounded-full bg-secondary border border-border/50 flex items-center justify-center shrink-0 ${event.color} group-hover:scale-110 transition-transform`}>
                      {event.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{event.title}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(event.time)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{event.description}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {events.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + 5)}
                className="w-full mt-3 py-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1 rounded-lg hover:bg-secondary/50"
              >
                <AlertTriangle className="w-3 h-3" />
                Show {Math.min(5, events.length - visibleCount)} more events
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default LiveActivityFeed;
