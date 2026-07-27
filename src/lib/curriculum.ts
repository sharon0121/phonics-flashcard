import { useSyncExternalStore } from 'react';

// Week keys are the ISO date (YYYY-MM-DD) of that week's Monday. Plain
// string comparison then sorts/compares weeks correctly (no ISO week-number
// year-boundary edge cases to worry about).
export type CurriculumMap = Record<string, string[]>;

const STORAGE_KEY = 'curriculum_plan';

const EMPTY_CURRICULUM: CurriculumMap = {};

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedCurriculum: CurriculumMap = EMPTY_CURRICULUM;

function readStorage(): CurriculumMap {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedCurriculum;
  cachedRaw = raw;
  try {
    cachedCurriculum = raw ? (JSON.parse(raw) as CurriculumMap) : EMPTY_CURRICULUM;
  } catch {
    cachedCurriculum = EMPTY_CURRICULUM;
  }
  return cachedCurriculum;
}

function getSnapshot(): CurriculumMap {
  return readStorage();
}

function getServerSnapshot(): CurriculumMap {
  return EMPTY_CURRICULUM;
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

export function useCurriculum(): CurriculumMap {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function loadCurriculum(): CurriculumMap {
  if (typeof window === 'undefined') return EMPTY_CURRICULUM;
  return readStorage();
}

export function saveCurriculum(map: CurriculumMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  notify();
}

export function toggleWordInWeek(
  map: CurriculumMap,
  weekKey: string,
  wordId: string
): CurriculumMap {
  const current = map[weekKey] ?? [];
  const next = current.includes(wordId)
    ? current.filter((id) => id !== wordId)
    : [...current, wordId];
  return { ...map, [weekKey]: next };
}

// Reads the freshest snapshot straight from localStorage before applying the
// toggle, rather than trusting a possibly-stale React-state closure — several
// toggles fired in quick succession (fast clicking) would otherwise all base
// off the same stale snapshot and clobber each other on save.
export function toggleWordInWeekFresh(weekKey: string, wordId: string): void {
  const fresh = loadCurriculum();
  saveCurriculum(toggleWordInWeek(fresh, weekKey, wordId));
}

export function clearCurriculum(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}

// Clears only one week's assigned words, leaving every other week's plan intact.
export function clearWeek(weekKey: string): void {
  const fresh = loadCurriculum();
  const next = { ...fresh };
  delete next[weekKey];
  saveCurriculum(next);
}

// ---------------------------------------------------------------------------
// Week key helpers
// ---------------------------------------------------------------------------

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseKey(weekKey: string): Date {
  const [y, m, d] = weekKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getCurrentWeekKey(): string {
  return formatKey(mondayOf(new Date()));
}

export function shiftWeekKey(weekKey: string, deltaWeeks: number): string {
  const date = parseKey(weekKey);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return formatKey(date);
}

export function getWeekRangeLabel(weekKey: string): string {
  const start = parseKey(weekKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

// All word ids assigned in weeks up to and including `uptoWeekKey`
// (i.e. everything that has been "taught" by that point in the plan).
export function getTaughtWordIds(curriculum: CurriculumMap, uptoWeekKey: string): Set<string> {
  const ids = new Set<string>();
  for (const [weekKey, wordIds] of Object.entries(curriculum)) {
    if (weekKey <= uptoWeekKey) {
      for (const id of wordIds) ids.add(id);
    }
  }
  return ids;
}
