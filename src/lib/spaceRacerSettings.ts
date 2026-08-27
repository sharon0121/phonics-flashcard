import { useSyncExternalStore } from 'react';
import { ladderTierValue } from './heroClimbSettings';
import { STEP_TIER_OPTIONS, type StepTier } from './spaceRacer';

export { ladderTierValue, STEP_TIER_OPTIONS };
export type { StepTier };

const STEP_TIERS_KEY = 'space_racer_step_tiers';
const BEST_SCORE_KEY = 'space_racer_best_score';
const DEFAULT_STEP_TIERS: StepTier[] = [1, 2];

const listeners = new Set<() => void>();
let cachedTiersRaw: string | null = null;
let cachedTiers: StepTier[] = DEFAULT_STEP_TIERS;
let cachedBestRaw: string | null = null;
let cachedBest = 0;

function readStepTiers(): StepTier[] {
  const raw = localStorage.getItem(STEP_TIERS_KEY);
  if (raw === cachedTiersRaw) return cachedTiers;
  cachedTiersRaw = raw;
  if (raw == null) {
    cachedTiers = DEFAULT_STEP_TIERS;
    return cachedTiers;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const validValues = STEP_TIER_OPTIONS.map((o) => o.value);
    const valid = Array.isArray(parsed)
      ? parsed.filter((v): v is StepTier => validValues.includes(v as StepTier))
      : [];
    cachedTiers = valid.length > 0 ? valid : DEFAULT_STEP_TIERS;
  } catch {
    cachedTiers = DEFAULT_STEP_TIERS;
  }
  return cachedTiers;
}

function readBestScore(): number {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  if (raw === cachedBestRaw) return cachedBest;
  cachedBestRaw = raw;
  const parsed = raw == null ? 0 : Number(raw);
  cachedBest = Number.isFinite(parsed) ? parsed : 0;
  return cachedBest;
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

export function useSpaceRacerStepTiers(): StepTier[] {
  return useSyncExternalStore(subscribe, readStepTiers, () => DEFAULT_STEP_TIERS);
}

export function setSpaceRacerStepTiers(tiers: StepTier[]): void {
  if (typeof window === 'undefined') return;
  const safe = tiers.length > 0 ? tiers : DEFAULT_STEP_TIERS;
  localStorage.setItem(STEP_TIERS_KEY, JSON.stringify(safe));
  notify();
}

export function useSpaceRacerBestScore(): number {
  return useSyncExternalStore(subscribe, readBestScore, () => 0);
}

export function reportSpaceRacerScore(score: number): void {
  if (typeof window === 'undefined') return;
  if (score > readBestScore()) {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
    notify();
  }
}
