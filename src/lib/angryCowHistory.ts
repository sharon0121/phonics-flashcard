import { useSyncExternalStore } from 'react';
import type { AngryCowMode } from '@/lib/angryCow';

export interface AngryCowRecord {
  id: string;
  mode: AngryCowMode;
  name: string;
  score: number;
  timestamp: number;
}

const STORAGE_KEY = 'angry_cow_records';
const LAST_NAME_KEY = 'angry_cow_last_name';
const DEFAULT_NAME = '小獵人';
const MAX_RECORDS = 200;

const EMPTY: AngryCowRecord[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: AngryCowRecord[] = EMPTY;
let cachedNameRaw: string | null = null;
let cachedName: string = DEFAULT_NAME;

function readStorage(): AngryCowRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as AngryCowRecord[]) : EMPTY;
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

export function useAngryCowRecords(): AngryCowRecord[] {
  return useSyncExternalStore(subscribe, readStorage, () => EMPTY);
}

export function useLastAngryCowPlayerName(): string {
  return useSyncExternalStore(subscribe, readLastName, () => DEFAULT_NAME);
}

// English and math scores aren't comparable, so the leaderboard is always
// scoped to one mode at a time.
export function useAngryCowLeaderboard(mode: AngryCowMode): AngryCowRecord[] {
  const records = useAngryCowRecords();
  return records
    .filter((r) => r.mode === mode)
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
}

export function recordAngryCowRun(mode: AngryCowMode, name: string, score: number, timestamp: number): string {
  if (typeof window === 'undefined') return '';
  const fresh = readStorage();
  const trimmedName = name.trim() || DEFAULT_NAME;
  const id = `${timestamp}-${mode}-${score}`;
  const entry: AngryCowRecord = { id, mode, name: trimmedName, score, timestamp };
  let updated = [...fresh, entry];
  if (updated.length > MAX_RECORDS) {
    updated = updated.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmedName);
  notify();
  return id;
}

export function renameAngryCowRecord(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  const fresh = readStorage();
  const trimmedName = name.trim() || DEFAULT_NAME;
  const updated = fresh.map((r) => (r.id === id ? { ...r, name: trimmedName } : r));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmedName);
  notify();
}

export function clearAngryCowRecords(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  notify();
}
