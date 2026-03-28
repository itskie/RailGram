import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export interface DraftReel {
  id: string; // uuid
  localFileUri: string;
  title: string;
  description: string;
  trainNumber: string;
  stationTag: string;
  savedAt: string;
}

const DRAFTS_KEY = '@railgram:reels:drafts';

export const draftUtils = {
  async saveDraft(draft: Omit<DraftReel, 'id' | 'savedAt'>): Promise<void> {
    try {
      const existing = await this.getDrafts();
      const newDraft: DraftReel = {
        ...draft,
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([newDraft, ...existing]));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  },

  async getDrafts(): Promise<DraftReel[]> {
    try {
      const data = await AsyncStorage.getItem(DRAFTS_KEY);
      if (!data) return [];
      
      const drafts: DraftReel[] = JSON.parse(data);
      // Filter out drafts whose local file has been garbage collected by OS
      const validDrafts = [];
      for (const d of drafts) {
        const info = await FileSystem.getInfoAsync(d.localFileUri);
        if (info.exists) {
          validDrafts.push(d);
        }
      }
      return validDrafts;
    } catch (e) {
       return [];
    }
  },

  async deleteDraft(id: string): Promise<void> {
    try {
      const existing = await this.getDrafts();
      const draft = existing.find(d => d.id === id);
      
      if (draft) {
        // Also cleanup cache file
        try {
          await FileSystem.deleteAsync(draft.localFileUri, { idempotent: true });
        } catch {}
      }

      const filtered = existing.filter(d => d.id !== id);
      await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete draft:', e);
    }
  }
};
