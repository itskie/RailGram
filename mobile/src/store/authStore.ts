import { create } from 'zustand';
import { api, storage } from '../api/client';

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  karma: number;
  is_private: boolean;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const token = res.data.access_token;
    await storage.setToken(token);
    set({ token });
    const me = await api.get('/auth/me');
    set({ user: me.data });
  },

  register: async (username, email, password) => {
    await api.post('/auth/register', { username, email, password });
  },

  logout: async () => {
    await storage.clearToken();
    set({ user: null, token: null });
  },

  loadUser: async () => {
    try {
      const token = await storage.loadToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      set({ token });
      const me = await api.get('/auth/me');
      set({ user: me.data, isLoading: false });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        await storage.clearToken();
        set({ user: null, token: null, isLoading: false });
      } else {
        // Network error — keep token, still show app
        set({ isLoading: false });
      }
    }
  },
}));
