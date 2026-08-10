import { useSyncExternalStore } from 'react';

export interface DetectiveCompletionRecord {
  word: string;
  zh: string;
  timestamp: number;
}

const STORAGE_KEY = 'detective_venn_completions';
const EMPTY: DetectiveCompletionRecord[] = [];
const MAX_RECORDS = 500; // trophy log cap — plenty for a long play history

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: DetectiveCompletionRecord[] = EMPTY;

function readStorage(): DetectiveCompletionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as DetectiveCompletionRecord[]) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
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

// Every solved round, oldest first — length is the total trophy count.
export function useDetectiveVennHistory(): DetectiveCompletionRecord[] {
  return useSyncExternalStore(subscribe, readStorage, () => EMPTY);
}

export function recordDetectiveCompletion(word: string, zh: string, timestamp: number): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  let updated = [...fresh, { word, zh, timestamp }];
  if (updated.length > MAX_RECORDS) {
    updated = updated.slice(updated.length - MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notify();
}

// Clears every record for a word — moves it back into the "not yet mastered"
// pool so the game prefers asking it again soon.
export function removeDetectiveCompletion(word: string): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh.filter((r) => r.word !== word)));
  notify();
}

export interface DetectiveWordSummary {
  word: string;
  zh: string;
  count: number;
  lastTimestamp: number;
}

// One row per unique solved word, newest-first — used by the settings page.
export function useDetectiveWordSummaries(): DetectiveWordSummary[] {
  const history = useDetectiveVennHistory();
  const byWord = new Map<string, DetectiveWordSummary>();
  for (const rec of history) {
    const existing = byWord.get(rec.word);
    if (existing) {
      existing.count += 1;
      if (rec.timestamp > existing.lastTimestamp) existing.lastTimestamp = rec.timestamp;
    } else {
      byWord.set(rec.word, { word: rec.word, zh: rec.zh, count: 1, lastTimestamp: rec.timestamp });
    }
  }
  return Array.from(byWord.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}
