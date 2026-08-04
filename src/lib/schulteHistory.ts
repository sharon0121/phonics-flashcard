import { useSyncExternalStore } from 'react';
import type { SchulteCategory } from '@/data/schulteContent';

const MAX_ENTRIES = 10;
const NAME_KEY = 'schulte_last_player_name';
export const DEFAULT_NAME = '小英雄';

export interface SchulteRecord {
  id: string;
  name: string;
  timeMs: number; // lower is better
  date: string;
}

function boardKey(category: SchulteCategory, gridDim: number): string {
  return `schulte_board_${category}_${gridDim}x${gridDim}`;
}

const listeners = new Set<() => void>();
const cachedRaw = new Map<string, string | null>();
const cachedBoard = new Map<string, SchulteRecord[]>();

function readBoard(key: string): SchulteRecord[] {
  const raw = localStorage.getItem(key);
  if (raw === (cachedRaw.get(key) ?? null) && cachedBoard.has(key)) return cachedBoard.get(key)!;
  cachedRaw.set(key, raw);
  let board: SchulteRecord[] = [];
  try {
    board = raw ? (JSON.parse(raw) as SchulteRecord[]) : [];
  } catch {
    board = [];
  }
  cachedBoard.set(key, board);
  return board;
}

function writeBoard(key: string, board: SchulteRecord[]): void {
  localStorage.setItem(key, JSON.stringify(board));
  cachedRaw.set(key, JSON.stringify(board));
  cachedBoard.set(key, board);
  notify();
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

const EMPTY: SchulteRecord[] = [];

export function useSchulteLeaderboard(category: SchulteCategory, gridDim: number): SchulteRecord[] {
  const key = boardKey(category, gridDim);
  return useSyncExternalStore(subscribe, () => readBoard(key), () => EMPTY);
}

export function getSchulteLeaderboard(category: SchulteCategory, gridDim: number): SchulteRecord[] {
  if (typeof window === 'undefined') return EMPTY;
  return readBoard(boardKey(category, gridDim));
}

// Lower time is better — a run qualifies if the board has room, or beats
// the current slowest entry on it.
export function qualifiesForSchulteLeaderboard(timeMs: number, category: SchulteCategory, gridDim: number): boolean {
  const board = getSchulteLeaderboard(category, gridDim);
  if (board.length < MAX_ENTRIES) return true;
  return timeMs < board[board.length - 1].timeMs;
}

export function addToSchulteLeaderboard(
  name: string,
  timeMs: number,
  category: SchulteCategory,
  gridDim: number,
  now: number,
): SchulteRecord[] {
  const key = boardKey(category, gridDim);
  const board = readBoard(key);
  const entry: SchulteRecord = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || DEFAULT_NAME,
    timeMs,
    date: new Date(now).toLocaleDateString('zh-TW'),
  };
  const updated = [...board, entry].sort((a, b) => a.timeMs - b.timeMs).slice(0, MAX_ENTRIES);
  writeBoard(key, updated);
  return updated;
}

function readName(): string {
  if (typeof window === 'undefined') return DEFAULT_NAME;
  return localStorage.getItem(NAME_KEY) || DEFAULT_NAME;
}

export function useLastSchultePlayerName(): string {
  return useSyncExternalStore(subscribe, readName, () => DEFAULT_NAME);
}

export function setLastSchultePlayerName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NAME_KEY, name.trim() || DEFAULT_NAME);
  notify();
}
