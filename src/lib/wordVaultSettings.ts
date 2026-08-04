import { useSyncExternalStore } from 'react';
import type { MazeWord } from '@/data/wordMazeWords';
import { words as PHONICS_WORDS } from '@/data/words';
import { sightWords as SIGHT_WORDS } from '@/data/sightWords';
import { useCurriculum, getCurrentWeekKey, getActiveWordIds } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';
import { useCustomWords } from '@/lib/customWords';
import {
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type WordSourceKey,
} from '@/lib/heroClimbSettings';

export { WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey };

const GHOST_COUNT_KEY = 'maze_ghost_count';
const GHOST_SPEED_KEY = 'maze_ghost_speed';
const WORD_SOURCES_KEY = 'maze_word_sources';
const TUNNEL_KEY = 'maze_tunnel_mode';

export type GhostSpeed = 'slow' | 'normal' | 'fast';

const GHOST_SPEED_MS: Record<GhostSpeed, number> = { slow: 700, normal: 500, fast: 350 };

const EMPTY_WORDS: MazeWord[] = [];
export const DEFAULT_GHOST_COUNT = 2;
export const MIN_GHOST_COUNT = 2;
export const MAX_GHOST_COUNT = 10;
const DEFAULT_GHOST_SPEED: GhostSpeed = 'normal';
const DEFAULT_WORD_SOURCES: WordSourceKey[] = [...ALL_WORD_SOURCES];

const listeners = new Set<() => void>();
let cachedGhostRaw: string | null = null;
let cachedGhostCount = DEFAULT_GHOST_COUNT;
let cachedSpeedRaw: string | null = null;
let cachedGhostSpeed: GhostSpeed = DEFAULT_GHOST_SPEED;
let cachedSourcesRaw: string | null = null;
let cachedSources: WordSourceKey[] = DEFAULT_WORD_SOURCES;
let cachedTunnelRaw: string | null = null;
let cachedTunnelMode = false;

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

function readWordSources(): WordSourceKey[] {
  const raw = localStorage.getItem(WORD_SOURCES_KEY);
  if (raw === cachedSourcesRaw) return cachedSources;
  cachedSourcesRaw = raw;
  if (raw == null) { cachedSources = DEFAULT_WORD_SOURCES; return cachedSources; }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const valid = Array.isArray(parsed) ? parsed.filter((k): k is WordSourceKey => ALL_WORD_SOURCES.includes(k as WordSourceKey)) : [];
    cachedSources = valid.length > 0 ? valid : DEFAULT_WORD_SOURCES;
  } catch { cachedSources = DEFAULT_WORD_SOURCES; }
  return cachedSources;
}

function readTunnelMode(): boolean {
  const raw = localStorage.getItem(TUNNEL_KEY);
  if (raw === cachedTunnelRaw) return cachedTunnelMode;
  cachedTunnelRaw = raw;
  cachedTunnelMode = raw === 'true';
  return cachedTunnelMode;
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

export function useGhostCount(): number {
  return useSyncExternalStore(subscribe, readGhostCount, () => DEFAULT_GHOST_COUNT);
}

export function useGhostSpeed(): GhostSpeed {
  return useSyncExternalStore(subscribe, readGhostSpeed, () => DEFAULT_GHOST_SPEED);
}

export function useGhostTickMs(): number {
  return GHOST_SPEED_MS[useGhostSpeed()];
}

export function useMazeWordSources(): WordSourceKey[] {
  return useSyncExternalStore(subscribe, readWordSources, () => DEFAULT_WORD_SOURCES);
}

export function useTunnelMode(): boolean {
  return useSyncExternalStore(subscribe, readTunnelMode, () => false);
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

export function setMazeWordSources(sources: WordSourceKey[]): void {
  if (typeof window === 'undefined') return;
  const safe = sources.length > 0 ? sources : DEFAULT_WORD_SOURCES;
  localStorage.setItem(WORD_SOURCES_KEY, JSON.stringify(safe));
  notify();
}

export function setTunnelMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TUNNEL_KEY, String(on));
  notify();
}

function toMazeWords(words: { word: string; zh: string; emoji: string }[]): MazeWord[] {
  return words
    .filter((w) => w.word.length >= 3 && w.word.length <= 8)
    .map((w) => ({ word: w.word.toUpperCase(), zh: w.zh, emoji: w.emoji }));
}

// Word pools grouped by source, narrowest scope first — same priority
// convention as angry-cow/hero-climb's word sources, so picking logic can
// draw from the first non-empty tier before falling back to the big banks.
export function useMazeWordTiers(): MazeWord[][] {
  const curriculum = useCurriculum();
  const progress = useProgress();
  const customWords = useCustomWords();
  const sources = useMazeWordSources();

  const weekKey = getCurrentWeekKey();
  const weekIds = new Set(getActiveWordIds(curriculum, progress, weekKey));
  const weekWords = weekIds.size > 0 ? PHONICS_WORDS.filter((w) => weekIds.has(w.id)) : [];
  const reinforcementWords = [...PHONICS_WORDS, ...SIGHT_WORDS].filter((w) => progress[w.id]?.needsReinforcement === true);

  const tiers: Array<{ key: WordSourceKey; words: MazeWord[] }> = [
    { key: 'thisWeek', words: toMazeWords(weekWords) },
    { key: 'reinforcement', words: toMazeWords(reinforcementWords) },
    { key: 'custom', words: toMazeWords(customWords) },
    { key: 'phonics', words: toMazeWords(PHONICS_WORDS) },
    { key: 'sightWords', words: toMazeWords(SIGHT_WORDS) },
  ];
  const active = tiers.filter((t) => sources.includes(t.key) && t.words.length > 0).map((t) => t.words);
  return active.length > 0 ? active : [toMazeWords(PHONICS_WORDS)];
}

// Flattened view for callers that just need "all currently eligible words"
// without caring about source priority (e.g. settings page word counts).
export function useAllMazeWords(): MazeWord[] {
  return useMazeWordTiers().flat();
}
