import { useSyncExternalStore } from 'react';
import type { Word } from './types';
import { LEVEL_CAP_OPTIONS, MAX_LEVEL, type LevelCap } from './spaceRacer';
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

export { LEVEL_CAP_OPTIONS, MAX_LEVEL, WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES };
export type { LevelCap, WordSourceKey };

const LEVEL_CAP_KEY = 'space_racer_level_cap';
const BEST_SCORE_KEY = 'space_racer_best_score';
const WORD_SOURCES_KEY = 'space_racer_word_sources';
const DEFAULT_LEVEL_CAP: LevelCap = 0;
// Defaults to just this week's curriculum words, matching Puyo/Tetris/Block Puzzle's quiz.
const DEFAULT_WORD_SOURCES: WordSourceKey[] = ['thisWeek'];

const listeners = new Set<() => void>();
let cachedCapRaw: string | null = null;
let cachedCap: LevelCap = DEFAULT_LEVEL_CAP;
let cachedBestRaw: string | null = null;
let cachedBest = 0;
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;

function readLevelCap(): LevelCap {
  const raw = localStorage.getItem(LEVEL_CAP_KEY);
  if (raw === cachedCapRaw) return cachedCap;
  cachedCapRaw = raw;
  const parsed = raw == null ? DEFAULT_LEVEL_CAP : Number(raw);
  const validValues = LEVEL_CAP_OPTIONS.map((o) => o.value);
  cachedCap = validValues.includes(parsed as LevelCap) ? (parsed as LevelCap) : DEFAULT_LEVEL_CAP;
  return cachedCap;
}

function readBestScore(): number {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  if (raw === cachedBestRaw) return cachedBest;
  cachedBestRaw = raw;
  const parsed = raw == null ? 0 : Number(raw);
  cachedBest = Number.isFinite(parsed) ? parsed : 0;
  return cachedBest;
}

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

export function useSpaceRacerLevelCap(): LevelCap {
  return useSyncExternalStore(subscribe, readLevelCap, () => DEFAULT_LEVEL_CAP);
}

export function setSpaceRacerLevelCap(cap: LevelCap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LEVEL_CAP_KEY, String(cap));
  notify();
}

export function useSpaceRacerBestScore(): number {
  return useSyncExternalStore(subscribe, readBestScore, () => 0);
}

export function reportSpaceRacerScore(score: number): void {
  if (typeof window === 'undefined') return;
  if (score > readBestScore()) {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
    notify();
  }
}

export function useSpaceRacerWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setSpaceRacerWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

// Combined word pool for the 2-minute vocabulary quiz — same fallback logic
// as Puyo/Tetris/Block Puzzle's quiz word hooks.
export function useSpaceRacerQuizWords(): Word[] {
  const sources = useSpaceRacerWordSources();
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
