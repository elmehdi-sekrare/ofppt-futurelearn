import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, X, LayoutDashboard, Search, Bell, Settings, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to OFPPT Smart Attendance!",
    description: "Let's take a quick tour of the main features to help you get started. This will only take a moment.",
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    title: "Your Dashboard",
    description: "The dashboard gives you an overview of key metrics — attendance rates, recent absences, and insights. Check it daily to stay informed.",
    icon: <LayoutDashboard className="w-8 h-8" />,
  },
  {
    title: "Global Search",
    description: "Press Ctrl+K anytime to instantly search for students, teachers, groups, or pages. It's the fastest way to find anything.",
    icon: <Search className="w-8 h-8" />,
  },
  {
    title: "Notifications",
    description: "The bell icon shows important updates — new absences, justification decisions, and system alerts. Stay on top of everything.",
    icon: <Bell className="w-8 h-8" />,
  },
  {
    title: "Account & Help",
    description: "Customize your profile in Account Settings, and visit the Help Center anytime from the sidebar if you need guidance.",
    icon: <HelpCircle className="w-8 h-8" />,
  },
];

const TOUR_KEY = "ofppt_tour_completed";

const WelcomeTour = () => {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const done = localStorage.getItem(`${TOUR_KEY}_${user.id}`);
    if (!done) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  const dismiss = () => {
    setShow(false);
    if (user) localStorage.setItem(`${TOUR_KEY}_${user.id}`, "true");
  };

  const next = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!show) return null;

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9997] flex items-center justify-center bg-background/85 backdrop-blur-md"
      >
        <motion.div
          key={step}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -20 }}
          transition={{ type: "spring", damping: 25 }}
          className="glass-panel p-8 max-w-md w-full mx-4 text-center space-y-6 relative"
        >
          <button onClick={dismiss} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-primary">
            {current.icon}
          </div>

          <div>
            <h3 className="font-display font-bold text-lg">{current.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-primary w-6" : i < step ? "bg-primary/50" : "bg-secondary"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={dismiss} className="border-border">
              Skip Tour
            </Button>
            <Button onClick={next} className="gap-2 btn-glow border-0 text-primary-foreground">
              {isLast ? "Get Started" : "Next"} {!isLast && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default WelcomeTour;
