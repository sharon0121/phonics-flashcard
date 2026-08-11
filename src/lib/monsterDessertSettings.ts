import { useSyncExternalStore } from 'react';

const MAX_FACTOR_TIERS_KEY = 'monster_dessert_max_factor_tiers';
const DIFFICULTY_STAGE_KEY = 'monster_dessert_difficulty_stage';
const MONSTER_VARIETY_KEY = 'monster_dessert_monster_variety';

// "Max factor" tiers the parent can pick from — each selected tier caps how
// big X and Y can get. Sorted ascending and stepped via ladderTierValue as
// the child's streak grows, same convention as every other math game here.
export const ALL_MAX_FACTOR_TIERS: number[] = [3, 4, 5, 6, 7, 8, 9];
const DEFAULT_MAX_FACTOR_TIERS: number[] = [...ALL_MAX_FACTOR_TIERS];

// Each stage asks the "normal" monster's question a fixed, consistent way —
// no random mixing — so a first-time learner isn't juggling formats.
// Stage 1: told plates + per-plate → build → count the total.
// Stage 2: told plates + per-plate → build → answer the ×-equation directly.
// Stage 3: told only the total + plate count → build each plate independently
//          to work out the missing per-plate amount, then Ready checks the sum.
export type DifficultyStage = 1 | 2 | 3;
export const ALL_DIFFICULTY_STAGES: DifficultyStage[] = [1, 2, 3];
export const DIFFICULTY_STAGE_LABELS: Record<DifficultyStage, { title: string; description: string }> = {
  1: { title: '🔢 第一階段：數數學乘法', description: '告知盤數和每盤數量，蓋好、複製之後，數一數總共有幾個。' },
  2: { title: '✖️ 第二階段：認識乘法算式', description: '一樣先蓋好、複製盤子，最後改成選出正確的乘法算式答案。' },
  3: { title: '🧩 第三階段：找出缺少的數字', description: '只告知總數和盤數，小朋友要自己想每盤該放幾個才對。' },
};

export type MonsterVarietyKey = 'impatient' | 'picky' | 'boss';
export const ALL_MONSTER_VARIETIES: MonsterVarietyKey[] = ['impatient', 'picky', 'boss'];
export const MONSTER_VARIETY_LABELS: Record<MonsterVarietyKey, string> = {
  impatient: '🐇 急躁小怪（超快、超簡單）',
  picky: '🐽 挑食怪獸（要先擦乾淨盤子）',
  boss: '👹 大胃王 BOSS（連續 3 關挑戰）',
};

interface MonsterDessertSettingsSnapshot {
  maxFactorTiers: number[];
  difficultyStage: DifficultyStage;
  monsterVariety: Record<MonsterVarietyKey, boolean>;
}

const DEFAULT_SNAPSHOT: MonsterDessertSettingsSnapshot = {
  maxFactorTiers: DEFAULT_MAX_FACTOR_TIERS,
  difficultyStage: 1,
  monsterVariety: { impatient: true, picky: true, boss: true },
};

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: MonsterDessertSettingsSnapshot = DEFAULT_SNAPSHOT;

function readSnapshot(): MonsterDessertSettingsSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SNAPSHOT;
  const rawTiers = localStorage.getItem(MAX_FACTOR_TIERS_KEY);
  const rawStage = localStorage.getItem(DIFFICULTY_STAGE_KEY);
  const rawVariety = localStorage.getItem(MONSTER_VARIETY_KEY);
  const combinedRaw = `${rawTiers}|${rawStage}|${rawVariety}`;
  if (combinedRaw === cachedRaw) return cached;
  cachedRaw = combinedRaw;

  let maxFactorTiers = DEFAULT_MAX_FACTOR_TIERS;
  try {
    const parsed = rawTiers ? (JSON.parse(rawTiers) as unknown) : null;
    const valid = Array.isArray(parsed)
      ? parsed.filter((v): v is number => ALL_MAX_FACTOR_TIERS.includes(v as number))
      : [];
    if (valid.length > 0) maxFactorTiers = valid;
  } catch {
    // fall back to default
  }

  const parsedStage = rawStage ? Number(rawStage) : 1;
  const difficultyStage: DifficultyStage = ALL_DIFFICULTY_STAGES.includes(parsedStage as DifficultyStage)
    ? (parsedStage as DifficultyStage)
    : 1;

  let monsterVariety = DEFAULT_SNAPSHOT.monsterVariety;
  try {
    const parsed = rawVariety ? (JSON.parse(rawVariety) as Partial<Record<MonsterVarietyKey, boolean>>) : null;
    if (parsed && typeof parsed === 'object') {
      monsterVariety = {
        impatient: parsed.impatient ?? true,
        picky: parsed.picky ?? true,
        boss: parsed.boss ?? true,
      };
    }
  } catch {
    // fall back to default
  }

  cached = { maxFactorTiers, difficultyStage, monsterVariety };
  return cached;
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

export function useMonsterDessertSettings(): MonsterDessertSettingsSnapshot {
  return useSyncExternalStore(subscribe, readSnapshot, () => DEFAULT_SNAPSHOT);
}

export function setMaxFactorTiers(tiers: number[]): void {
  if (typeof window === 'undefined') return;
  const safe = tiers.length > 0 ? tiers : DEFAULT_MAX_FACTOR_TIERS;
  localStorage.setItem(MAX_FACTOR_TIERS_KEY, JSON.stringify(safe));
  notify();
}

export function setDifficultyStage(stage: DifficultyStage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DIFFICULTY_STAGE_KEY, String(stage));
  notify();
}

export function setMonsterVariety(variety: Record<MonsterVarietyKey, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MONSTER_VARIETY_KEY, JSON.stringify(variety));
  notify();
}
