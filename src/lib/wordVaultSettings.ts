import { useSyncExternalStore } from 'react';
import { MAZE_WORDS, type MazeWord } from '@/data/wordMazeWords';
import { words as PHONICS_WORDS } from '@/data/words';
import { useCurriculum, getCurrentWeekKey } from '@/lib/curriculum';

const CUSTOM_KEY = 'custom_maze_words';
const DISABLED_KEY = 'disabled_maze_word_ids';
const GHOST_COUNT_KEY = 'maze_ghost_count';
const GHOST_SPEED_KEY = 'maze_ghost_speed';
const WORD_SOURCE_KEY = 'maze_word_source';
const TUNNEL_KEY = 'maze_tunnel_mode';

export type GhostSpeed = 'slow' | 'normal' | 'fast';
export type WordSource = 'builtin' | 'week' | 'learned';

const GHOST_SPEED_MS: Record<GhostSpeed, number> = { slow: 700, normal: 500, fast: 350 };

const EMPTY_WORDS: MazeWord[] = [];
const EMPTY_IDS: string[] = [];
export const DEFAULT_GHOST_COUNT = 2;
export const MIN_GHOST_COUNT = 2;
export const MAX_GHOST_COUNT = 10;
const DEFAULT_GHOST_SPEED: GhostSpeed = 'normal';
const DEFAULT_WORD_SOURCE: WordSource = 'week';

const listeners = new Set<() => void>();
let cachedCustomRaw: string | null = null;
let cachedCustom: MazeWord[] = EMPTY_WORDS;
let cachedDisabledRaw: string | null = null;
let cachedDisabled: string[] = EMPTY_IDS;
let cachedGhostRaw: string | null = null;
let cachedGhostCount = DEFAULT_GHOST_COUNT;
let cachedSpeedRaw: string | null = null;
let cachedGhostSpeed: GhostSpeed = DEFAULT_GHOST_SPEED;
let cachedSourceRaw: string | null = null;
let cachedWordSource: WordSource = DEFAULT_WORD_SOURCE;
let cachedTunnelRaw: string | null = null;
let cachedTunnelMode = false;

function readCustom(): MazeWord[] {
  const raw = localStorage.getItem(CUSTOM_KEY);
  if (raw === cachedCustomRaw) return cachedCustom;
  cachedCustomRaw = raw;
  try {
    cachedCustom = raw ? (JSON.parse(raw) as MazeWord[]) : EMPTY_WORDS;
  } catch {
    cachedCustom = EMPTY_WORDS;
  }
  return cachedCustom;
}

function readDisabled(): string[] {
  const raw = localStorage.getItem(DISABLED_KEY);
  if (raw === cachedDisabledRaw) return cachedDisabled;
  cachedDisabledRaw = raw;
  try {
    cachedDisabled = raw ? (JSON.parse(raw) as string[]) : EMPTY_IDS;
  } catch {
    cachedDisabled = EMPTY_IDS;
  }
  return cachedDisabled;
}

function readGhostCount(): number {
  const raw = localStorage.getItem(GHOST_COUNT_KEY);
  if (raw === cachedGhostRaw) return cachedGhostCount;
  cachedGhostRaw = raw;
  const parsed = raw ? parseInt(raw, 10) : DEFAULT_GHOST_COUNT;
  cachedGhostCount =
    Number.isFinite(parsed) && parsed >= MIN_GHOST_COUNT && parsed <= MAX_GHOST_COUNT ? parsed : DEFAULT_GHOST_COUNT;
  return cachedGhostCount;
}

function readGhostSpeed(): GhostSpeed {
  const raw = localStorage.getItem(GHOST_SPEED_KEY);
  if (raw === cachedSpeedRaw) return cachedGhostSpeed;
  cachedSpeedRaw = raw;
  cachedGhostSpeed = raw === 'slow' || raw === 'normal' || raw === 'fast' ? raw : DEFAULT_GHOST_SPEED;
  return cachedGhostSpeed;
}

function readWordSource(): WordSource {
  const raw = localStorage.getItem(WORD_SOURCE_KEY);
  if (raw === cachedSourceRaw) return cachedWordSource;
  cachedSourceRaw = raw;
  cachedWordSource = raw === 'builtin' || raw === 'week' || raw === 'learned' ? raw : DEFAULT_WORD_SOURCE;
  return cachedWordSource;
}

function readTunnelMode(): boolean {
  const raw = localStorage.getItem(TUNNEL_KEY);
  if (raw === cachedTunnelRaw) return cachedTunnelMode;
  cachedTunnelRaw = raw;
  cachedTunnelMode = raw === 'true';
  return cachedTunnelMode;
}

