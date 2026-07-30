import { useSyncExternalStore } from 'react';

const KEY = 'hero_climb_used_word_ids';
const listeners = new Set<() => void>();
let cache: Set<string> | null = null;

function readIds(): Set<string> {
  if (cache !== null) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    cache = new Set();
  }
  return cache;
}

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useUsedWordIds(): Set<string> {
  return useSyncExternalStore(subscribe, readIds, () => new Set<string>());
}

export function getUsedWordIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  return readIds();
}

// Full replace — handles the "all words exhausted → reset" case correctly.
export function persistUsedWordIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  const next = new Set(ids);
  localStorage.setItem(KEY, JSON.stringify([...next]));
  cache = next;
  notify();
}

export function removeUsedWordId(id: string): void {
  if (typeof window === 'undefined') return;
  const current = readIds();
  if (!current.has(id)) return;
  const next = new Set(current);
  next.delete(id);
  localStorage.setItem(KEY, JSON.stringify([...next]));
  cache = next;
  notify();
}

export function clearUsedWordIds(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, '[]');
  cache = new Set();
  notify();
}
