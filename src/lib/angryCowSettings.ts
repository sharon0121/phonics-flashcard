import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import { sightWords as SIGHT_WORDS } from '@/data/sightWords';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';
import { useCustomWords } from '@/lib/customWords';
import { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey } from '@/lib/heroClimbSettings';

// Re-exported so settings/EnglishMode components only need to import from
// this one module — the label/order constants are generic (not hero-climb
// specific) so we reuse them rather than duplicate, but this game's actual
// enabled-sources storage is kept independent (own key) from hero-climb's.
export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey };

const WORD_SOURCES_KEY = 'angry_cow_word_sources';
const MAX_VALUE_KEY = 'angry_cow_max_value';
const SPEECH_RATE_KEY = 'angry_cow_speech_rate';

export const NUMBER_RANGE_OPTIONS = [
  { value: 9, label: '個位數' },
  { value: 20, label: '20 以內' },
  { value: 30, label: '30 以內' },
  { value: 40, label: '40 以內' },
] as const;
export type AngryCowMaxValue = (typeof NUMBER_RANGE_OPTIONS)[number]['value'];

export type SpeechRate = 'slow' | 'normal' | 'fast';
export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = { slow: 0.7, normal: 1.0, fast: 1.3 };

const DEFAULT_WORD_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];
const DEFAULT_MAX_VALUE: AngryCowMaxValue = 20;
const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';

const EMPTY_WORDS: Word[] = [];

const listeners = new Set<() => void>();
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;
let cachedMaxValueRaw: string | null = null;
let cachedMaxValue: AngryCowMaxValue = DEFAULT_MAX_VALUE;
let cachedSpeechRaw: string | null = null;
let cachedSpeechRate: SpeechRate = DEFAULT_SPEECH_RATE;

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
    const valid = Array.isArray(parsed) ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey)) : [];
    cachedSources = valid.length > 0 ? valid : DEFAULT_WORD_SOURCES;
  } catch {
    cachedSources = DEFAULT_WORD_SOURCES;
  }
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

export function useAngryCowWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setAngryCowWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

export function useAngryCowMaxValue(): AngryCowMaxValue {
  return useSyncExternalStore(subscribe, readMaxValue, () => DEFAULT_MAX_VALUE);
}

export function setAngryCowMaxValue(v: AngryCowMaxValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MAX_VALUE_KEY, String(v));
  notify();
}

export function useAngryCowSpeechRate(): SpeechRate {
  return useSyncExternalStore(subscribe, readSpeechRate, () => DEFAULT_SPEECH_RATE);
}

export function setAngryCowSpeechRate(rate: SpeechRate): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPEECH_RATE_KEY, rate);
  notify();
}

// Priority order the target word is drawn from — curated pools first, the
// two big general banks last, matching hero-climb's convention. Only pools
// whose source is enabled are included at all.
export function useAngryCowWordPools(): Word[][] {
  const curriculum = useCurriculum();
  const progress = useProgress();
  const customWords = useCustomWords();
  const sources = useAngryCowWordSources();

  const weekKey = getCurrentWeekKey();
  const weekIds = new Set(curriculum[weekKey] ?? []);
  const weekWords = weekIds.size > 0 ? PHONICS_WORDS.filter((w) => weekIds.has(w.id)) : EMPTY_WORDS;
  const reinforcementWords = [...PHONICS_WORDS, ...SIGHT_WORDS].filter((w) => progress[w.id]?.needsReinforcement === true);

  const tiers: Array<{ key: WordSourceKey; words: Word[] }> = [
    { key: 'thisWeek', words: weekWords },
    { key: 'reinforcement', words: reinforcementWords },
    { key: 'custom', words: customWords },
    { key: 'phonics', words: PHONICS_WORDS },
    { key: 'sightWords', words: SIGHT_WORDS },
  ];
  return tiers.filter((t) => sources.includes(t.key)).map((t) => t.words);
}
