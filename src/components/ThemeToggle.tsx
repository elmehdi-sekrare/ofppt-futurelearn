import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "@/stores/themeStore";

const ThemeToggle = () => {
  const { t } = useTranslation();
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";
  const label = isDark ? t("layout.toLight") : t("layout.toDark");

  return (
    <button
      onClick={toggle}
      className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      title={label}
      aria-label={label}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </motion.div>
    </button>
  );
};

export default ThemeToggle;
