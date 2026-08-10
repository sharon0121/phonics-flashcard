import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'klotski_progress';
const ITEMS_USED_KEY = 'klotski_solution_items_used';

// A "看解答" use is a consumable item, earned once every LEVELS_PER_ITEM
// distinct levels cleared (across all difficulties) — not something
// available on tap for every level.
export const LEVELS_PER_ITEM = 10;

export interface KlotskiLevelProgress {
  completed: boolean;
  bestMoves: number | null; // fewest moves the child has finished this level in, across attempts
  usedSolution: boolean; // true if any completion of this level came from watching 看解答
}

type ProgressMap = Record<string, KlotskiLevelProgress>;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedProgress: ProgressMap = {};

function readProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedProgress;
  cachedRaw = raw;
  try {
    cachedProgress = raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    cachedProgress = {};
  }
  return cachedProgress;
}

function writeProgress(progress: ProgressMap): void {
  const raw = JSON.stringify(progress);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedProgress = progress;
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

const EMPTY: ProgressMap = {};

export function useKlotskiProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, readProgress, () => EMPTY);
}

export function recordKlotskiCompletion(levelId: string, moves: number, usedSolution: boolean): void {
  const progress = readProgress();
  const prior = progress[levelId];
  const bestMoves = usedSolution
    ? (prior?.bestMoves ?? null)
    : prior?.bestMoves != null
      ? Math.min(prior.bestMoves, moves)
      : moves;
  writeProgress({
    ...progress,
    [levelId]: {
      completed: true,
      bestMoves,
      usedSolution: usedSolution && !(prior?.completed && !prior.usedSolution),
    },
  });
}

export function countCompletedLevels(progress: ProgressMap): number {
  return Object.values(progress).filter((p) => p.completed).length;
}

let cachedItemsRaw: string | null = null;
let cachedItemsUsed = 0;

function readItemsUsed(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(ITEMS_USED_KEY);
  if (raw === cachedItemsRaw) return cachedItemsUsed;
  cachedItemsRaw = raw;
  const n = raw ? parseInt(raw, 10) : 0;
  cachedItemsUsed = Number.isFinite(n) ? n : 0;
  return cachedItemsUsed;
}

function writeItemsUsed(n: number): void {
  const raw = String(n);
  localStorage.setItem(ITEMS_USED_KEY, raw);
  cachedItemsRaw = raw;
  cachedItemsUsed = n;
  listeners.forEach((l) => l());
}

export function useKlotskiSolutionItemsUsed(): number {
  return useSyncExternalStore(subscribe, readItemsUsed, () => 0);
}

export function consumeKlotskiSolutionItem(): void {
  writeItemsUsed(readItemsUsed() + 1);
}

// ── Sync-friendly load/save (used by src/lib/sync.ts) ────────────────────────
export function loadKlotskiProgress(): ProgressMap { return readProgress(); }
export function saveKlotskiProgress(p: ProgressMap): void { writeProgress(p); }
export function loadKlotskiItemsUsed(): number { return readItemsUsed(); }
export function saveKlotskiItemsUsed(n: number): void { writeItemsUsed(n); }
export { subscribe as subscribeKlotski };

export function resetKlotskiProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ITEMS_USED_KEY);
  cachedRaw = null;
  cachedProgress = {};
  cachedItemsRaw = null;
  cachedItemsUsed = 0;
  listeners.forEach((l) => l());
}
