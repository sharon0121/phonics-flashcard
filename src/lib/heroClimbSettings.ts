import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';

const MARQUEE_SPEED_KEY = 'hero_climb_marquee_speed';
const SPEECH_RATE_KEY = 'hero_climb_speech_rate';
const START_DIFFICULTY_KEY = 'hero_climb_start_difficulty';

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';
export type SpeechRate = 'slow' | 'normal' | 'fast';
export type StartDifficulty = 'normal' | 'tier1' | 'tier2' | 'tier3' | 'max';

// Seconds per item for the leaderboard marquee scroll.
export const MARQUEE_SECONDS_PER_ITEM: Record<MarqueeSpeed, number> = { slow: 3, normal: 1.8, fast: 1 };
// Actual rate value passed to SpeechSynthesisUtterance.rate.
export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = { slow: 0.7, normal: 1.0, fast: 1.3 };
// Starting difficulty multiplier — each tier corresponds to having completed one word-based speed step.
export const START_DIFFICULTY_VALUES: Record<StartDifficulty, number> = {
  normal: 1.0,
  tier1: 1.2,
  tier2: 1.4,
  tier3: 1.6,
  max: 1.8,
};

const DEFAULT_MARQUEE_SPEED: MarqueeSpeed = 'normal';
const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';
const DEFAULT_START_DIFFICULTY: StartDifficulty = 'normal';

const EMPTY_WORDS: Word[] = [];

const listeners = new Set<() => void>();
let cachedMarqueeRaw: string | null = null;
let cachedMarqueeSpeed: MarqueeSpeed = DEFAULT_MARQUEE_SPEED;
let cachedSpeechRaw: string | null = null;
let cachedSpeechRate: SpeechRate = DEFAULT_SPEECH_RATE;
let cachedStartDiffRaw: string | null = null;
let cachedStartDiff: StartDifficulty = DEFAULT_START_DIFFICULTY;

function readMarqueeSpeed(): MarqueeSpeed {
  const raw = localStorage.getItem(MARQUEE_SPEED_KEY);
  if (raw === cachedMarqueeRaw) return cachedMarqueeSpeed;
  cachedMarqueeRaw = raw;
  cachedMarqueeSpeed = raw === 'slow' || raw === 'normal' || raw === 'fast' ? raw : DEFAULT_MARQUEE_SPEED;
  return cachedMarqueeSpeed;
}

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

export function useMarqueeSpeed(): MarqueeSpeed {
  return useSyncExternalStore(subscribe, readMarqueeSpeed, () => DEFAULT_MARQUEE_SPEED);
}

export function setMarqueeSpeed(speed: MarqueeSpeed): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MARQUEE_SPEED_KEY, speed);
  notify();
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
  const weekKey = getCurrentWeekKey();
  const ids = new Set(curriculum[weekKey] ?? []);
  if (ids.size === 0) return EMPTY_WORDS;
  const result = PHONICS_WORDS.filter((w) => ids.has(w.id));
  return result.length > 0 ? result : EMPTY_WORDS;
}

// Words flagged "needs reinforcement" (🔥 加強) in the flashcard progress tracker.
export function useReinforcementClimbWords(): Word[] {
  const progress = useProgress();
  const result = PHONICS_WORDS.filter((w) => progress[w.id]?.needsReinforcement === true);
  return result.length > 0 ? result : EMPTY_WORDS;
}
