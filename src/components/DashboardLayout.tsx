import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileCheck, LogOut, ChevronLeft, ChevronDown, Menu, UserCircle, Settings, Search,
  Printer, HelpCircle, ShieldAlert, History, FolderPlus, BookOpenCheck
} from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import ScrollToTop from "./ScrollToTop";
import SessionTimeout from "./SessionTimeout";
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
  // "admin" -> "Admin", used to build the layout.roleAdmin translation key
  const roleKey = role.charAt(0).toUpperCase() + role.slice(1);
  const displayName = user ? `${user.first_name} ${user.last_name}` : t(`layout.role${roleKey}`);
  const initials = user ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() : "";

  // The command palette listens for Ctrl+K on window
  const openSearch = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));

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
      <div className="px-4 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <img
          src={`${import.meta.env.BASE_URL}ofppt-logo.svg`}
          alt="OFPPT"
          width={38}
          height={38}
          className="rounded-full bg-white shadow-sm ring-1 ring-white/20 shrink-0"
          style={{ width: 38, height: 38 }}
        />
        {(!collapsed || mobile) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
            <p className="font-display font-bold text-[0.95rem] leading-none tracking-tight text-sidebar-accent-foreground">OFPPT</p>
            <p className="text-[10px] uppercase tracking-[0.13em] text-sidebar-foreground/70 truncate mt-1.5">{t(`layout.role${roleKey}`)}</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label={t(`layout.role${roleKey}`)}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              title={collapsed && !mobile ? t(item.key) : undefined}
              onClick={() => mobile && setMobileOpen(false)}
              className={`nav-link ${isActive ? "active" : ""} ${collapsed && !mobile ? "justify-center px-2" : ""}`}
            >
              {item.icon}
              {(!collapsed || mobile) && <span>{t(item.key)}</span>}
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
            {!collapsed && <span>{t("layout.collapse")}</span>}
          </button>
        )}
        <button onClick={handleLogout} className="nav-link w-full hover:bg-destructive/20 hover:text-white">
          <LogOut className="w-5 h-5" />
          {(!collapsed || mobile) && <span>{t("layout.logout")}</span>}
        </button>
      </div>
    </motion.aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a href="#main-content" className="skip-link">{t("layout.skipToContent")}</a>
      <Sidebar />
      {/* Only students get notifications: for admins and trainers they piled up
          by the thousand (one per absence) and slowed the whole app down. */}
      {role === "student" && <NotificationPopup />}
      <GlobalSearch />
      <KeyboardShortcuts />
      <QuickActions role={role} />
      <ScrollToTop />
      <SessionTimeout />

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
        {/* Top bar: search on the left, tools and identity on the right */}
        <header className="h-[4.25rem] border-b border-border flex items-center gap-3 px-4 lg:px-6 shrink-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 relative z-[102]">
          <button onClick={() => setMobileOpen(true)} aria-label={t("layout.openMenu")} className="lg:hidden p-2 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={openSearch}
            className="group flex-1 max-w-[30rem] flex items-center gap-2.5 h-10 pl-3.5 pr-2 rounded-lg bg-secondary/70 border border-transparent text-[14px] text-muted-foreground text-left transition-[border-color,background-color,box-shadow] duration-200 hover:bg-card hover:border-border hover:shadow-[var(--shadow-card)]"
          >
            <Search className="w-4 h-4 shrink-0 transition-colors group-hover:text-primary" />
            <span className="flex-1 truncate">{t("layout.searchHint")}</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 h-6 px-1.5 rounded-md border border-border bg-card font-mono text-[10.5px] text-muted-foreground">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationPanel enabled={role === "student"} />
            <span className="hidden sm:block w-px h-7 bg-border mx-2" aria-hidden="true" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t("layout.accountSettings")}
                  className="group flex items-center gap-2.5 h-10 pl-1 pr-1.5 sm:pr-2.5 rounded-lg hover:bg-secondary transition-colors data-[state=open]:bg-secondary"
                >
                  <span className="w-8 h-8 rounded-[9px] bg-primary text-primary-foreground flex items-center justify-center text-[12.5px] font-bold tracking-wide shadow-[0_2px_6px_-2px_hsl(var(--primary)/0.5)]">
                    {initials || <UserCircle className="w-4 h-4" />}
                  </span>
                  <span className="hidden sm:flex flex-col items-start leading-tight max-w-[11rem]">
                    <span className="text-[13.5px] font-semibold text-foreground truncate max-w-full">{displayName}</span>
                    <span className="text-[11.5px] text-muted-foreground">{t(`layout.role${roleKey}`)}</span>
                  </span>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 pb-24 lg:pb-24 xl:pb-24">
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
