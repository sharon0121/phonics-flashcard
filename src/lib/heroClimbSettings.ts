import { useSyncExternalStore } from 'react';
import { words as PHONICS_WORDS } from '@/data/words';
import type { Word } from '@/lib/types';
import { useCurriculum, getCurrentWeekKey } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';

const MARQUEE_SPEED_KEY = 'hero_climb_marquee_speed';

export type MarqueeSpeed = 'slow' | 'normal' | 'fast';

// Seconds per item for the leaderboard marquee scroll.
export const MARQUEE_SECONDS_PER_ITEM: Record<MarqueeSpeed, number> = { slow: 3, normal: 1.8, fast: 1 };

const DEFAULT_MARQUEE_SPEED: MarqueeSpeed = 'normal';

const EMPTY_WORDS: Word[] = [];

const listeners = new Set<() => void>();
let cachedMarqueeRaw: string | null = null;
let cachedMarqueeSpeed: MarqueeSpeed = DEFAULT_MARQUEE_SPEED;

function readMarqueeSpeed(): MarqueeSpeed {
  const raw = localStorage.getItem(MARQUEE_SPEED_KEY);
  if (raw === cachedMarqueeRaw) return cachedMarqueeSpeed;
  cachedMarqueeRaw = raw;
  cachedMarqueeSpeed = raw === 'slow' || raw === 'normal' || raw === 'fast' ? raw : DEFAULT_MARQUEE_SPEED;
  return cachedMarqueeSpeed;
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

export function useMarqueeSpeed(): MarqueeSpeed {
  return useSyncExternalStore(subscribe, readMarqueeSpeed, () => DEFAULT_MARQUEE_SPEED);
}

export function setMarqueeSpeed(speed: MarqueeSpeed): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MARQUEE_SPEED_KEY, speed);
  notify();
}

// This week's curriculum words, in full Word form (need zhuyin for the
// ladder option cards, unlike the maze game's trimmed-down MazeWord).
export function useThisWeekClimbWords(): Word[] {
  const curriculum = useCurriculum();
  const weekKey = getCurrentWeekKey();
  const ids = new Set(curriculum[weekKey] ?? []);
  if (ids.size === 0) return EMPTY_WORDS;
  const result = PHONICS_WORDS.filter((w) => ids.has(w.id));
  return result.length > 0 ? result : EMPTY_WORDS;
}

// Words flagged "needs reinforcement" (🔥 加強) in the flashcard progress tracker.
export function useReinforcementClimbWords(): Word[] {
  const progress = useProgress();
  const result = PHONICS_WORDS.filter((w) => progress[w.id]?.needsReinforcement === true);
  return result.length > 0 ? result : EMPTY_WORDS;
}
