import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, Ban, X, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Absence } from "@/types/api";

export type ResolveAction = "justified" | "unjustified" | "voided";

interface Props {
  absence: Absence | null;
  action: ResolveAction | null;
  loading?: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

const TONE: Record<ResolveAction, { icon: typeof Check; badge: string; button: string }> = {
  justified: { icon: Check, badge: "bg-success/10 text-success", button: "bg-success hover:bg-success/90 text-success-foreground" },
  unjustified: { icon: Ban, badge: "bg-destructive/10 text-destructive", button: "bg-destructive hover:bg-destructive/90 text-destructive-foreground" },
  voided: { icon: X, badge: "bg-secondary text-muted-foreground", button: "bg-foreground hover:bg-foreground/90 text-background" },
};

/**
 * Records an administrative decision on an absence. Replaces window.prompt:
 * shows what is being decided, offers common notes, and requires one.
 */
const ResolveAbsenceDialog = ({ absence, action, loading, onConfirm, onCancel }: Props) => {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const open = !!absence && !!action;
  // Parents pass inline callbacks; a ref keeps the reset effect from re-running on every render.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    setNote("");
    setTouched(false);
    const id = window.setTimeout(() => fieldRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const presets: string[] = action ? (t(`resolve.presets.${action}`, { returnObjects: true }) as string[]) : [];
  const tone = action ? TONE[action] : TONE.justified;
  const Icon = tone.icon;
  const invalid = touched && !note.trim();

  const submit = () => {
    setTouched(true);
    if (note.trim()) onConfirm(note.trim());
  };

  return createPortal(
    <AnimatePresence>
      {open && absence && action && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-foreground/25 backdrop-blur-[2px] p-4"
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-title"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-[var(--shadow-raised)] overflow-hidden"
          >
            <header className="px-6 pt-6 pb-4 flex items-start gap-3.5">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.badge}`}>
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="resolve-title" className="font-display font-semibold text-lg leading-tight">{t(`resolve.title.${action}`)}</h2>
                <p className="text-[13px] text-muted-foreground mt-1">{t(`resolve.hint.${action}`)}</p>
              </div>
              <button onClick={onCancel} aria-label={t("app.close")} className="p-1.5 -mr-1.5 -mt-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="mx-6 rounded-xl bg-secondary/60 border border-border/70 px-4 py-3">
              <p className="font-medium">{absence.student_name}</p>
              <p className="text-[12.5px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{absence.date}</span>
                <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="w-3.5 h-3.5" />{absence.start_time} – {absence.end_time} · {absence.hours}h</span>
                <span>{absence.subject} · {absence.group_name}</span>
              </p>
            </div>

            <div className="px-6 pt-5">
              <label htmlFor="resolve-note" className="text-sm font-medium">{t("resolve.noteLabel")}</label>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setNote(p); fieldRef.current?.focus(); }}
                      className={`px-2.5 py-1 rounded-md text-[12.5px] border transition-colors ${
                        note === p ? "border-primary/50 bg-primary/[0.07] text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                id="resolve-note"
                ref={fieldRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
                rows={3}
                maxLength={500}
                aria-invalid={invalid}
                aria-describedby={invalid ? "resolve-error" : undefined}
                placeholder={t("resolve.notePlaceholder")}
                className={`input-glass mt-2.5 w-full rounded-lg border px-3 py-2.5 text-sm resize-none ${invalid ? "border-destructive/60" : ""}`}
              />
              <div className="flex justify-between mt-1.5 text-[11.5px]">
                <span id="resolve-error" className="text-destructive">{invalid ? t("resolve.noteRequired") : ""}</span>
                <span className="text-muted-foreground tabular-nums">{note.length}/500</span>
              </div>
            </div>

            <footer className="px-6 py-4 mt-3 border-t border-border bg-secondary/30 flex items-center justify-between gap-3">
              <span className="hidden sm:block text-[11.5px] text-muted-foreground">{t("resolve.shortcut")}</span>
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" onClick={onCancel}>{t("app.cancel")}</Button>
                <Button onClick={submit} disabled={loading} className={`gap-1.5 border-0 ${tone.button}`}>
                  <Icon className="w-4 h-4" /> {loading ? t("app.saving") : t(`resolve.confirm.${action}`)}
                </Button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ResolveAbsenceDialog;
