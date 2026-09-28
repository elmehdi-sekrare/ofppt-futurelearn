import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, GraduationCap, Users, BookOpen, Command, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

const GlobalSearch = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  // Only fetch when an admin actually opens the palette (Ctrl+K), so the
  // three lookups do not run on every page load.
  const { data: studentsRes } = useQuery({
    queryKey: ["students"],
    queryFn: () => api.getStudents(),
    enabled: open && role === "admin",
  });
  const { data: teachersRes } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api.getTeachers(),
    enabled: open && role === "admin",
  });
  const { data: groupsRes } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
    enabled: open,
  });

  const students = studentsRes?.data ?? [];
  const teachers = teachersRes?.data ?? [];
  const groups = (groupsRes?.data ?? []).filter((group) => (group.status ?? "active") === "active");

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return { students: [], teachers: [], groups: [] };
    const q = query.toLowerCase();
    return {
      students: students.filter((s) => `${s.first_name} ${s.last_name} ${s.cne} ${s.email}`.toLowerCase().includes(q)).slice(0, 5),
      teachers: teachers.filter((t) => `${t.first_name} ${t.last_name} ${(t.subjects ?? []).join(" ")} ${t.email}`.toLowerCase().includes(q)).slice(0, 5),
      groups: groups.filter((g) => `${g.name} ${g.level}`.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, students, teachers, groups]);

  const hasResults = results.students.length + results.teachers.length + results.groups.length > 0;

  const pages = [
    ...(role === "admin" ? [
      { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
      { label: "Students", path: "/dashboard/students", icon: "students" },
      { label: "Teachers", path: "/dashboard/teachers", icon: "teachers" },
      { label: "Groups", path: "/dashboard/groups", icon: "groups" },
      { label: "Absences", path: "/dashboard/absences", icon: "absences" },
      { label: "Justifications", path: "/dashboard/justifications", icon: "justifications" },
      { label: "Account Settings", path: "/account", icon: "settings" },
    ] : []),
    ...(role === "teacher" ? [
      { label: "Dashboard", path: "/teacher", icon: "dashboard" },
      { label: "Mark Absence", path: "/teacher/mark", icon: "absences" },
      { label: "History", path: "/teacher/history", icon: "history" },
      { label: "Account Settings", path: "/account", icon: "settings" },
    ] : []),
    ...(role === "student" ? [
      { label: "Dashboard", path: "/student", icon: "dashboard" },
      { label: "My Absences", path: "/student/absences", icon: "absences" },
      { label: "Justifications", path: "/student/justifications", icon: "justifications" },
      { label: "Account Settings", path: "/account", icon: "settings" },
    ] : []),
  ];

  const filteredPages = query.trim()
    ? pages.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : pages.slice(0, 4);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10010, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", zIndex: 10011, width: "90vw", maxWidth: "560px" }}>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students, teachers, groups, pages..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {/* Pages */}
            {filteredPages.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 py-1">Pages</p>
                {filteredPages.map((p) => (
                  <button key={p.path} onClick={() => go(p.path)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left transition-colors">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Students */}
            {results.students.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 py-1">Students</p>
                {results.students.map((s) => (
                  <button key={s.id} onClick={() => go("/dashboard/students")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left transition-colors">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.cne} · {s.group_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Teachers */}
            {results.teachers.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 py-1">Teachers</p>
                {results.teachers.map((t) => (
                  <button key={t.id} onClick={() => go("/dashboard/teachers")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left transition-colors">
                    <Users className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium">{t.first_name} {t.last_name}</p>
                      <p className="text-xs text-muted-foreground">{(t.subjects ?? []).join(", ") || "No subjects created"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Groups */}
            {results.groups.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold px-2 py-1">Groups</p>
                {results.groups.map((g) => (
                  <button key={g.id} onClick={() => go("/dashboard/groups")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-sm text-left transition-colors">
                    <BookOpen className="w-4 h-4 text-success" />
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.level} · {g.student_count} students</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !hasResults && filteredPages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No results for "{query}"</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono">↵</kbd> Open</span>
            </div>
            <span className="flex items-center gap-1"><Command className="w-3 h-3" />K to toggle</span>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  );
};

export default GlobalSearch;
