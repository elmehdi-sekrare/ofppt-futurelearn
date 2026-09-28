import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ClipboardCheck, ShieldCheck } from "lucide-react";
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
        accentColor: "#1b5aa8",
      });
      setTimeout(() => navigate(dest), 1200);
    } catch (err: any) {
      toast({ title: t("auth.loginFailed"), description: err.message || t("auth.invalidCredentials"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pillars = [
    { icon: ClipboardCheck, key: "pillarAttendance" },
    { icon: GraduationCap, key: "pillarStudents" },
    { icon: ShieldCheck, key: "pillarSecure" },
  ] as const;

  return (
    <>
      {NotificationComponent}
      <div className="min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr] bg-background">
        {/* ── Left: the institution. Campus artwork, brand field, what the system does ── */}
        <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-14 xl:p-16">
          {/* Real campus photograph, bundled locally: the school server is offline. */}
          <img
            src={`${import.meta.env.BASE_URL}campus.jpg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-105"
            loading="eager"
            decoding="async"
          />
          {/* Brand duotone kept light enough that the architecture stays legible,
              plus a bottom-weighted ramp only where text actually sits. */}
          <div
            className="absolute inset-0 mix-blend-multiply"
            style={{ background: "linear-gradient(155deg, hsl(212 68% 34%) 0%, hsl(206 62% 40%) 40%, hsl(158 52% 34%) 100%)" }}
          />
          <div
            className="absolute inset-0 mix-blend-soft-light"
            style={{ background: "linear-gradient(155deg, hsl(200 90% 62%) 0%, transparent 55%)" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, hsl(214 60% 9% / 0.88) 0%, hsl(214 58% 11% / 0.45) 38%, transparent 72%)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex items-center gap-4"
          >
            <img
              src={`${import.meta.env.BASE_URL}ofppt-logo.svg`}
              alt="OFPPT"
              width={72}
              height={72}
              className="rounded-full bg-white shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/30"
              style={{ width: 72, height: 72 }}
            />
            <div className="text-white">
              <p className="font-display font-extrabold text-[1.6rem] leading-none tracking-[-0.03em]">OFPPT</p>
              <p className="text-[11px] text-white/65 mt-2 uppercase tracking-[0.2em]">{t("app.tagline")}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative text-white max-w-[32rem]"
          >
            <h2 className="font-display font-extrabold text-[3.1rem] xl:text-[3.6rem] leading-[0.98] tracking-[-0.04em]">
              {t("auth.heroTitle")}
            </h2>
            <span className="block h-[3px] w-16 rounded-full bg-white/45 mt-8" />
            <p className="text-[1.0625rem] text-white/75 mt-8 leading-[1.65] max-w-[30rem]">{t("auth.heroBody")}</p>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="relative grid grid-cols-3 gap-6 text-white"
          >
            {pillars.map(({ icon: Icon, key }) => (
              <li key={key} className="border-t border-white/25 pt-5">
                <Icon className="w-[1.375rem] h-[1.375rem] mb-3 text-white/85" strokeWidth={1.5} />
                <p className="text-[13px] leading-snug text-white/80">{t(`auth.${key}`)}</p>
              </li>
            ))}
          </motion.ul>
        </aside>

        {/* ── Right: the form ── */}
        <main className="relative flex flex-col min-h-[100dvh] lg:min-h-0 bg-background">
          {/* Faint brand wash in the corner so the panel is not a flat white slab */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(120% 90% at 100% 0%, hsl(var(--primary) / 0.07) 0%, transparent 60%)" }}
          />
          <div className="relative flex justify-end items-center gap-1 p-4 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <div className="relative flex-1 flex items-center justify-center px-6 pb-16 -mt-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[25rem]"
            >
              <header className="mb-8">
                {/* The mark sits above the heading on every width */}
                <img
                  src={`${import.meta.env.BASE_URL}ofppt-logo.svg`}
                  alt="OFPPT"
                  width={104}
                  height={104}
                  className="rounded-full bg-white shadow-[var(--shadow-raised)] ring-1 ring-border mb-7"
                  style={{ width: 104, height: 104 }}
                />
                <p className="eyebrow">{t("auth.login")}</p>
                <h1 className="page-title mt-2.5">{t("auth.signIn")}</h1>
                <p className="text-[0.95rem] text-muted-foreground mt-3 leading-relaxed">
                  {t("auth.useYourAccount")}
                </p>
              </header>

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label htmlFor="login-email" className="text-sm font-semibold">{t("auth.email")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      className="pl-11 h-12 input-glass text-[0.95rem]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm font-semibold">{t("auth.password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-11 pr-11 h-12 input-glass text-[0.95rem]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-glow text-primary-foreground h-12 border-0 text-[0.95rem]"
                >
                  {loading ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    />
                  ) : (
                    t("auth.signIn")
                  )}
                </Button>
              </form>

              <p className="text-[13px] text-muted-foreground mt-7 leading-relaxed">
                {t("auth.credentialsHelp")}
              </p>
            </motion.div>
          </div>

          <footer className="relative shrink-0 px-6 pb-6 text-center">
            <p className="text-xs text-muted-foreground">{t("auth.footer", { year: new Date().getFullYear() })}</p>
          </footer>
        </main>
      </div>
    </>
  );
};

export default LoginPage;
