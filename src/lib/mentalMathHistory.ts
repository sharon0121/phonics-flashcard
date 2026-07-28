import { useSyncExternalStore } from 'react';

export interface MentalMathHistoryEntry {
  timestamp: number;
  terms: number;
  maxValue: number;
  mode: 'flash' | 'full';
  score: number;
  total: number;
}

const STORAGE_KEY = 'mental_math_history';

const EMPTY_HISTORY: MentalMathHistoryEntry[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedHistory: MentalMathHistoryEntry[] = EMPTY_HISTORY;

function readStorage(): MentalMathHistoryEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedHistory;
  cachedRaw = raw;
  try {
    cachedHistory = raw ? (JSON.parse(raw) as MentalMathHistoryEntry[]) : EMPTY_HISTORY;
  } catch {
    cachedHistory = EMPTY_HISTORY;
  }
  return cachedHistory;
}

function getSnapshot(): MentalMathHistoryEntry[] {
  return readStorage();
}

function getServerSnapshot(): MentalMathHistoryEntry[] {
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

export function useMentalMathHistory(): MentalMathHistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function loadHistory(): MentalMathHistoryEntry[] {
  if (typeof window === 'undefined') return EMPTY_HISTORY;
  return readStorage();
}

function saveHistory(entries: MentalMathHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
}

export function addMentalMathHistoryEntry(entry: MentalMathHistoryEntry): void {
  const fresh = loadHistory();
  saveHistory([...fresh, entry]);
}

// Timestamps are effectively unique per round (millisecond precision), so
// they're used as the identifier for removing a single history entry.
export function removeMentalMathHistoryEntry(timestamp: number): void {
  const fresh = loadHistory();
  saveHistory(fresh.filter((e) => e.timestamp !== timestamp));
}
