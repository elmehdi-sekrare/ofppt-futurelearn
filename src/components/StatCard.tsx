import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/i18n/i18n";

interface Props {
  title: string;
  value: number;
  suffix?: string;
  icon: ReactNode;
  trend?: { value: number; positive: boolean };
  delay?: number;
  color?: string;
}

const StatCard = ({ title, value, suffix = "", icon, trend, delay = 0, color }: Props) => {
  const { i18n } = useTranslation();

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="stat-card group"
      style={color ? { ["--stat-color" as string]: color } : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary/[0.14]">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
            trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-[1.75rem] font-display font-bold tabular-nums leading-none">
        {value.toLocaleString(getDateLocale(i18n.language))}{suffix}
      </p>
      <p className="text-[13px] text-muted-foreground mt-1.5 leading-snug">{title}</p>
    </motion.article>
  );
};

export default StatCard;
