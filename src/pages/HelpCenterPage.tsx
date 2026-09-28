import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle, BookOpen, MessageCircle, Keyboard, ChevronDown, ChevronRight,
  GraduationCap, Users, ClipboardList, FileCheck, Shield, Search,
  BarChart3, Bell, Settings, Printer
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";

interface FAQ {
  q: string;
  a: string;
  tags: string[];
}

interface GuideSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  steps: string[];
  roles: string[];
}

const faqs: FAQ[] = [
  { q: "How do I mark attendance for my class?", a: "Go to 'Mark Absence' from the sidebar, select your group, check the students who are absent, fill in the date, time and subject details, then click 'Submit'. Only absent students need to be selected.", tags: ["teacher", "mark", "attendance", "absence"] },
  { q: "How do I submit a justification for my absence?", a: "Navigate to 'Justifications' in the sidebar, click 'Submit Justification', select the absence you want to justify, write a reason, attach a supporting document (PDF or image), and submit. Your teacher/admin will review it.", tags: ["student", "justification", "submit", "document"] },
  { q: "What happens when I reach the maximum absence hours?", a: "The system tracks your absence hours against a 60-hour maximum per semester. At 50% you'll see a warning, at 80% a danger alert. Exceeding the limit may trigger disciplinary action. Contact administration if you're approaching the limit.", tags: ["student", "hours", "limit", "warning", "danger"] },
  { q: "How do I add a new student or teacher?", a: "As an admin, go to the Students or Teachers page, click the '+' button, fill in the details and save. The system will auto-generate login credentials that you can share with the user.", tags: ["admin", "add", "student", "teacher", "create"] },
  { q: "How do I export data to CSV or print reports?", a: "Most data tables have an 'Export CSV' button at the top. For printable reports, go to the Reports page from the sidebar, select report type, apply filters, then click 'Print Report' or 'Save as PDF'.", tags: ["export", "csv", "print", "report", "pdf"] },
  { q: "How do I change my password?", a: "Click your avatar in the top-right corner, select 'Account Settings', then use the 'Change Password' section. If it's your first login, you'll be required to set a new password before accessing the system.", tags: ["password", "account", "change", "settings", "security"] },
  { q: "What are keyboard shortcuts?", a: "Press Ctrl+K to open Global Search, use the floating '+' button for Quick Actions, and press Ctrl+/ to see all available shortcuts. These help you navigate faster.", tags: ["keyboard", "shortcuts", "search", "quick"] },
  { q: "How does the AI Risk Predictor work?", a: "The AI Risk Predictor analyzes each student's absence pattern, calculates a weekly absence rate, and predicts whether they'll exceed the maximum allowed hours by semester end. It highlights at-risk students so admins can intervene early.", tags: ["ai", "risk", "predictor", "pattern", "admin"] },
  { q: "How do I manage groups?", a: "As an admin, go to the Groups page to create, edit, or delete groups. You can assign students to groups when creating/editing students, and assign groups to teachers when creating/editing teachers.", tags: ["admin", "groups", "manage", "assign"] },
  { q: "Can I use the system on my phone?", a: "Yes, the system is fully responsive and works on mobile. The sidebar becomes a hamburger menu on smaller screens, and all features are touch-friendly.", tags: ["mobile", "responsive", "phone", "tablet"] },
  { q: "How do I review justifications as an admin?", a: "Go to the Justifications page, you'll see all pending requests. Click 'Approve' or 'Reject' on each one, and optionally add a review note. Students will be notified of the decision.", tags: ["admin", "justification", "review", "approve", "reject"] },
  { q: "What does the attendance heatmap show?", a: "The heatmap displays absence intensity by day of the week. Darker colors mean more absences. It helps identify patterns, like higher absences on specific days.", tags: ["heatmap", "chart", "pattern", "admin"] },
];

