import { useSyncExternalStore } from 'react';

export interface PixelInvadersRecord {
  id: string;
  name: string;
  score: number;
  correct: number;
  wrong: number;
  kills: number;
  maxCombo: number;
  timestamp: number;
}

const STORAGE_KEY = 'pixelInvaders_records';
const LAST_NAME_KEY = 'pixelInvaders_lastPlayerName';
export const DEFAULT_NAME = '小英雄';
const MAX_RECORDS = 100;

const EMPTY: PixelInvadersRecord[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: PixelInvadersRecord[] = EMPTY;
let cachedNameRaw: string | null = null;
let cachedName: string = DEFAULT_NAME;

function readStorage(): PixelInvadersRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try { cached = raw ? (JSON.parse(raw) as PixelInvadersRecord[]) : EMPTY; }
  catch { cached = EMPTY; }
  return cached;
}

function readLastName(): string {
  const raw = localStorage.getItem(LAST_NAME_KEY);
  if (raw === cachedNameRaw) return cachedName;
  cachedNameRaw = raw;
  cachedName = raw && raw.trim() ? raw : DEFAULT_NAME;
  return cachedName;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

function notify() { listeners.forEach(l => l()); }

export function usePixelInvadersRecords(): PixelInvadersRecord[] {
  return useSyncExternalStore(subscribe, readStorage, () => EMPTY);
}

export function useLastPixelInvadersName(): string {
  return useSyncExternalStore(subscribe, readLastName, () => DEFAULT_NAME);
}

export function usePixelInvadersLeaderboard(): PixelInvadersRecord[] {
  const records = usePixelInvadersRecords();
  return [...records].sort((a, b) => b.score - a.score || b.timestamp - a.timestamp).slice(0, 30);
}

export function savePixelInvadersRecord(
  name: string,
  score: number,
  correct: number,
  wrong: number,
  kills: number,
  maxCombo: number,
): string {
  if (typeof window === 'undefined') return '';
  const trimmed = name.trim() || DEFAULT_NAME;
  const ts = Date.now();
  const id = `${ts}-${score}`;
  const entry: PixelInvadersRecord = { id, name: trimmed, score, correct, wrong, kills, maxCombo, timestamp: ts };
  const fresh = readStorage();
  let updated = [...fresh, entry];
  if (updated.length > MAX_RECORDS) {
    updated = updated.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECORDS);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmed);
  notify();
  return id;
}

export function updatePixelInvadersName(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = name.trim() || DEFAULT_NAME;
  const updated = readStorage().map(r => r.id === id ? { ...r, name: trimmed } : r);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_NAME_KEY, trimmed);
  notify();
}
