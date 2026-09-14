import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en" : "fr";
  const change = (lng: "fr" | "en") => { if (lng !== current) i18n.changeLanguage(lng); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground inline-flex items-center gap-1" title={t("app.language")} aria-label={t("app.language")}>
          <Globe className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">{current}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => change("fr")} className="gap-2 cursor-pointer">
          {current === "fr" ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
          {t("app.french")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("en")} className="gap-2 cursor-pointer">
          {current === "en" ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
          {t("app.english")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}