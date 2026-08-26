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
import { BLOCK_THEMES, type ThemeId } from './blockPuzzleThemes';

export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES };
export type { WordSourceKey };

const WORD_SOURCES_KEY = 'blockpuzzle_word_sources';
const BEST_SCORE_KEY = 'blockpuzzle_best_score';
const LIFETIME_COLLECTED_KEY = 'blockpuzzle_lifetime_collected';
const THEME_KEY = 'blockpuzzle_theme';
// Defaults to just this week's curriculum words, matching Puyo/Tetris's quiz.
const DEFAULT_WORD_SOURCES: WordSourceKey[] = ['thisWeek'];
const DEFAULT_THEME: ThemeId = 'candy';

const listeners = new Set<() => void>();
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;
let cachedBestRaw: string | null = null;
let cachedBest = 0;
let cachedLifetimeRaw: string | null = null;
let cachedLifetime = 0;
let cachedThemeRaw: string | null = null;
let cachedTheme: ThemeId = DEFAULT_THEME;

function readWordSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedSourcesRaw) return cachedSources;
  cachedSourcesRaw = raw;
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

function readBestScore(): number {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  if (raw === cachedBestRaw) return cachedBest;
  cachedBestRaw = raw;
  const parsed = raw == null ? 0 : Number(raw);
  cachedBest = Number.isFinite(parsed) ? parsed : 0;
  return cachedBest;
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

export function useBlockPuzzleWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setBlockPuzzleWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

export function useBlockPuzzleBestScore(): number {
  return useSyncExternalStore(subscribe, readBestScore, () => 0);
}

export function reportBlockPuzzleScore(score: number): void {
  if (typeof window === 'undefined') return;
  if (score > readBestScore()) {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
    notify();
  }
}

// Total paw-print collectibles ever cleared, across every run — this is
// what theme unlocks are gated on (BLOCK_THEMES[].unlockAt), separate from
// the per-run 0/25 progress bar which resets after each goal completion.
function readLifetimeCollected(): number {
  const raw = localStorage.getItem(LIFETIME_COLLECTED_KEY);
  if (raw === cachedLifetimeRaw) return cachedLifetime;
  cachedLifetimeRaw = raw;
  const parsed = raw == null ? 0 : Number(raw);
  cachedLifetime = Number.isFinite(parsed) ? parsed : 0;
  return cachedLifetime;
}

export function useLifetimeCollected(): number {
  return useSyncExternalStore(subscribe, readLifetimeCollected, () => 0);
}

export function addLifetimeCollected(n: number): void {
  if (typeof window === 'undefined' || n <= 0) return;
  const next = readLifetimeCollected() + n;
  localStorage.setItem(LIFETIME_COLLECTED_KEY, String(next));
  notify();
}

function readTheme(): ThemeId {
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === cachedThemeRaw) return cachedTheme;
  cachedThemeRaw = raw;
  const validIds = BLOCK_THEMES.map((t) => t.id);
  cachedTheme = validIds.includes(raw as ThemeId) ? (raw as ThemeId) : DEFAULT_THEME;
  return cachedTheme;
}

export function useBlockPuzzleTheme(): ThemeId {
  return useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
}

export function setBlockPuzzleTheme(id: ThemeId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, id);
  notify();
}

// Combined word pool for the 2-minute vocabulary quiz — same fallback logic
// as Puyo/Tetris's quiz word hooks.
export function useBlockPuzzleQuizWords(): Word[] {
  const sources = useBlockPuzzleWordSources();
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
