import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 2 * 60 * 1000; // Show warning 2 min before

const SessionTimeout = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARNING_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const expiresRef = useRef(Date.now() + TIMEOUT_MS);
  const { logout, isAuthenticated } = useAuthStore();

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    expiresRef.current = Date.now() + TIMEOUT_MS;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemaining(WARNING_MS);

      countdownRef.current = setInterval(() => {
        const left = Math.max(0, expiresRef.current + WARNING_MS - Date.now());
        setRemaining(left);
        if (left <= 0) {
          clearInterval(countdownRef.current);
          logout();
        }
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    const handler = () => {
      if (!showWarning) resetTimer();
    };

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAuthenticated, resetTimer, showWarning]);

  if (!isAuthenticated) return null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return createPortal(
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-panel p-8 max-w-sm w-full mx-4 text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg">Session Expiring</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your session will expire in{" "}
                <span className="font-mono font-bold text-warning">
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Move your mouse or click to stay active</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={resetTimer} className="flex-1 gap-2 btn-glow border-0 text-primary-foreground">
                <RefreshCw className="w-4 h-4" /> Stay Logged In
              </Button>
              <Button variant="outline" onClick={() => logout()} className="flex-1 gap-2 border-border">
                <LogOut className="w-4 h-4" /> Logout
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SessionTimeout;
