import { useSyncExternalStore } from 'react';

const TERM_COUNT_KEY = 'coord_hunt_terms';
const MAX_VALUE_KEY = 'coord_hunt_max_value';
const TIME_LIMIT_KEY = 'coord_hunt_time_limit';

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

const DEFAULT_TERMS: CoordTermCount = 3;
const DEFAULT_MAX_VALUE: CoordMaxValue = 9;
const DEFAULT_TIME_LIMIT: CoordTimeLimit = 180;

const listeners = new Set<() => void>();
let cachedTermsRaw: string | null = null;
let cachedTerms: CoordTermCount = DEFAULT_TERMS;
let cachedMaxValueRaw: string | null = null;
let cachedMaxValue: CoordMaxValue = DEFAULT_MAX_VALUE;
let cachedTimeLimitRaw: string | null = null;
let cachedTimeLimit: CoordTimeLimit = DEFAULT_TIME_LIMIT;

function readTerms(): CoordTermCount {
  const raw = localStorage.getItem(TERM_COUNT_KEY);
  if (raw === cachedTermsRaw) return cachedTerms;
  cachedTermsRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_TERMS;
  cachedTerms = (TERM_COUNT_OPTIONS as readonly number[]).includes(n) ? (n as CoordTermCount) : DEFAULT_TERMS;
  return cachedTerms;
}

function readMaxValue(): CoordMaxValue {
  const raw = localStorage.getItem(MAX_VALUE_KEY);
  if (raw === cachedMaxValueRaw) return cachedMaxValue;
  cachedMaxValueRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_MAX_VALUE;
  const valid = COORD_NUMBER_RANGE_OPTIONS.map((o) => o.value) as number[];
  cachedMaxValue = valid.includes(n) ? (n as CoordMaxValue) : DEFAULT_MAX_VALUE;
  return cachedMaxValue;
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

export function useCoordTermCount(): CoordTermCount {
  return useSyncExternalStore(subscribe, readTerms, () => DEFAULT_TERMS);
}

export function useCoordMaxValue(): CoordMaxValue {
  return useSyncExternalStore(subscribe, readMaxValue, () => DEFAULT_MAX_VALUE);
}

export function useCoordTimeLimit(): CoordTimeLimit {
  return useSyncExternalStore(subscribe, readTimeLimit, () => DEFAULT_TIME_LIMIT);
}

export function setCoordTermCount(n: CoordTermCount): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TERM_COUNT_KEY, String(n));
  notify();
}

export function setCoordMaxValue(v: CoordMaxValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MAX_VALUE_KEY, String(v));
  notify();
}

export function setCoordTimeLimit(v: CoordTimeLimit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TIME_LIMIT_KEY, String(v));
  notify();
}
