import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import { sightWords as SIGHT_WORDS } from '@/data/sightWords';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey, getActiveWordIds } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';
import { useCustomWords } from '@/lib/customWords';
import { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey } from '@/lib/heroClimbSettings';

export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey };

// ─── Storage keys ─────────────────────────────────────────────────────────────
const WORD_SOURCES_KEY  = 'angry_cow_word_sources';
const MAX_VALUE_KEY     = 'angry_cow_max_value';
const SPEECH_RATE_KEY   = 'angry_cow_speech_rate';
const GAME_MODE_KEY     = 'angry_cow_game_mode';
const MATH_TERMS_KEY    = 'angry_cow_math_terms';

// ─── Number range ──────────────────────────────────────────────────────────────
export const NUMBER_RANGE_OPTIONS = [
  { value: 10, label: '10 以內' },
  { value: 20, label: '20 以內' },
  { value: 30, label: '30 以內' },
] as const;
export type AngryCowMaxValue = (typeof NUMBER_RANGE_OPTIONS)[number]['value'];

// ─── Speech rate ───────────────────────────────────────────────────────────────
export type SpeechRate = 'slow' | 'normal' | 'fast';
export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = { slow: 0.7, normal: 1.0, fast: 1.3 };

// ─── Game mode ────────────────────────────────────────────────────────────────
export type AngryCowGameMode = 'english' | 'math' | 'mixed';
export const GAME_MODE_OPTIONS: { value: AngryCowGameMode; label: string; emoji: string }[] = [
  { value: 'english', label: '英文版', emoji: '🔤' },
  { value: 'math',    label: '數學版', emoji: '🧮' },
  { value: 'mixed',   label: '英文+數學', emoji: '🎯' },
];

// ─── Math terms ───────────────────────────────────────────────────────────────
export type AngryCowMathTerms = 2 | 3 | 4 | 5 | 6;
export const MATH_TERMS_OPTIONS: { value: AngryCowMathTerms; label: string }[] = [
  { value: 2, label: '2 個（含加減）' },
  { value: 3, label: '3 個' },
  { value: 4, label: '4 個' },
  { value: 5, label: '5 個' },
  { value: 6, label: '6 個' },
];

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_WORD_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];
const DEFAULT_MAX_VALUE: AngryCowMaxValue = 20;
const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';
const DEFAULT_GAME_MODE: AngryCowGameMode = 'english';
const DEFAULT_MATH_TERMS: AngryCowMathTerms = 3;

const EMPTY_WORDS: Word[] = [];

// ─── External store ───────────────────────────────────────────────────────────
const listeners = new Set<() => void>();
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;
let cachedMaxValueRaw: string | null = null;
let cachedMaxValue: AngryCowMaxValue = DEFAULT_MAX_VALUE;
let cachedSpeechRaw: string | null = null;
let cachedSpeechRate: SpeechRate = DEFAULT_SPEECH_RATE;
let cachedGameModeRaw: string | null = null;
let cachedGameMode: AngryCowGameMode = DEFAULT_GAME_MODE;
let cachedMathTermsRaw: string | null = null;
let cachedMathTerms: AngryCowMathTerms = DEFAULT_MATH_TERMS;

function readWordSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedSourcesRaw) return cachedSources;
  cachedSourcesRaw = raw;
  if (raw == null) { cachedSources = DEFAULT_WORD_SOURCES; return cachedSources; }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed) ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey)) : [];
    cachedSources = valid.length > 0 ? valid : DEFAULT_WORD_SOURCES;
  } catch { cachedSources = DEFAULT_WORD_SOURCES; }
  return cachedSources;
}

function readMaxValue(): AngryCowMaxValue {
  const raw = localStorage.getItem(MAX_VALUE_KEY);
  if (raw === cachedMaxValueRaw) return cachedMaxValue;
  cachedMaxValueRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_MAX_VALUE;
  const valid = NUMBER_RANGE_OPTIONS.map((o) => o.value) as number[];
  cachedMaxValue = valid.includes(n) ? (n as AngryCowMaxValue) : DEFAULT_MAX_VALUE;
  return cachedMaxValue;
}

