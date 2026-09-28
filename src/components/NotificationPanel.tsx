import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2, X, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  info: { icon: <Info className="w-4 h-4" />, color: "text-primary bg-primary/10" },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-warning bg-warning/10" },
  success: { icon: <CheckCircle className="w-4 h-4" />, color: "text-success bg-success/10" },
  error: { icon: <XCircle className="w-4 h-4" />, color: "text-destructive bg-destructive/10" },
};

const NotificationPanel = () => {
  const [open, setOpen] = useState(false);
  const { notifications, fetchNotifications, markAsRead, markAllRead, clearAll, unreadCount } = useNotificationStore();
  const count = unreadCount();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Find the closest themed ancestor (the div with .light class or root)
    setPortalRoot(document.getElementById("root"));
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const dropdown = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed right-4 top-16 w-[360px] max-h-[480px] rounded-xl overflow-hidden flex flex-col border border-border bg-card"
            style={{ zIndex: 9999, boxShadow: "0 16px 48px -8px rgba(0,0,0,0.5)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <div>
                <h3 className="font-display font-semibold text-sm">Notifications</h3>
                <p className="text-xs text-muted-foreground">{count} unread</p>
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button onClick={() => markAllRead()} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Mark all read">
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => clearAll()} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Clear all">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-card">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((n) => {
                    const config = typeConfig[n.type];
                    return (
                      <div
                        key={n.id}
                        className={`p-4 hover:bg-secondary/20 transition-colors cursor-pointer bg-card ${!n.read ? "border-l-2 border-l-primary" : ""}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                              {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{formatTime(n.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full"
          >
            {count}
          </motion.span>
        )}
      </button>

      {portalRoot ? createPortal(dropdown, portalRoot) : dropdown}
    </div>
  );
};

export default NotificationPanel;
