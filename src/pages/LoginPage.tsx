import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuthStore } from "@/stores/authStore";
import { useSuccessNotification } from "@/components/SuccessNotification";

const LoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const login = useAuthStore((s) => s.login);
  const { showSuccess, NotificationComponent } = useSuccessNotification();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      const dest = user.must_change_password
        ? "/account"
        : user.role === "admin"
        ? "/dashboard"
        : user.role === "teacher"
        ? "/teacher"
        : "/student";
      showSuccess({
        title: t("auth.welcomeBack"),
        description: t("auth.signedInAs", { name: `${user.first_name} ${user.last_name}` }),
        icon: "login",
        accentColor: "#3b82f6",
      });
      setTimeout(() => navigate(dest), 1500);
    } catch (err: any) {
      toast({ title: t("auth.loginFailed"), description: err.message || t("auth.invalidCredentials"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (role: string) => {
    const creds: Record<string, { email: string; password: string }> = {
      admin: { email: "admin@ofppt.ma", password: "password" },
      teacher: { email: "teacher@ofppt.ma", password: "password" },
      student: { email: "student@ofppt.ma", password: "password" },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  return (
    <>
    {NotificationComponent}
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Floating shapes */}
      <div className="floating-shape w-96 h-96 bg-primary/20 -top-20 -left-20" />
      <div className="floating-shape w-72 h-72 bg-accent/20 top-1/3 -right-10" style={{ animationDelay: "-5s" }} />
      <div className="floating-shape w-64 h-64 bg-primary/10 bottom-10 left-1/4" style={{ animationDelay: "-10s" }} />

      {/* Theme + language */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md mx-4 z-10"
      >
        <div className="glass-panel p-8 space-y-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-3"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl btn-glow flex items-center justify-center">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-display gradient-text">{t("app.name")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t("auth.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="pl-10 input-glass"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">{t("auth.password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 input-glass"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-glow text-primary-foreground font-semibold h-11 border-0"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
              ) : (
                t("auth.signIn")
              )}
            </Button>
          </form>

          {/* Quick fill */}
          <div className="space-y-3">
            <p className="text-xs text-center text-muted-foreground uppercase tracking-wider">{t("auth.demoAccess")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["admin", "teacher", "student"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => quickFill(role)}
                  className="text-xs py-2 px-3 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 capitalize"
                >
                  {t(`auth.${role}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
};

export default LoginPage;
