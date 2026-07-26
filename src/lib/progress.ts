import type { ProgressMap, ProgressEntry } from './types';

const STORAGE_KEY = 'phonics_progress';

export function loadProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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
}
