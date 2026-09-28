import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, GraduationCap, Users, BookOpen, ClipboardList, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  role: "admin" | "teacher" | "student";
}

const actions = {
  admin: [
    { label: "Add Student", icon: <GraduationCap className="w-4 h-4" />, path: "/dashboard/students", color: "bg-primary" },
    { label: "Add Teacher", icon: <Users className="w-4 h-4" />, path: "/dashboard/teachers", color: "bg-success" },
    { label: "Add Group", icon: <BookOpen className="w-4 h-4" />, path: "/dashboard/groups", color: "bg-purple-500" },
    { label: "View Absences", icon: <ClipboardList className="w-4 h-4" />, path: "/dashboard/absences", color: "bg-warning" },
  ],
  teacher: [
    { label: "Mark Absence", icon: <ClipboardList className="w-4 h-4" />, path: "/teacher/mark", color: "bg-primary" },
    { label: "View History", icon: <BookOpen className="w-4 h-4" />, path: "/teacher/history", color: "bg-success" },
  ],
  student: [
    { label: "My Absences", icon: <ClipboardList className="w-4 h-4" />, path: "/student/absences", color: "bg-primary" },
    { label: "Justifications", icon: <BookOpen className="w-4 h-4" />, path: "/student/justifications", color: "bg-success" },
  ],
};

const QuickActions = ({ role }: Props) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const items = actions[role];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return createPortal(
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 60 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 right-0 mb-2 flex flex-col gap-2 items-end"
          >
            {items.map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => go(item.path)}
                className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-shadow text-sm whitespace-nowrap"
              >
                <div className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-white`}>
                  {item.icon}
                </div>
                <span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full btn-glow flex items-center justify-center shadow-xl text-primary-foreground"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </motion.div>
      </motion.button>
    </div>,
    document.body
  );
};

export default QuickActions;
