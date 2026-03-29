import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: true,
      toggle: () => {
        const next = !get().dark;
        set({ dark: next });
        document.documentElement.classList.toggle("dark", next);
      },
    }),
    { name: "rg-theme" }
  )
);

export function initTheme() {
  const stored = localStorage.getItem("rg-theme");
  const dark = stored ? JSON.parse(stored)?.state?.dark ?? true : true;
  document.documentElement.classList.toggle("dark", dark);
}
