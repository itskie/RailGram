import { create } from "zustand";

export type UploadStatus = "preparing" | "uploading" | "processing" | "completed" | "failed";

export interface UploadItem {
  id: string;
  type: "post" | "reel";
  status: UploadStatus;
  progress: number;
  title: string;
  error?: string;
  file?: File; // Stores the local file during the session
  files?: File[]; // For multiple photos in a post
  payload: any; // Extra metadata (caption, tags, etc.)
}

interface UploadStore {
  uploads: Record<string, UploadItem>;
  addUpload: (item: UploadItem) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: {},
  addUpload: (item) => 
    set((state) => ({ 
      uploads: { ...state.uploads, [item.id]: item } 
    })),
  updateUpload: (id, updates) =>
    set((state) => ({
      uploads: {
        ...state.uploads,
        [id]: state.uploads[id] ? { ...state.uploads[id], ...updates } : state.uploads[id],
      },
    })),
  removeUpload: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.uploads;
      return { uploads: rest };
    }),
  clearCompleted: () =>
    set((state) => {
      const rest: Record<string, UploadItem> = {};
      Object.entries(state.uploads).forEach(([id, item]) => {
        if (item.status !== "completed") rest[id] = item;
      });
      return { uploads: rest };
    }),
}));
