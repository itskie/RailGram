import { create } from "zustand";
import type { User } from "../types";
import { auth as authApi, initCSRF } from "../lib/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  setUser: (user: User | null) => void;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  init: async () => {
    // Initialize CSRF on app start
    await initCSRF();
    // Then load current user
    await get().loadMe();
    set({ isInitialized: true });
  },

  login: async (email, password) => {
    await initCSRF(); // Ensure CSRF is initialized before login
    await authApi.login(email, password);
    const me = await authApi.me() as User;
    set({ user: me, isAuthenticated: true });
  },

  register: async (username, email, password, displayName) => {
    await initCSRF(); // Ensure CSRF is initialized before register
    await authApi.register({ username, email, password, display_name: displayName });
    const me = await authApi.me() as User;
    set({ user: me, isAuthenticated: true });
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    set({ user: null, isAuthenticated: false });
  },

  loadMe: async () => {
    try {
      const me = (await authApi.me()) as User;
      set({ user: me, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user: User | null) => set({ user, isAuthenticated: !!user }),
}));
