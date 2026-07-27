import { useSyncExternalStore } from 'react';
import type { ProgressMap, ProgressEntry } from './types';

const STORAGE_KEY = 'phonics_progress';

const EMPTY_PROGRESS: ProgressMap = {};

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedProgress: ProgressMap = EMPTY_PROGRESS;

function readStorage(): ProgressMap {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedProgress;
  cachedRaw = raw;
  try {
    cachedProgress = raw ? (JSON.parse(raw) as ProgressMap) : EMPTY_PROGRESS;
  } catch {
    cachedProgress = EMPTY_PROGRESS;
  }
  return cachedProgress;
}

function getSnapshot(): ProgressMap {
  return readStorage();
}

function getServerSnapshot(): ProgressMap {
  return EMPTY_PROGRESS;
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
  listeners.forEach((listener) => listener());
}

export function useProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function loadProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  return readStorage();
}

export function saveProgress(map: ProgressMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  notify();
}

export function updateWordProgress(
  map: ProgressMap,
  wordId: string,
  field: keyof Pick<ProgressEntry, 'canPronounce' | 'canUnderstand'>,
  value: boolean
): ProgressMap {
  const existing = map[wordId] ?? {
    canPronounce: false,
    canUnderstand: false,
    learnedDate: new Date().toISOString().slice(0, 10),
  };
  return {
    ...map,
    [wordId]: {
      ...existing,
      [field]: value,
      learnedDate: new Date().toISOString().slice(0, 10),
    },
  };
}

export function clearProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

// Reads the freshest snapshot straight from localStorage before applying the
// update, rather than trusting a possibly-stale React-state closure — several
// toggles fired in quick succession (fast clicking) would otherwise all base
// off the same stale snapshot and clobber each other on save.
export function updateWordProgressFresh(
  wordId: string,
  field: keyof Pick<ProgressEntry, 'canPronounce' | 'canUnderstand'>,
  value: boolean
): void {
  const fresh = loadProgress();
  saveProgress(updateWordProgress(fresh, wordId, field, value));
}
