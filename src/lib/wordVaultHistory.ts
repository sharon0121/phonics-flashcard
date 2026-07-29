import { useSyncExternalStore } from 'react';

export interface CompletionRecord {
  word: string;
  zh: string;
  emoji: string;
  stars: number;
  timestamp: number;
}

const STORAGE_KEY = 'word_vault_completions';
const EMPTY: CompletionRecord[] = [];
const MAX_UNIQUE_WORDS = 50;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: CompletionRecord[] = EMPTY;

function readStorage(): CompletionRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as CompletionRecord[]) : EMPTY;
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

export function useWordVaultHistory(): CompletionRecord[] {
  return useSyncExternalStore(subscribe, readStorage, () => EMPTY);
}

export function recordWordCompletion(word: string, zh: string, emoji: string, stars: number, timestamp: number): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  const entry: CompletionRecord = { word, zh, emoji, stars, timestamp };
  let updated = [...fresh, entry];

  // Enforce 50-unique-word cap: find the best record per word, evict the
  // oldest unique word(s) when the total exceeds the cap.
  const bestByWord = new Map<string, CompletionRecord>();
  for (const rec of updated) {
    const existing = bestByWord.get(rec.word);
    if (!existing || rec.stars > existing.stars || (rec.stars === existing.stars && rec.timestamp > existing.timestamp)) {
      bestByWord.set(rec.word, rec);
    }
  }
  if (bestByWord.size > MAX_UNIQUE_WORDS) {
    const oldest = Array.from(bestByWord.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, bestByWord.size - MAX_UNIQUE_WORDS)
      .map((r) => r.word);
    const evict = new Set(oldest);
    updated = updated.filter((r) => !evict.has(r.word));
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notify();
}

// Clears every recorded completion for a word — used to "unlock" it again so
// a child who isn't solid on it yet can re-earn it from scratch.
export function removeCompletion(word: string): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh.filter((r) => r.word !== word)));
  notify();
}

// Best star rating achieved per unique word (a trophy case), newest first.
export function useBestCompletions(): CompletionRecord[] {
  const history = useWordVaultHistory();
  const bestByWord = new Map<string, CompletionRecord>();
  for (const rec of history) {
    const existing = bestByWord.get(rec.word);
    if (!existing || rec.stars > existing.stars) {
      bestByWord.set(rec.word, rec);
    } else if (rec.stars === existing.stars && rec.timestamp > existing.timestamp) {
      bestByWord.set(rec.word, { ...existing, timestamp: rec.timestamp });
    }
  }
  return Array.from(bestByWord.values()).sort((a, b) => b.timestamp - a.timestamp);
}
