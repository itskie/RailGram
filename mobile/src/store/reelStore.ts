import { create } from 'zustand';

interface ReelStore {
  isMuted: boolean;
  activeReelId: string | null;
  toggleMute: () => void;
  setActiveReelId: (id: string | null) => void;
}

export const useReelStore = create<ReelStore>((set) => ({
  // Native apps can auto-play with sound unlike web, but we'll default to unmuted for better UX, or muted if desired. Let's say muted to match web parity initially.
  isMuted: true,
  activeReelId: null,
  
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setActiveReelId: (id: string | null) => set({ activeReelId: id }),
}));
