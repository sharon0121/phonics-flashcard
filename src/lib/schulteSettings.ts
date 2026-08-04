import { useSyncExternalStore } from 'react';

const GRID_DIM_KEY = 'schulte_grid_dim';
const MODE_KEY = 'schulte_mode';
const TIME_LIMIT_KEY = 'schulte_time_limit';
const NUMBER_COUNT_KEY = 'schulte_number_count';

export const GRID_DIM_OPTIONS = [3, 4, 5] as const;
export type SchulteGridDim = (typeof GRID_DIM_OPTIONS)[number];

export type SchulteMode = 'timedLimit' | 'stopwatch';
export const MODE_OPTIONS: { value: SchulteMode; label: string; desc: string }[] = [
  { value: 'stopwatch', label: '計時挑戰', desc: '不限時，看多快能按完，挑戰個人最佳紀錄' },
  { value: 'timedLimit', label: '限時模式', desc: '時間到還沒按完就算失敗' },
];

export const TIME_LIMIT_OPTIONS = [30, 60, 90, 120] as const;
export type SchulteTimeLimit = (typeof TIME_LIMIT_OPTIONS)[number];

export const NUMBER_COUNT_OPTIONS = [20, 30, 50] as const;
export type SchulteNumberCount = (typeof NUMBER_COUNT_OPTIONS)[number];

const DEFAULT_GRID_DIM: SchulteGridDim = 4;
const DEFAULT_MODE: SchulteMode = 'stopwatch';
const DEFAULT_TIME_LIMIT: SchulteTimeLimit = 60;
const DEFAULT_NUMBER_COUNT: SchulteNumberCount = 30;

const listeners = new Set<() => void>();
let cachedGridRaw: string | null = null;
let cachedGridDim: SchulteGridDim = DEFAULT_GRID_DIM;
let cachedModeRaw: string | null = null;
let cachedMode: SchulteMode = DEFAULT_MODE;
let cachedTimeLimitRaw: string | null = null;
let cachedTimeLimit: SchulteTimeLimit = DEFAULT_TIME_LIMIT;
let cachedNumberCountRaw: string | null = null;
let cachedNumberCount: SchulteNumberCount = DEFAULT_NUMBER_COUNT;

function readGridDim(): SchulteGridDim {
  const raw = localStorage.getItem(GRID_DIM_KEY);
  if (raw === cachedGridRaw) return cachedGridDim;
  cachedGridRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_GRID_DIM;
  cachedGridDim = (GRID_DIM_OPTIONS as readonly number[]).includes(n) ? (n as SchulteGridDim) : DEFAULT_GRID_DIM;
  return cachedGridDim;
}

function readMode(): SchulteMode {
  const raw = localStorage.getItem(MODE_KEY);
  if (raw === cachedModeRaw) return cachedMode;
  cachedModeRaw = raw;
  cachedMode = raw === 'timedLimit' || raw === 'stopwatch' ? raw : DEFAULT_MODE;
  return cachedMode;
}

function readTimeLimit(): SchulteTimeLimit {
  const raw = localStorage.getItem(TIME_LIMIT_KEY);
  if (raw === cachedTimeLimitRaw) return cachedTimeLimit;
  cachedTimeLimitRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_TIME_LIMIT;
  const valid = TIME_LIMIT_OPTIONS as readonly number[];
  cachedTimeLimit = valid.includes(n) ? (n as SchulteTimeLimit) : DEFAULT_TIME_LIMIT;
  return cachedTimeLimit;
}

function readNumberCount(): SchulteNumberCount {
  const raw = localStorage.getItem(NUMBER_COUNT_KEY);
  if (raw === cachedNumberCountRaw) return cachedNumberCount;
  cachedNumberCountRaw = raw;
  const n = raw ? Number(raw) : DEFAULT_NUMBER_COUNT;
  const valid = NUMBER_COUNT_OPTIONS as readonly number[];
  cachedNumberCount = valid.includes(n) ? (n as SchulteNumberCount) : DEFAULT_NUMBER_COUNT;
  return cachedNumberCount;
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

export function useSchulteGridDim(): SchulteGridDim {
  return useSyncExternalStore(subscribe, readGridDim, () => DEFAULT_GRID_DIM);
}

export function useSchulteMode(): SchulteMode {
  return useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE);
}

export function useSchulteTimeLimit(): SchulteTimeLimit {
  return useSyncExternalStore(subscribe, readTimeLimit, () => DEFAULT_TIME_LIMIT);
}

export function useSchulteNumberCount(): SchulteNumberCount {
  return useSyncExternalStore(subscribe, readNumberCount, () => DEFAULT_NUMBER_COUNT);
}

export function setSchulteGridDim(dim: SchulteGridDim): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GRID_DIM_KEY, String(dim));
  notify();
}

export function setSchulteMode(mode: SchulteMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODE_KEY, mode);
  notify();
}

export function setSchulteTimeLimit(sec: SchulteTimeLimit): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TIME_LIMIT_KEY, String(sec));
  notify();
}

export function setSchulteNumberCount(count: SchulteNumberCount): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NUMBER_COUNT_KEY, String(count));
  notify();
}
