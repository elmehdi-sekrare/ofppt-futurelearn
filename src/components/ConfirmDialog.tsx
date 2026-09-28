import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title: string;
  description: string;
  variant?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const icons = {
  danger: <Trash2 className="w-6 h-6" />,
  warning: <AlertTriangle className="w-6 h-6" />,
  info: <Info className="w-6 h-6" />,
};

const colors = {
  danger: { bg: "bg-destructive/10", text: "text-destructive", btn: "bg-destructive hover:bg-red-600 text-white" },
  warning: { bg: "bg-warning/10", text: "text-warning", btn: "bg-warning hover:bg-yellow-600 text-black" },
  info: { bg: "bg-primary/10", text: "text-primary", btn: "btn-glow border-0 text-primary-foreground" },
};

const ConfirmDialog = ({
  open,
  title,
  description,
  variant = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: Props) => {
  const c = colors[variant];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel p-6 max-w-sm w-full mx-4 space-y-5"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center shrink-0 ${c.text}`}>
                {icons[variant]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
              </div>
              <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onCancel} className="border-border" disabled={loading}>
                {cancelLabel}
              </Button>
              <Button onClick={onConfirm} className={c.btn} disabled={loading}>
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
                  />
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmDialog;
