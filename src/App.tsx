import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentsPage from "./pages/StudentsPage";
import TeachersPage from "./pages/TeachersPage";
import GroupsPage from "./pages/GroupsPage";
import AdminAbsencesPage from "./pages/AdminAbsencesPage";
import MarkAbsencePage from "./pages/MarkAbsencePage";
import JustificationsPage from "./pages/JustificationsPage";
import AdminJustificationsPage from "./pages/AdminJustificationsPage";
import StudentAbsencesPage from "./pages/StudentAbsencesPage";
import TeacherHistoryPage from "./pages/TeacherHistoryPage";
import TeacherRosterPage from "./pages/TeacherRosterPage";
import TeacherModulesPage from "./pages/TeacherModulesPage";
import DashboardLayout from "./components/DashboardLayout";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import ReportsPage from "./pages/ReportsPage";
import RiskDashboardPage from "./pages/RiskDashboardPage";
import AuditLogPage from "./pages/AuditLogPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import NotFound from "./pages/NotFound";
import { Skeleton } from "@/components/ui/skeleton";

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role: string }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.must_change_password && location.pathname !== "/account") return <Navigate to="/account" replace />;
  if (user.role !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const ProtectedAccountRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const AccountRoutePage = () => {
  const { user } = useAuthStore();
  const role = (user?.role ?? "student") as "admin" | "teacher" | "student";

  return (
    <DashboardLayout role={role}>
      <AccountSettingsPage />
    </DashboardLayout>
  );
};

const AuthInitializer = ({ children }: { children: React.ReactNode }) => {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
};

const ComingSoon = () => (
  <div className="glass-panel p-8 text-center text-muted-foreground">
    <p className="font-display font-semibold text-lg text-foreground mb-2">Coming Soon</p>
    <p className="text-sm">This section is under development</p>
  </div>
);

const App = () => {
  // The theme class lives on <html> (see themeStore) so portalled dialogs
  // and popovers inherit the same palette as the page.
  const routerBasename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
  <div className="bg-background text-foreground min-h-screen">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={routerBasename}>
        <AuthInitializer>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/account" element={
              <ProtectedAccountRoute>
                <AccountRoutePage />
              </ProtectedAccountRoute>
            } />

            {/* Admin */}
            <Route path="/dashboard" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><AdminDashboard /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/students" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><StudentsPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/teachers" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><TeachersPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/groups" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><GroupsPage /></DashboardLayout></ProtectedRoute>
            } />
            {/* Roster import now lives on the Groups page */}
            <Route path="/dashboard/rosters" element={<Navigate to="/dashboard/groups" replace />} />
            <Route path="/dashboard/absences" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><AdminAbsencesPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/justifications" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><AdminJustificationsPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/reports" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><ReportsPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/risk" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><RiskDashboardPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/audit" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><AuditLogPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/help" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><HelpCenterPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/dashboard/:section" element={
              <ProtectedRoute role="admin"><DashboardLayout role="admin"><ComingSoon /></DashboardLayout></ProtectedRoute>
            } />

            {/* Teacher */}
            <Route path="/teacher" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><TeacherDashboard /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/mark" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><MarkAbsencePage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/history" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><TeacherHistoryPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/roster" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><TeacherRosterPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/modules" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><TeacherModulesPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/help" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><HelpCenterPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/teacher/:section" element={
              <ProtectedRoute role="teacher"><DashboardLayout role="teacher"><ComingSoon /></DashboardLayout></ProtectedRoute>
            } />

            {/* Student */}
            <Route path="/student" element={
              <ProtectedRoute role="student"><DashboardLayout role="student"><StudentDashboard /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/student/absences" element={
              <ProtectedRoute role="student"><DashboardLayout role="student"><StudentAbsencesPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/student/justifications" element={
              <ProtectedRoute role="student"><DashboardLayout role="student"><JustificationsPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/student/help" element={
              <ProtectedRoute role="student"><DashboardLayout role="student"><HelpCenterPage /></DashboardLayout></ProtectedRoute>
            } />
            <Route path="/student/:section" element={
              <ProtectedRoute role="student"><DashboardLayout role="student"><ComingSoon /></DashboardLayout></ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </div>
  );
};

export default App;
