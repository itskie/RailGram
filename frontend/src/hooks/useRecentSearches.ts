import { useState, useCallback } from "react";

export interface RecentSearch {
  type: "train" | "station";
  label: string;        // display name
  sub: string;          // e.g. train_no or station_code
  meta?: string | null; // e.g. train_type or city
}

const MAX = 5;

function read(key: string): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function write(key: string, items: RecentSearch[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

export function useRecentSearches(storageKey: string) {
  const [history, setHistory] = useState<RecentSearch[]>(() => read(storageKey));

  const push = useCallback((item: RecentSearch) => {
    setHistory((prev) => {
      // deduplicate by sub
      const filtered = prev.filter((r) => r.sub !== item.sub);
      const next = [item, ...filtered].slice(0, MAX);
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const remove = useCallback((sub: string) => {
    setHistory((prev) => {
      const next = prev.filter((r) => r.sub !== sub);
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clear = useCallback(() => {
    write(storageKey, []);
    setHistory([]);
  }, [storageKey]);

  return { history, push, remove, clear };
}
