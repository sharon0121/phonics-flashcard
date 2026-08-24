import { useSyncExternalStore } from 'react';
import type { Word } from './types';
import {
  useThisWeekClimbWords,
  useReinforcementClimbWords,
  usePhonicsClimbWords,
  useSightWordsClimb,
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type WordSourceKey,
} from './heroClimbSettings';
import { useCustomWords } from './customWords';

export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES };
export type { WordSourceKey };

const WORD_SOURCES_KEY = 'puyo_word_sources';
// Unlike most games (which default to every source), the vocabulary quiz
// defaults to just this week's curriculum words, per Sharon's request.
const DEFAULT_WORD_SOURCES: WordSourceKey[] = ['thisWeek'];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;

function readWordSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedRaw) return cachedSources;
  cachedRaw = raw;
  if (raw == null) {
    cachedSources = DEFAULT_WORD_SOURCES;
    return cachedSources;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed)
      ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey))
      : [];
    cachedSources = valid.length > 0 ? valid : DEFAULT_WORD_SOURCES;
  } catch {
    cachedSources = DEFAULT_WORD_SOURCES;
  }
  return cachedSources;
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

export function usePuyoWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setPuyoWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  // Never let the quiz end up with zero sources — falls back to the default.
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

// Combined word pool for the 2-minute vocabulary quiz, built from whichever
// sources are checked in settings. Falls back to the full phonics + sight
// word banks when the selected sources don't add up to enough words for a
// 3-choice question (e.g. "this week" is empty because no curriculum plan
// has been set yet).
export function usePuyoQuizWords(): Word[] {
  const sources = usePuyoWordSources();
  const thisWeek = useThisWeekClimbWords();
  const reinforcement = useReinforcementClimbWords();
  const custom = useCustomWords();
  const phonics = usePhonicsClimbWords();
  const sightWords = useSightWordsClimb();

  const bySource: Record<WordSourceKey, Word[]> = {
    thisWeek,
    reinforcement,
    custom,
    phonics,
    sightWords,
  };

  const seen = new Set<string>();
  const pool: Word[] = [];
  for (const key of sources) {
    for (const w of bySource[key]) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        pool.push(w);
      }
    }
  }
  if (pool.length >= 3) return pool;

  const fallback: Word[] = [];
  const seenFallback = new Set<string>();
  for (const w of [...phonics, ...sightWords]) {
    if (!seenFallback.has(w.id)) {
      seenFallback.add(w.id);
      fallback.push(w);
    }
  }
  return fallback;
}
