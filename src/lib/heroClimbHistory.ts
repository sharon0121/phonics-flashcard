import { useSyncExternalStore } from 'react';

export interface ClimbRecord {
  id: string;
  name: string;
  floor: number;
  wordsCompleted: number;
  timestamp: number;
}

const STORAGE_KEY = 'hero_climb_records';
const LAST_NAME_KEY = 'hero_climb_last_name';
const DEFAULT_NAME = '小英雄';
// A generous ceiling only — not an eviction policy. Records are meant to be
// kept permanently; this just guards against unbounded localStorage growth.
const MAX_RECORDS = 200;

const EMPTY: ClimbRecord[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: ClimbRecord[] = EMPTY;
let cachedNameRaw: string | null = null;
let cachedName: string = DEFAULT_NAME;

function readStorage(): ClimbRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as ClimbRecord[]) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function readLastName(): string {
  const raw = localStorage.getItem(LAST_NAME_KEY);
  if (raw === cachedNameRaw) return cachedName;
  cachedNameRaw = raw;
  cachedName = raw && raw.trim() ? raw : DEFAULT_NAME;
  return cachedName;
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

export function useClimbRecords(): ClimbRecord[] {
  return useSyncExternalStore(subscribe, readStorage, () => EMPTY);
}

export function useLastPlayerName(): string {
  return useSyncExternalStore(subscribe, readLastName, () => DEFAULT_NAME);
}

// Leaderboard order: most words spelled first (that's the point of the
// game), tie-broken by depth reached, then by most recent.
export function useClimbLeaderboard(): ClimbRecord[] {
  const records = useClimbRecords();
  return [...records].sort(
    (a, b) => b.wordsCompleted - a.wordsCompleted || b.floor - a.floor || b.timestamp - a.timestamp,
  );
}

export function useBestClimbFloor(): number {
  const records = useClimbRecords();
  return records.reduce((max, r) => Math.max(max, r.floor), 0);
}

export function recordClimbRun(name: string, floor: number, wordsCompleted: number, timestamp: number): string {
  if (typeof window === 'undefined') return '';
  const fresh = readStorage();
  const trimmedName = name.trim() || DEFAULT_NAME;
  const id = `${timestamp}-${Math.round(floor * 1000)}-${wordsCompleted}`;
  const entry: ClimbRecord = { id, name: trimmedName, floor, wordsCompleted, timestamp };
  let updated = [...fresh, entry];
  if (updated.length > MAX_RECORDS) {
    updated = updated.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmedName);
  notify();
  return id;
}

// Lets a child correct the name on a record they just set right after the
// fact, without creating a duplicate entry.
export function renameClimbRecord(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  const trimmedName = name.trim() || DEFAULT_NAME;
  const updated = fresh.map((r) => (r.id === id ? { ...r, name: trimmedName } : r));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmedName);
  notify();
}

export function clearClimbRecords(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}
