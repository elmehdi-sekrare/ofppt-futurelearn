import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, XCircle, X } from "lucide-react";
import { useNotificationStore, type Notification } from "@/stores/notificationStore";

const iconMap = {
  info: <Info className="w-5 h-5 text-blue-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  success: <CheckCircle className="w-5 h-5 text-green-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
};

const borderMap = {
  info: "border-l-blue-400",
  warning: "border-l-yellow-400",
  success: "border-l-green-400",
  error: "border-l-red-400",
};

const NotificationPopup = () => {
  const { fetchNotifications, notifications, markAsRead } = useNotificationStore();
  const [popups, setPopups] = useState<Notification[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch on mount, then poll so new notifications (e.g. a justification
  // decision) appear without a manual page reload.
  useEffect(() => {
    fetchNotifications().then(() => setHasFetched(true));
    const interval = setInterval(() => {
      fetchNotifications();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // After fetch, queue unread notifications as popups
  useEffect(() => {
    if (!hasFetched) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    // Show max 5 popups, staggered
    const toShow = unread.slice(0, 5);
    toShow.forEach((n, i) => {
      setTimeout(() => {
        setPopups((prev) => {
          if (prev.find((p) => p.id === n.id)) return prev;
          return [...prev, n];
        });
      }, i * 400);
    });

    // Auto-dismiss each popup after 6 seconds
    toShow.forEach((n, i) => {
      setTimeout(() => {
        dismiss(n.id);
      }, 6000 + i * 400);
    });
  }, [hasFetched, notifications]);

  const dismiss = (id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
    markAsRead(id);
  };

  return createPortal(
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10000, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380, width: "100%" }}>
      <AnimatePresence>
        {popups.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={`bg-card border border-border border-l-4 ${borderMap[n.type]} rounded-lg shadow-2xl p-4 flex gap-3 items-start cursor-pointer`}
            onClick={() => dismiss(n.id)}
          >
            <div className="mt-0.5 shrink-0">{iconMap[n.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{n.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {new Date(n.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} className="shrink-0 p-0.5 hover:bg-secondary rounded text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default NotificationPopup;
