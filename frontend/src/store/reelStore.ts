import { create } from 'zustand';

interface ReelStore {
  isMuted: boolean;
  globalVolume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

export const useReelStore = create<ReelStore>((set) => ({
  // Default to true (muted) because modern browsers block autoplay with sound
  isMuted: true,
  globalVolume: 1,
  
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setVolume: (v: number) => set({ globalVolume: v }),
}));
