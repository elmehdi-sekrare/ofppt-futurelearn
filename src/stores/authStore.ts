import { create } from "zustand";
import { api } from "@/services/api";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;

  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("auth_token"),
  isAuthenticated: false,
  isLoading: true,
  setUser: (user: User) => set((state) => ({ ...state, user })),

  login: async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem("auth_token", token);
    // Nothing cached for the previous account may show up in this one.
    queryClient.clear();
    set({ user, token, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout API errors
    }
    localStorage.removeItem("auth_token");
    set({ user: null, token: null, isAuthenticated: false });
    queryClient.clear();
  },

  checkAuth: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await api.getMe();
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("auth_token");
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
