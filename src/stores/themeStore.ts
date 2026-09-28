import { create } from "zustand";

type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

const readStored = (): Theme => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // private mode / storage blocked
  }
  // Light is the institutional default. We deliberately ignore the OS
  // preference so a first visit always opens on the light theme.
  return "light";
};

/** Dark is opt-in via a class on <html>; light lives on :root. */
const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

const initial = readStored();
applyTheme(initial);

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    applyTheme(theme);
    set({ theme });
  },
  toggle: () =>
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      applyTheme(next);
      return { theme: next };
    }),
}));
