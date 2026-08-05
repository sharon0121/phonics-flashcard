import { useSyncExternalStore } from 'react';
import type { AnimalType } from '@/app/games/angry-cow/SlingshotGame';

const TOTAL_CORRECT_KEY = 'angry_cow_total_correct';
const ANIMAL_TYPE_KEY   = 'angry_cow_animal_type';

export interface UnlockMilestone {
  threshold: number;
  animal: AnimalType;
  label: string;
  emoji: string;
}

// Every 5 correct answers unlocks the next animal in sequence.
export const UNLOCK_MILESTONES: UnlockMilestone[] = [
  { threshold: 5,  animal: 'pig',      label: '豬豬', emoji: '🐷' },
  { threshold: 10, animal: 'sheep',    label: '小羊', emoji: '🐑' },
  { threshold: 15, animal: 'horse',    label: '駿馬', emoji: '🐴' },
  { threshold: 20, animal: 'elephant', label: '大象', emoji: '🐘' },
  { threshold: 25, animal: 'bear',     label: '熊熊', emoji: '🐻' },
];

export const ALL_ANIMAL_DEFS: Array<{ type: AnimalType; label: string; emoji: string }> = [
  { type: 'cow',      label: '乳牛', emoji: '🐮' },
  { type: 'pig',      label: '豬豬', emoji: '🐷' },
  { type: 'sheep',    label: '小羊', emoji: '🐑' },
  { type: 'horse',    label: '駿馬', emoji: '🐴' },
  { type: 'elephant', label: '大象', emoji: '🐘' },
  { type: 'bear',     label: '熊熊', emoji: '🐻' },
];

const DEFAULT_ANIMAL: AnimalType = 'cow';
const VALID_ANIMALS: AnimalType[] = ['cow', 'pig', 'sheep', 'horse', 'elephant', 'bear'];

const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
}

// ── Total correct ─────────────────────────────────────────────────────────────
export function getAngryCowTotalCorrect(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(TOTAL_CORRECT_KEY) ?? '0', 10) || 0;
}

/** Increments the cumulative correct counter. Returns the milestone if this answer crossed one. */
export function addAngryCowCorrect(): UnlockMilestone | null {
  if (typeof window === 'undefined') return null;
  const prev = getAngryCowTotalCorrect();
  const next = prev + 1;
  localStorage.setItem(TOTAL_CORRECT_KEY, String(next));
  notify();
  return UNLOCK_MILESTONES.find((m) => m.threshold === next) ?? null;
}

// ── Unlocked animals ──────────────────────────────────────────────────────────
let cachedUnlockedKey = '';
let cachedUnlocked: AnimalType[] = ['cow'];

function readUnlockedAnimals(): AnimalType[] {
  const key = localStorage.getItem(TOTAL_CORRECT_KEY) ?? '0';
  if (key === cachedUnlockedKey) return cachedUnlocked;
  cachedUnlockedKey = key;
  const total = parseInt(key, 10) || 0;
  const unlocked: AnimalType[] = ['cow'];
  for (const m of UNLOCK_MILESTONES) {
    if (total >= m.threshold) unlocked.push(m.animal);
  }
  cachedUnlocked = unlocked;
  return cachedUnlocked;
}

export function useAngryCowUnlockedAnimals(): AnimalType[] {
  return useSyncExternalStore(subscribe, readUnlockedAnimals, () => ['cow'] as AnimalType[]);
}

// ── Selected animal ───────────────────────────────────────────────────────────
let cachedAnimalRaw: string | null = null;
let cachedAnimal: AnimalType = DEFAULT_ANIMAL;

function readAnimalType(): AnimalType {
  const raw = localStorage.getItem(ANIMAL_TYPE_KEY);
  if (raw === cachedAnimalRaw) return cachedAnimal;
  cachedAnimalRaw = raw;
  cachedAnimal = VALID_ANIMALS.includes(raw as AnimalType) ? (raw as AnimalType) : DEFAULT_ANIMAL;
  return cachedAnimal;
}

export function useAngryCowAnimalType(): AnimalType {
  return useSyncExternalStore(subscribe, readAnimalType, () => DEFAULT_ANIMAL);
}

export function setAngryCowAnimalType(type: AnimalType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ANIMAL_TYPE_KEY, type);
  notify();
}
