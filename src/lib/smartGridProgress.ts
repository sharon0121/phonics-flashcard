import { useSyncExternalStore } from 'react';
import type { SmartGridDifficulty } from './smartGrid';

const STORAGE_KEY = 'smart_grid_progress';

export type SmartGridProgress = Record<SmartGridDifficulty, number>;

const EMPTY_PROGRESS: SmartGridProgress = { easy: 0, medium: 0, hard: 0 };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: SmartGridProgress = EMPTY_PROGRESS;

function readProgress(): SmartGridProgress {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<SmartGridProgress>) : {};
    cached = {
      easy: typeof parsed.easy === 'number' ? parsed.easy : 0,
      medium: typeof parsed.medium === 'number' ? parsed.medium : 0,
      hard: typeof parsed.hard === 'number' ? parsed.hard : 0,
    };
  } catch {
    cached = EMPTY_PROGRESS;
  }
  return cached;
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

export function useSmartGridProgress(): SmartGridProgress {
  return useSyncExternalStore(subscribe, readProgress, () => EMPTY_PROGRESS);
}

export function recordSmartGridSolved(difficulty: SmartGridDifficulty): void {
  if (typeof window === 'undefined') return;
  const fresh = readProgress();
  const next = { ...fresh, [difficulty]: fresh[difficulty] + 1 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify();
}

// Resets one difficulty's solved count back to 0 — used by the Settings page.
export function resetSmartGridProgress(difficulty: SmartGridDifficulty): void {
  if (typeof window === 'undefined') return;
  const fresh = readProgress();
  const next = { ...fresh, [difficulty]: 0 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify();
}
