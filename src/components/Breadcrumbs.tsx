import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";

const labelKeys: Record<string, string> = {
  dashboard: "nav.dashboard",
  students: "nav.students",
  teachers: "nav.teachers",
  groups: "nav.groups",
  rosters: "nav.rosters",
  absences: "nav.absences",
  justifications: "nav.justifications",
  teacher: "layout.roleTeacher",
  student: "layout.roleStudent",
  admin: "layout.roleAdmin",
  mark: "nav.mark",
  history: "nav.history",
  roster: "nav.roster",
  modules: "nav.modules",
  account: "nav.account",
  help: "nav.help",
  reports: "nav.reports",
  risk: "nav.risk",
  audit: "nav.audit",
};

const Breadcrumbs = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const key = labelKeys[seg];
    const label = key ? t(key) : seg.charAt(0).toUpperCase() + seg.slice(1);
    const isLast = i === segments.length - 1;
    return { label, path, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4" aria-label="Breadcrumb">
      <Link to="/" className="hover:text-foreground transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((c) => (
        <span key={c.path} className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" />
          {c.isLast ? (
            <span className="text-foreground font-medium">{c.label}</span>
          ) : (
            <Link to={c.path} className="hover:text-foreground transition-colors">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
