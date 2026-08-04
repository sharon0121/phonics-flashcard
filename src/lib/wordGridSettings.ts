import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import { sightWords as SIGHT_WORDS } from '@/data/sightWords';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey, getActiveWordIds } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';
import { useCustomWords } from '@/lib/customWords';
import {
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  SPEECH_RATE_VALUES,
  type WordSourceKey,
  type SpeechRate,
} from '@/lib/heroClimbSettings';

export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, SPEECH_RATE_VALUES, type WordSourceKey, type SpeechRate };

const WORD_SOURCES_KEY = 'word_grid_sources';
const SPEECH_RATE_KEY = 'word_grid_speech_rate';

const DEFAULT_WORD_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];
const DEFAULT_SPEECH_RATE: SpeechRate = 'normal';
const EMPTY_WORDS: Word[] = [];

const listeners = new Set<() => void>();
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;
let cachedSpeechRaw: string | null = null;
let cachedSpeechRate: SpeechRate = DEFAULT_SPEECH_RATE;

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

export function useWordGridSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function setWordGridSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

export function useWordGridSpeechRate(): SpeechRate {
  return useSyncExternalStore(subscribe, readSpeechRate, () => DEFAULT_SPEECH_RATE);
}

export function setWordGridSpeechRate(rate: SpeechRate): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPEECH_RATE_KEY, rate);
  notify();
}

// Word pools grouped by source, narrowest scope first — same priority
// convention as the other games' word sources.
export function useWordGridPools(): Word[][] {
  const curriculum = useCurriculum();
  const progress = useProgress();
  const customWords = useCustomWords();
  const sources = useWordGridSources();

  const weekKey = getCurrentWeekKey();
  const weekIds = new Set(getActiveWordIds(curriculum, progress, weekKey));
  const weekWords = weekIds.size > 0 ? PHONICS_WORDS.filter((w) => weekIds.has(w.id)) : EMPTY_WORDS;
  const reinforcementWords = [...PHONICS_WORDS, ...SIGHT_WORDS].filter((w) => progress[w.id]?.needsReinforcement === true);

  const tiers: Array<{ key: WordSourceKey; words: Word[] }> = [
    { key: 'thisWeek', words: weekWords },
    { key: 'reinforcement', words: reinforcementWords },
    { key: 'custom', words: customWords },
    { key: 'phonics', words: PHONICS_WORDS },
    { key: 'sightWords', words: SIGHT_WORDS },
  ];
  return tiers.filter((t) => sources.includes(t.key) && t.words.length > 0).map((t) => t.words);
}
