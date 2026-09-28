import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Copy, RefreshCw, Clock, CheckCircle, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  groupName: string;
  groupId: number;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
}

// Generate a deterministic but unique-looking session code
const generateCode = (groupId: number, date: string, startTime: string): string => {
  const raw = `${groupId}-${date}-${startTime}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `OFP-${hex}`;
};

// Generate QR pattern as a grid of cells (visual representation)
const generateQRGrid = (code: string): boolean[][] => {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Position detection patterns (top-left, top-right, bottom-left)
  const drawFinder = (x: number, y: number) => {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const isOuter = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const isInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        grid[y + dy][x + dx] = isOuter || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(14, 0);
  drawFinder(0, 14);

  // Timing patterns
  for (let i = 7; i < 14; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Data pattern from code
  let seed = 0;
  for (let i = 0; i < code.length; i++) {
    seed = ((seed << 5) + code.charCodeAt(i)) | 0;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Skip finder patterns and timing
      if ((x < 8 && y < 8) || (x >= 13 && y < 8) || (x < 8 && y >= 13)) continue;
      if (x === 6 || y === 6) continue;

      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      grid[y][x] = seed % 3 !== 0;
    }
  }

  return grid;
};

const QRSessionCode = ({ groupName, groupId, date, startTime, endTime, subject }: Props) => {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(300); // 5 minutes

  const code = useMemo(() => generateCode(groupId, date, startTime), [groupId, date, startTime]);
  const qrGrid = useMemo(() => generateQRGrid(code), [code]);

  // Countdown timer
  useEffect(() => {
    if (!showQR) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showQR]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copied!", description: `Session code ${code} copied to clipboard` });
    setTimeout(() => setCopied(false), 2000);
  }, [code, toast]);

  const handleRefresh = useCallback(() => {
    setExpiresIn(300);
    toast({ title: "Timer Reset", description: "QR code timer refreshed to 5 minutes" });
  }, [toast]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Toggle QR button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => { setShowQR(!showQR); setExpiresIn(300); }}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-medium">Quick Session Code</p>
          <p className="text-[11px] text-muted-foreground">Generate QR code for this session</p>
        </div>
        <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">{code}</span>
      </motion.button>

      {/* Expanded QR view */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              {/* Session info bar */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{groupName} · {subject} · {startTime}-{endTime}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full font-mono font-bold ${
                  expiresIn <= 60 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${expiresIn <= 60 ? "bg-red-400 animate-pulse" : "bg-success"}`} />
                  {expiresIn > 0 ? formatCountdown(expiresIn) : "EXPIRED"}
                </div>
              </div>

              {/* QR Code visual */}
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="relative bg-white p-3 rounded-xl shadow-lg"
                >
                  <div
                    className="grid gap-0"
                    style={{
                      gridTemplateColumns: `repeat(21, 1fr)`,
                      width: "168px",
                      height: "168px",
                    }}
                  >
                    {qrGrid.map((row, y) =>
                      row.map((cell, x) => (
                        <motion.div
                          key={`${y}-${x}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: (y * 21 + x) * 0.001 }}
                          className={`${cell ? "bg-gray-900" : "bg-white"}`}
                          style={{ width: "8px", height: "8px" }}
                        />
                      ))
                    )}
                  </div>

                  {/* Center logo */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-lg bg-white shadow flex items-center justify-center">
                      <span className="text-[8px] font-bold text-gray-900 leading-none">OFP</span>
                    </div>
                  </div>

                  {/* Expired overlay */}
                  {expiresIn === 0 && (
                    <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                      <span className="text-xs font-bold text-destructive">EXPIRED</span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Code display and actions */}
              <div className="flex items-center justify-center gap-3">
                <div className="font-mono text-lg font-bold tracking-[0.3em] text-foreground">{code}</div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Code"}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRefresh}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: "Session Code", text: `OFPPT Attendance Code: ${code}\n${groupName} · ${subject}\n${date} ${startTime}-${endTime}` });
                    } else {
                      handleCopy();
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </motion.button>
              </div>

              <p className="text-[10px] text-center text-muted-foreground">
                Students can reference this code to verify their session. Code is unique per session.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QRSessionCode;
