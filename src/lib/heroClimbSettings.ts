import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import { sightWords as SIGHT_WORDS } from '@/data/sightWords';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey, getActiveWordIds } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';

const SPEECH_RATE_KEY = 'hero_climb_speech_rate';
const START_DIFFICULTY_KEY = 'hero_climb_start_difficulty';
const WORD_SOURCES_KEY = 'hero_climb_word_sources';

export type SpeechRate = 'slow' | 'normal' | 'fast';
export type StartDifficulty = 'normal' | 'tier1' | 'tier2' | 'tier3' | 'max';
export type WordSourceKey = 'thisWeek' | 'reinforcement' | 'custom' | 'phonics' | 'sightWords';

export const WORD_SOURCE_LABELS: Record<WordSourceKey, string> = {
  phonics: '自然發音卡',
  sightWords: '重要單字卡',
  thisWeek: '本週單字',
  custom: '自訂單字',
  reinforcement: '加強單字',
};
// Order the checklist is displayed in — independent of pickNextTargetWord's
// own priority (curated pools first, big general banks last).
export const WORD_SOURCE_DISPLAY_ORDER: WordSourceKey[] = [
  'phonics',
  'sightWords',
  'thisWeek',
  'custom',
  'reinforcement',
];
export const ALL_WORD_SOURCES: WordSourceKey[] = [...WORD_SOURCE_DISPLAY_ORDER];

// Actual rate value passed to SpeechSynthesisUtterance.rate.
export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = { slow: 0.7, normal: 1.0, fast: 1.3 };

// Shared math-difficulty-ladder mechanic (originally 時空戰術隊's): when a
// math setting is a multi-select list rather than one fixed value, sort the
// selected values ascending and step one tier for every 10-streak of
// correct answers, capped at the hardest selected tier. Used by any game
// whose math settings were converted to this multi-select style.
export function ladderTierValue(sortedValues: number[], streak: number): number {
  const idx = Math.min(Math.floor(streak / 10), Math.max(0, sortedValues.length - 1));
  return sortedValues[Math.max(0, idx)];
}
// Starting difficulty multiplier — each tier corresponds to having completed one word-based speed step.
export const START_DIFFICULTY_VALUES: Record<StartDifficulty, number> = {
  normal: 1.0,
  tier1: 1.2,
  tier2: 1.4,
  tier3: 1.6,
  max: 1.8,
};

const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';
const DEFAULT_START_DIFFICULTY: StartDifficulty = 'normal';
// Everything enabled by default — matches the old hard-coded cascade that
// always drew from every pool.
const DEFAULT_WORD_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];

const EMPTY_WORDS: Word[] = [];

const listeners = new Set<() => void>();
let cachedSpeechRaw: string | null = null;
let cachedSpeechRate: SpeechRate = DEFAULT_SPEECH_RATE;
let cachedStartDiffRaw: string | null = null;
let cachedStartDiff: StartDifficulty = DEFAULT_START_DIFFICULTY;
let cachedWordSourcesRaw: string | null = null;
let cachedWordSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;

function readSpeechRate(): SpeechRate {
  const raw = localStorage.getItem(SPEECH_RATE_KEY);
  if (raw === cachedSpeechRaw) return cachedSpeechRate;
  cachedSpeechRaw = raw;
  cachedSpeechRate = raw === 'slow' || raw === 'normal' || raw === 'fast' ? raw : DEFAULT_SPEECH_RATE;
  return cachedSpeechRate;
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

export function useSpeechRate(): SpeechRate {
  return useSyncExternalStore(subscribe, readSpeechRate, () => DEFAULT_SPEECH_RATE);
}

function readStartDifficulty(): StartDifficulty {
  const raw = localStorage.getItem(START_DIFFICULTY_KEY);
  if (raw === cachedStartDiffRaw) return cachedStartDiff;
  cachedStartDiffRaw = raw;
  const valid: StartDifficulty[] = ['normal', 'tier1', 'tier2', 'tier3', 'max'];
  cachedStartDiff = valid.includes(raw as StartDifficulty) ? (raw as StartDifficulty) : DEFAULT_START_DIFFICULTY;
  return cachedStartDiff;
}

export function useStartDifficulty(): StartDifficulty {
  return useSyncExternalStore(subscribe, readStartDifficulty, () => DEFAULT_START_DIFFICULTY);
}

function readWordSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedWordSourcesRaw) return cachedWordSources;
  cachedWordSourcesRaw = raw;
  if (raw == null) {
    cachedWordSources = DEFAULT_WORD_SOURCES;
    return cachedWordSources;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed) ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey)) : [];
    cachedWordSources = valid.length > 0 ? valid : DEFAULT_WORD_SOURCES;
  } catch {
    cachedWordSources = DEFAULT_WORD_SOURCES;
  }
  return cachedWordSources;
}

export function useWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  // Never let the game end up with zero sources — that would leave nothing
  // to draw target words from. Falls back to every source enabled.
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

export function setStartDifficulty(d: StartDifficulty): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(START_DIFFICULTY_KEY, d);
  notify();
}

export function setSpeechRate(rate: SpeechRate): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPEECH_RATE_KEY, rate);
  notify();
}

// This week's curriculum words, in full Word form (need zhuyin for the
// ladder option cards, unlike the maze game's trimmed-down MazeWord).
export function useThisWeekClimbWords(): Word[] {
  const curriculum = useCurriculum();
  const progress = useProgress();
  const weekKey = getCurrentWeekKey();
  const ids = new Set(getActiveWordIds(curriculum, progress, weekKey));
  if (ids.size === 0) return EMPTY_WORDS;
  const result = PHONICS_WORDS.filter((w) => ids.has(w.id));
  return result.length > 0 ? result : EMPTY_WORDS;
}

// Words flagged "needs reinforcement" (🔥 加強) in the flashcard progress
// tracker — checked across both the phonics bank and sight words, since
// either kind of card can be flagged from its own browse page.
export function useReinforcementClimbWords(): Word[] {
  const progress = useProgress();
  const result = [...PHONICS_WORDS, ...SIGHT_WORDS].filter((w) => progress[w.id]?.needsReinforcement === true);
  return result.length > 0 ? result : EMPTY_WORDS;
}

// The two big general word banks, exposed here so HeroClimbView doesn't need
// to reach into @/data directly — keeps every hero-climb word source in one
// module.
export function usePhonicsClimbWords(): Word[] {
  return PHONICS_WORDS;
}

export function useSightWordsClimb(): Word[] {
  return SIGHT_WORDS;
}
