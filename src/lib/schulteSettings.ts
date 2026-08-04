import { useSyncExternalStore } from 'react';

// Grid is always fixed at 5x5 (25 cells) — no size setting; content longer
// than 25 items (注音/英文字母) auto-splits into sequential 25-item batches.
export const SCHULTE_GRID_DIM = 5;

const MODE_KEY = 'schulte_mode';
const TIME_LIMIT_KEY = 'schulte_time_limit';

export type SchulteMode = 'timedLimit' | 'stopwatch';
export const MODE_OPTIONS: { value: SchulteMode; label: string; desc: string }[] = [
  { value: 'stopwatch', label: '計時挑戰', desc: '不限時，看多快能按完，挑戰個人最佳紀錄' },
  { value: 'timedLimit', label: '限時模式', desc: '時間到還沒按完就算失敗' },
];

export const TIME_LIMIT_OPTIONS = [30, 60, 90, 120] as const;
export type SchulteTimeLimit = (typeof TIME_LIMIT_OPTIONS)[number];

const DEFAULT_MODE: SchulteMode = 'stopwatch';
const DEFAULT_TIME_LIMIT: SchulteTimeLimit = 60;

const listeners = new Set<() => void>();
let cachedModeRaw: string | null = null;
let cachedMode: SchulteMode = DEFAULT_MODE;
let cachedTimeLimitRaw: string | null = null;
let cachedTimeLimit: SchulteTimeLimit = DEFAULT_TIME_LIMIT;

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

export function useSchulteMode(): SchulteMode {
  return useSyncExternalStore(subscribe, readMode, () => DEFAULT_MODE);
}

export function useSchulteTimeLimit(): SchulteTimeLimit {
  return useSyncExternalStore(subscribe, readTimeLimit, () => DEFAULT_TIME_LIMIT);
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
