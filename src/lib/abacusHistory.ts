import { useSyncExternalStore } from 'react';

export interface AbacusHistoryEntry {
  timestamp: number;
  rows: number;
  maxValue: number;
  score: number;
  total: number;
}

const STORAGE_KEY = 'abacus_history';

const EMPTY_HISTORY: AbacusHistoryEntry[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedHistory: AbacusHistoryEntry[] = EMPTY_HISTORY;

function readStorage(): AbacusHistoryEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedHistory;
  cachedRaw = raw;
  try {
    cachedHistory = raw ? (JSON.parse(raw) as AbacusHistoryEntry[]) : EMPTY_HISTORY;
  } catch {
    cachedHistory = EMPTY_HISTORY;
  }
  return cachedHistory;
}

function getSnapshot(): AbacusHistoryEntry[] {
  return readStorage();
}

function getServerSnapshot(): AbacusHistoryEntry[] {
  return EMPTY_HISTORY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function useAbacusHistory(): AbacusHistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function loadHistory(): AbacusHistoryEntry[] {
  if (typeof window === 'undefined') return EMPTY_HISTORY;
  return readStorage();
}

function saveHistory(entries: AbacusHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
}

// Reads the freshest snapshot straight from localStorage before appending,
// consistent with the fresh-read pattern used for curriculum/progress writes.
export function addHistoryEntry(entry: AbacusHistoryEntry): void {
  const fresh = loadHistory();
  saveHistory([...fresh, entry]);
}

// Timestamps are effectively unique per round (millisecond precision), so
// they're used as the identifier for removing a single history entry.
export function removeHistoryEntry(timestamp: number): void {
  const fresh = loadHistory();
  saveHistory(fresh.filter((e) => e.timestamp !== timestamp));
}
