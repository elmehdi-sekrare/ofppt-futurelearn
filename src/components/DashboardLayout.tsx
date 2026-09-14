import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileCheck, LogOut, ChevronLeft, Menu, UserCircle, Settings, Search,
  Printer, HelpCircle, ShieldAlert, History, FolderPlus, BookOpenCheck
} from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import ScrollToTop from "./ScrollToTop";
import SessionTimeout from "./SessionTimeout";
import WelcomeTour from "./WelcomeTour";
import NotificationPanel from "./NotificationPanel";
import NotificationPopup from "./NotificationPopup";
import GlobalSearch from "./GlobalSearch";
import KeyboardShortcuts from "./KeyboardShortcuts";
import QuickActions from "./QuickActions";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  key: string;
  path: string;
  icon: ReactNode;
}

const adminNav: NavItem[] = [
  { key: "nav.dashboard", path: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { key: "nav.students", path: "/dashboard/students", icon: <GraduationCap className="w-5 h-5" /> },
  { key: "nav.teachers", path: "/dashboard/teachers", icon: <Users className="w-5 h-5" /> },
  { key: "nav.groups", path: "/dashboard/groups", icon: <BookOpen className="w-5 h-5" /> },
  { key: "nav.rosters", path: "/dashboard/rosters", icon: <Users className="w-5 h-5" /> },
  { key: "nav.absences", path: "/dashboard/absences", icon: <ClipboardList className="w-5 h-5" /> },
  { key: "nav.justifications", path: "/dashboard/justifications", icon: <FileCheck className="w-5 h-5" /> },
  { key: "nav.risk", path: "/dashboard/risk", icon: <ShieldAlert className="w-5 h-5" /> },
  { key: "nav.reports", path: "/dashboard/reports", icon: <Printer className="w-5 h-5" /> },
  { key: "nav.audit", path: "/dashboard/audit", icon: <History className="w-5 h-5" /> },
  { key: "nav.help", path: "/dashboard/help", icon: <HelpCircle className="w-5 h-5" /> },
];

const teacherNav: NavItem[] = [
  { key: "nav.dashboard", path: "/teacher", icon: <LayoutDashboard className="w-5 h-5" /> },
  { key: "nav.mark", path: "/teacher/mark", icon: <ClipboardList className="w-5 h-5" /> },
  { key: "nav.history", path: "/teacher/history", icon: <BookOpen className="w-5 h-5" /> },
  { key: "nav.roster", path: "/teacher/roster", icon: <FolderPlus className="w-5 h-5" /> },
  { key: "nav.modules", path: "/teacher/modules", icon: <BookOpenCheck className="w-5 h-5" /> },
  { key: "nav.help", path: "/teacher/help", icon: <HelpCircle className="w-5 h-5" /> },
];

const studentNav: NavItem[] = [
  { key: "nav.dashboard", path: "/student", icon: <LayoutDashboard className="w-5 h-5" /> },
  { key: "nav.myAbsences", path: "/student/absences", icon: <ClipboardList className="w-5 h-5" /> },
  { key: "nav.justifications", path: "/student/justifications", icon: <FileCheck className="w-5 h-5" /> },
  { key: "nav.help", path: "/student/help", icon: <HelpCircle className="w-5 h-5" /> },
];

interface Props {
  children: ReactNode;
  role: "admin" | "teacher" | "student";
}

const DashboardLayout = ({ children, role }: Props) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const navItems = role === "admin" ? adminNav : role === "teacher" ? teacherNav : studentNav;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const displayName = user ? `${user.first_name} ${user.last_name}` : roleLabel;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <motion.aside
      initial={mobile ? { x: -280 } : false}
      animate={{ x: 0 }}
      exit={{ x: -280 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`${
        mobile ? "fixed inset-y-0 left-0 z-50 w-[260px]" : "hidden lg:flex"
      } flex-col bg-sidebar border-r border-sidebar-border ${
        collapsed && !mobile ? "w-[72px]" : "w-[260px]"
      } transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl btn-glow flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        {(!collapsed || mobile) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <p className="font-display font-bold text-sm gradient-text leading-tight">OFPPT</p>
            <p className="text-[10px] text-muted-foreground">Smart Attendance</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => mobile && setMobileOpen(false)}
              className={`nav-link ${isActive ? "active" : ""} ${collapsed && !mobile ? "justify-center px-2" : ""}`}
            >
              {item.icon}
              {(!collapsed || mobile) && <span className="text-sm">{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="nav-link w-full justify-center lg:justify-start"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span className="text-sm">{t("layout.collapse")}</span>}
          </button>
        )}
        <button onClick={handleLogout} className="nav-link w-full text-destructive hover:bg-destructive/10">
          <LogOut className="w-5 h-5" />
          {(!collapsed || mobile) && <span className="text-sm">{t("layout.logout")}</span>}
        </button>
      </div>
    </motion.aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <NotificationPopup />
      <GlobalSearch />
      <KeyboardShortcuts />
      <QuickActions role={role} />
      <ScrollToTop />
      <SessionTimeout />
      <WelcomeTour />

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
            />
            <Sidebar mobile />
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0 bg-card/30 backdrop-blur-md relative z-[102]">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-display font-semibold text-sm">{displayName}</h2>
              <p className="text-xs text-muted-foreground">{t(`layout.role${role.charAt(0).toUpperCase() + role.slice(1)}`)} · {t("app.shortName")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }); window.dispatchEvent(e); }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{t("layout.searchPlaceholder")}</span>
              <kbd className="ml-2 px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">Ctrl+K</kbd>
            </button>
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationPanel />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account')} className="gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" /> {t("layout.accountSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" /> {t("layout.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Breadcrumbs />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