function readLearnedMazeWords(): MazeWord[] {
  const raw = localStorage.getItem('phonics_progress');
  if (!raw) return EMPTY_WORDS;
  try {
    const progress = JSON.parse(raw) as Record<string, { canUnderstand?: boolean }>;
    const result = PHONICS_WORDS
      .filter((w) => w.word.length >= 3 && w.word.length <= 8 && progress[w.id]?.canUnderstand === true)
      .map((w) => ({ word: w.word.toUpperCase(), zh: w.zh, emoji: w.emoji }));
    return result.length > 0 ? result : EMPTY_WORDS;
  } catch {
    return EMPTY_WORDS;
  }
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

export function useCustomMazeWords(): MazeWord[] {
  return useSyncExternalStore(subscribe, readCustom, () => EMPTY_WORDS);
}

export function useDisabledMazeWordIds(): string[] {
  return useSyncExternalStore(subscribe, readDisabled, () => EMPTY_IDS);
}

export function useGhostCount(): number {
  return useSyncExternalStore(subscribe, readGhostCount, () => DEFAULT_GHOST_COUNT);
}

export function useGhostSpeed(): GhostSpeed {
  return useSyncExternalStore(subscribe, readGhostSpeed, () => DEFAULT_GHOST_SPEED);
}

export function useGhostTickMs(): number {
  return GHOST_SPEED_MS[useGhostSpeed()];
}

export function useWordSource(): WordSource {
  return useSyncExternalStore(subscribe, readWordSource, () => DEFAULT_WORD_SOURCE);
}

export function useTunnelMode(): boolean {
  return useSyncExternalStore(subscribe, readTunnelMode, () => false);
}

export function useLearnedMazeWords(): MazeWord[] {
  return useSyncExternalStore(subscribe, readLearnedMazeWords, () => EMPTY_WORDS);
}

// This week's curriculum words (from the phonics word bank), reshaped for
// the maze/puzzle UI — no length restriction, whatever's assigned this week.
export function useThisWeekMazeWords(): MazeWord[] {
  const curriculum = useCurriculum();
  const weekKey = getCurrentWeekKey();
  const ids = new Set(curriculum[weekKey] ?? []);
  if (ids.size === 0) return EMPTY_WORDS;
  return PHONICS_WORDS.filter((w) => ids.has(w.id)).map((w) => ({
    word: w.word.toUpperCase(),
    zh: w.zh,
    emoji: w.emoji,
  }));
}

function saveCustom(words: MazeWord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(words));
  notify();
}

function saveDisabled(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISABLED_KEY, JSON.stringify(ids));
  notify();
}

export function setGhostCount(count: number): void {
  if (typeof window === 'undefined') return;
  const clamped = Math.min(MAX_GHOST_COUNT, Math.max(MIN_GHOST_COUNT, count));
  localStorage.setItem(GHOST_COUNT_KEY, String(clamped));
  notify();
}

export function setGhostSpeed(speed: GhostSpeed): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GHOST_SPEED_KEY, speed);
  notify();
}

export function setWordSource(source: WordSource): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WORD_SOURCE_KEY, source);
  notify();
}

export function setTunnelMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TUNNEL_KEY, String(on));
  notify();
}

interface AddWordResult {
  ok: boolean;
  error?: string;
}

// Both maze phases (letter count, blank count) size themselves off the
// word's actual length, so any reasonable length works — just keep it sane
// for the UI.
export function addCustomMazeWord(word: string, zh: string, emoji: string): AddWordResult {
  const upper = word.trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(upper)) {
    return { ok: false, error: '單字必須是 3～8 個英文字母' };
  }
  const fresh = readCustom();
  if (fresh.some((w) => w.word === upper) || MAZE_WORDS.some((w) => w.word === upper)) {
    return { ok: false, error: '這個單字已經存在了' };
  }
  saveCustom([...fresh, { word: upper, zh: zh.trim(), emoji: emoji.trim() || '❓' }]);
  return { ok: true };
}

export function removeCustomMazeWord(word: string): void {
  const fresh = readCustom();
  saveCustom(fresh.filter((w) => w.word !== word));
}

export function toggleBuiltinMazeWord(word: string): void {
  const current = readDisabled();
  const next = current.includes(word) ? current.filter((w) => w !== word) : [...current, word];
  saveDisabled(next);
}

export function enableAllBuiltinMazeWords(): void {
  saveDisabled(EMPTY_IDS);
}

// All words available to the game. In "week" mode, uses this week's
// curriculum words (falling back to the standard pool if none are
// available yet); otherwise built-in words the parent hasn't turned off,
// plus anything added via settings. Never returns an empty pool.
export function useAllMazeWords(): MazeWord[] {
  const source = useWordSource();
  const custom = useCustomMazeWords();
  const disabled = useDisabledMazeWordIds();
  const weekWords = useThisWeekMazeWords();
  const learnedWords = useLearnedMazeWords();

  if (source === 'week' && weekWords.length > 0) return weekWords;
  if (source === 'learned' && learnedWords.length > 0) return learnedWords;

  const activeBuiltin =
    disabled.length === 0 ? MAZE_WORDS : MAZE_WORDS.filter((w) => !disabled.includes(w.word));
  const combined = [...activeBuiltin, ...custom];
  return combined.length > 0 ? combined : MAZE_WORDS;
}
