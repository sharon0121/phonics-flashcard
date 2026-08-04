import { useSyncExternalStore } from 'react';
import { ladderTierValue } from '@/lib/heroClimbSettings';

export { ladderTierValue };

const TERM_COUNT_KEY = 'coord_hunt_terms_multi';
const MAX_VALUE_KEY = 'coord_hunt_max_value_multi';
const TIME_LIMIT_KEY = 'coord_hunt_time_limit';

// Multi-select difficulty ladders — same mechanic as 時空戰術隊/憤怒牛: sort
// selected values ascending, step up a tier every 10-streak of correct digs.
export const TERM_COUNT_OPTIONS = [2, 3, 4] as const;
export type CoordTermCount = (typeof TERM_COUNT_OPTIONS)[number];

export const COORD_NUMBER_RANGE_OPTIONS = [
  { value: 9, label: '個位數' },
  { value: 20, label: '20 以內' },
  { value: 30, label: '30 以內' },
  { value: 40, label: '40 以內' },
] as const;
export type CoordMaxValue = (typeof COORD_NUMBER_RANGE_OPTIONS)[number]['value'];

export const TIME_LIMIT_OPTIONS = [
  { value: 60, label: '1 分鐘' },
  { value: 120, label: '2 分鐘' },
  { value: 180, label: '3 分鐘' },
  { value: 300, label: '5 分鐘' },
] as const;
export type CoordTimeLimit = (typeof TIME_LIMIT_OPTIONS)[number]['value'];

const VALID_TERM_VALUES = TERM_COUNT_OPTIONS as readonly number[];
const VALID_RANGE_VALUES = COORD_NUMBER_RANGE_OPTIONS.map((o) => o.value) as number[];

const DEFAULT_TERMS: number[] = [3];
const DEFAULT_MAX_VALUES: number[] = [9];
const DEFAULT_TIME_LIMIT: CoordTimeLimit = 180;

const listeners = new Set<() => void>();
let cachedTermsRaw: string | null = null;
let cachedTerms: number[] = DEFAULT_TERMS;
let cachedMaxValueRaw: string | null = null;
let cachedMaxValues: number[] = DEFAULT_MAX_VALUES;
let cachedTimeLimitRaw: string | null = null;
let cachedTimeLimit: CoordTimeLimit = DEFAULT_TIME_LIMIT;

function readTerms(): number[] {
  const raw = localStorage.getItem(TERM_COUNT_KEY);
  if (raw === cachedTermsRaw) return cachedTerms;
  cachedTermsRaw = raw;
  if (raw == null) { cachedTerms = DEFAULT_TERMS; return cachedTerms; }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed) ? parsed.filter((v): v is number => VALID_TERM_VALUES.includes(v as number)) : [];
    cachedTerms = valid.length > 0 ? valid : DEFAULT_TERMS;
  } catch { cachedTerms = DEFAULT_TERMS; }
  return cachedTerms;
}

function readMaxValues(): number[] {
  const raw = localStorage.getItem(MAX_VALUE_KEY);
  if (raw === cachedMaxValueRaw) return cachedMaxValues;
  cachedMaxValueRaw = raw;
  if (raw == null) { cachedMaxValues = DEFAULT_MAX_VALUES; return cachedMaxValues; }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed) ? parsed.filter((v): v is number => VALID_RANGE_VALUES.includes(v as number)) : [];
    cachedMaxValues = valid.length > 0 ? valid : DEFAULT_MAX_VALUES;
  } catch { cachedMaxValues = DEFAULT_MAX_VALUES; }
  return cachedMaxValues;
}

function readTimeLimit(): CoordTimeLimit {
  const raw = localStorage.getItem(TIME_LIMIT_KEY);
  if (raw === cachedTimeLimitRaw) return cachedTimeLimit;
  cachedTimeLimitRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_TIME_LIMIT;
  const valid = TIME_LIMIT_OPTIONS.map((o) => o.value) as number[];
  cachedTimeLimit = valid.includes(n) ? (n as CoordTimeLimit) : DEFAULT_TIME_LIMIT;
  return cachedTimeLimit;
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

export function useCoordTermCounts(): number[] {
  return useSyncExternalStore(subscribe, readTerms, () => DEFAULT_TERMS);
}

export function useCoordMaxValues(): number[] {
  return useSyncExternalStore(subscribe, readMaxValues, () => DEFAULT_MAX_VALUES);
}

export function useCoordTimeLimit(): CoordTimeLimit {
  return useSyncExternalStore(subscribe, readTimeLimit, () => DEFAULT_TIME_LIMIT);
}

export function setCoordTermCounts(values: number[]): void {
  if (typeof window === 'undefined') return;
  const safe = values.length > 0 ? values : DEFAULT_TERMS;
  localStorage.setItem(TERM_COUNT_KEY, JSON.stringify(safe));
  notify();
}

export function setCoordMaxValues(values: number[]): void {
  if (typeof window === 'undefined') return;
  const safe = values.length > 0 ? values : DEFAULT_MAX_VALUES;
  localStorage.setItem(MAX_VALUE_KEY, JSON.stringify(safe));
  notify();
}

export function setCoordTimeLimit(v: CoordTimeLimit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TIME_LIMIT_KEY, String(v));
  notify();
}
