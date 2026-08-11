import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'monster_dessert_progress';

interface MonsterDessertProgress {
  coins: number;
  roundsCompleted: number;
  bestCombo: number;
}

const DEFAULT_PROGRESS: MonsterDessertProgress = { coins: 0, roundsCompleted: 0, bestCombo: 0 };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: MonsterDessertProgress = DEFAULT_PROGRESS;

function readProgress(): MonsterDessertProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? { ...DEFAULT_PROGRESS, ...(JSON.parse(raw) as Partial<MonsterDessertProgress>) } : DEFAULT_PROGRESS;
  } catch {
    cached = DEFAULT_PROGRESS;
  }
  return cached;
}

function writeProgress(progress: MonsterDessertProgress): void {
  const raw = JSON.stringify(progress);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cached = progress;
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

export function useMonsterDessertProgress(): MonsterDessertProgress {
  return useSyncExternalStore(subscribe, readProgress, () => DEFAULT_PROGRESS);
}

export function recordMonsterDessertRound(coinsEarned: number, comboAfter: number): void {
  if (typeof window === 'undefined') return;
  const fresh = readProgress();
  writeProgress({
    coins: fresh.coins + coinsEarned,
    roundsCompleted: fresh.roundsCompleted + 1,
    bestCombo: Math.max(fresh.bestCombo, comboAfter),
  });
}
