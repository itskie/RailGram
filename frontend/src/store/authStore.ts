import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { auth as authApi, saveTokens, clearTokens } from "../lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const data = await authApi.login(email, password) as { access_token: string; refresh_token: string };
        saveTokens(data.access_token, data.refresh_token);
        set({ token: data.access_token });
        const me = await authApi.me() as User;
        set({ user: me });
      },

      register: async (username, email, password, displayName) => {
        const data = await authApi.register({ username, email, password, display_name: displayName }) as { access_token: string; refresh_token: string };
        saveTokens(data.access_token, data.refresh_token);
        set({ token: data.access_token });
        const me = await authApi.me() as User;
        set({ user: me });
      },

      logout: async () => {
        await authApi.logout().catch(() => {});
        clearTokens();
        set({ user: null, token: null });
      },

      loadMe: async () => {
        try {
          const me = (await authApi.me()) as User;
          set({ user: me });
        } catch {
          clearTokens();
          set({ user: null, token: null });
        }
      },

      setUser: (user: User | null) => set({ user }),
    }),
    { name: "railgram-auth", partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);