const guides: GuideSection[] = [
  {
    title: "Getting Started",
    icon: <BookOpen className="w-5 h-5" />,
    color: "bg-primary/10 text-primary",
    roles: ["admin", "teacher", "student"],
    steps: [
      "Log in with your credentials (email and password provided by admin)",
      "If it's your first login, you'll be prompted to change your password",
      "Explore your dashboard to see key metrics and recent activity",
      "Use Ctrl+K to quickly search for students, groups, or navigate pages",
      "Customize your profile in Account Settings (top-right avatar menu)",
    ],
  },
  {
    title: "Managing Students",
    icon: <GraduationCap className="w-5 h-5" />,
    color: "bg-success/10 text-success",
    roles: ["admin"],
    steps: [
      "Navigate to Students page from the sidebar",
      "Click '+' to add a new student — credentials are auto-generated",
      "Use the search bar and group filter to find specific students",
      "Click the edit icon to modify student details",
      "Export the student list to CSV using the Export button",
    ],
  },
  {
    title: "Marking Attendance",
    icon: <ClipboardList className="w-5 h-5" />,
    color: "bg-accent/10 text-accent",
    roles: ["teacher"],
    steps: [
      "Go to Mark Absence from the sidebar",
      "Select the group you want to mark attendance for",
      "Check the boxes next to students who are ABSENT",
      "Fill in the date, start time, end time, and subject",
      "Add optional notes and submit — records are saved instantly",
    ],
  },
  {
    title: "Submitting Justifications",
    icon: <FileCheck className="w-5 h-5" />,
    color: "bg-warning/10 text-warning",
    roles: ["student"],
    steps: [
      "Go to Justifications from the sidebar",
      "Click 'Submit Justification' to start a new request",
      "Select the absence record you want to justify",
      "Write a clear reason explaining your absence",
      "Upload a supporting document (medical certificate, etc.) and submit",
    ],
  },
  {
    title: "Reviewing & Reports",
    icon: <BarChart3 className="w-5 h-5" />,
    color: "bg-primary/10 text-primary",
    roles: ["admin"],
    steps: [
      "Use the Dashboard to get an overview of attendance metrics",
      "Go to Absences to view, filter and export absence records",
      "Go to Justifications to approve or reject pending requests",
      "Use the Reports page to generate printable PDF reports",
      "Check the AI Risk Predictor for students at risk of exceeding limits",
    ],
  },
];

const shortcutList = [
  { keys: "Ctrl + K", desc: "Open global search" },
  { keys: "Ctrl + /", desc: "Show keyboard shortcuts" },
  { keys: "Escape", desc: "Close dialogs and modals" },
  { keys: "+", desc: "Quick actions (floating button)" },
];

const HelpCenterPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"faq" | "guides" | "shortcuts">("faq");
  const role = useAuthStore((s) => s.user?.role) ?? "student";

  const filteredFAQs = faqs.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || f.tags.some((t) => t.includes(q));
  });

  const roleGuides = guides.filter((g) => g.roles.includes(role));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold">Help Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Find answers, guides, and shortcuts</p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            className="pl-10 input-glass"
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/30 w-fit">
        {([
          { key: "faq" as const, label: "FAQs", icon: <MessageCircle className="w-4 h-4" /> },
          { key: "guides" as const, label: "Guides", icon: <BookOpen className="w-4 h-4" /> },
          { key: "shortcuts" as const, label: "Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* FAQs */}
      {activeTab === "faq" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {filteredFAQs.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No matching questions found. Try different keywords.</p>
            </div>
          ) : (
            filteredFAQs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-panel overflow-hidden"
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  {openFAQ === i ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                <AnimatePresence>
                  {openFAQ === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </motion.div>
      )}

      {/* Guides */}
      {activeTab === "guides" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {roleGuides.map((guide, gi) => (
            <motion.div
              key={gi}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
              className="glass-panel p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${guide.color}`}>
                  {guide.icon}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">{guide.title}</h3>
                  <p className="text-xs text-muted-foreground">Step-by-step guide</p>
                </div>
              </div>
              <ol className="space-y-2.5 ml-1">
                {guide.steps.map((step, si) => (
                  <li key={si} className="flex items-start gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {si + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Shortcuts */}
      {activeTab === "shortcuts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-5">
          <h3 className="font-display font-semibold text-sm mb-4">Keyboard Shortcuts</h3>
          <div className="space-y-3">
            {shortcutList.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm text-muted-foreground">{s.desc}</span>
                <kbd className="px-3 py-1.5 rounded-lg bg-secondary border border-border font-mono text-xs text-foreground">
                  {s.keys}
                </kbd>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contact card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">Need more help?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Contact your administrator or IT support for additional assistance.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HelpCenterPage;
