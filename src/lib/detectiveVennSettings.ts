import { useSyncExternalStore } from 'react';
import { ALL_WORD_SOURCES, type WordSourceKey } from '@/lib/heroClimbSettings';

const WORD_SOURCES_KEY = 'detective_venn_word_sources';

const DEFAULT_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: WordSourceKey[] = DEFAULT_SOURCES;

function readSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  if (raw == null) {
    cached = DEFAULT_SOURCES;
    return cached;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed)
      ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey))
      : [];
    cached = valid.length > 0 ? valid : DEFAULT_SOURCES;
  } catch {
    cached = DEFAULT_SOURCES;
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
  listeners.forEach((l) => l());
}

export function useDetectiveWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readSources, () => DEFAULT_SOURCES);
}

export function setDetectiveWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  // Never let the game end up with zero sources — falls back to every source enabled.
  const safe = sources.length > 0 ? sources : DEFAULT_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}