function readSpeechRate(): SpeechRate {
  const raw = localStorage.getItem(SPEECH_RATE_KEY);
  if (raw === cachedSpeechRaw) return cachedSpeechRate;
  cachedSpeechRaw = raw;
  cachedSpeechRate = raw === 'slow' || raw === 'normal' || raw === 'fast' ? raw : DEFAULT_SPEECH_RATE;
  return cachedSpeechRate;
}

function readGameMode(): AngryCowGameMode {
  const raw = localStorage.getItem(GAME_MODE_KEY);
  if (raw === cachedGameModeRaw) return cachedGameMode;
  cachedGameModeRaw = raw;
  cachedGameMode = raw === 'english' || raw === 'math' || raw === 'mixed' ? raw : DEFAULT_GAME_MODE;
  return cachedGameMode;
}

function readMathTerms(): AngryCowMathTerms {
  const raw = localStorage.getItem(MATH_TERMS_KEY);
  if (raw === cachedMathTermsRaw) return cachedMathTerms;
  cachedMathTermsRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_MATH_TERMS;
  const valid = MATH_TERMS_OPTIONS.map((o) => o.value) as number[];
  cachedMathTerms = valid.includes(n) ? (n as AngryCowMathTerms) : DEFAULT_MATH_TERMS;
  return cachedMathTerms;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => { listeners.delete(callback); window.removeEventListener('storage', callback); };
}

function notify(): void { listeners.forEach((l) => l()); }

// ─── Word sources ─────────────────────────────────────────────────────────────
export function useAngryCowWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}
export function setAngryCowWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

// ─── Max value ────────────────────────────────────────────────────────────────
export function useAngryCowMaxValue(): AngryCowMaxValue {
  return useSyncExternalStore(subscribe, readMaxValue, () => DEFAULT_MAX_VALUE);
}
export function setAngryCowMaxValue(v: AngryCowMaxValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MAX_VALUE_KEY, String(v));
  notify();
}

// ─── Speech rate ──────────────────────────────────────────────────────────────
export function useAngryCowSpeechRate(): SpeechRate {
  return useSyncExternalStore(subscribe, readSpeechRate, () => DEFAULT_SPEECH_RATE);
}
export function setAngryCowSpeechRate(rate: SpeechRate): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPEECH_RATE_KEY, rate);
  notify();
}

// ─── Game mode ────────────────────────────────────────────────────────────────
export function useAngryCowGameMode(): AngryCowGameMode {
  return useSyncExternalStore(subscribe, readGameMode, () => DEFAULT_GAME_MODE);
}
export function setAngryCowGameMode(mode: AngryCowGameMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GAME_MODE_KEY, mode);
  notify();
}

// ─── Math terms ───────────────────────────────────────────────────────────────
export function useAngryCowMathTerms(): AngryCowMathTerms {
  return useSyncExternalStore(subscribe, readMathTerms, () => DEFAULT_MATH_TERMS);
}
export function setAngryCowMathTerms(t: AngryCowMathTerms): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MATH_TERMS_KEY, String(t));
  notify();
}

// ─── Word pools (for English mode) ───────────────────────────────────────────
export function useAngryCowWordPools(): Word[][] {
  const curriculum = useCurriculum();
  const progress = useProgress();
  const customWords = useCustomWords();
  const sources = useAngryCowWordSources();

  const weekKey = getCurrentWeekKey();
  const weekIds = new Set(getActiveWordIds(curriculum, progress, weekKey));
  const weekWords = weekIds.size > 0 ? PHONICS_WORDS.filter((w) => weekIds.has(w.id)) : EMPTY_WORDS;
  const reinforcementWords = [...PHONICS_WORDS, ...SIGHT_WORDS].filter((w) => progress[w.id]?.needsReinforcement === true);

  const tiers: Array<{ key: WordSourceKey; words: Word[] }> = [
    { key: 'thisWeek',      words: weekWords },
    { key: 'reinforcement', words: reinforcementWords },
    { key: 'custom',        words: customWords },
    { key: 'phonics',       words: PHONICS_WORDS },
    { key: 'sightWords',    words: SIGHT_WORDS },
  ];
  return tiers.filter((t) => sources.includes(t.key)).map((t) => t.words);
}
