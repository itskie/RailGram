import { create } from 'zustand';
import { authApi, saveTokens, clearTokens } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  setToken: (token) => set({ token }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await authApi.login(email, password);
      await saveTokens(data.access_token, data.refresh_token);
      const me = await authApi.me();
      set({ token: data.access_token, user: me, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  register: async (username, email, password, displayName) => {
    set({ isLoading: true });
    try {
      const data = await authApi.register({ username, email, password, display_name: displayName });
      await saveTokens(data.access_token, data.refresh_token);
      const me = await authApi.me();
      set({ token: data.access_token, user: me, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    await clearTokens();
    set({ user: null, token: null });
  },

  loadMe: async () => {
    set({ isLoading: true });
    try {
      const me = await authApi.me();
      set({ user: me, isLoading: false });
    } catch {
      await clearTokens();
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
