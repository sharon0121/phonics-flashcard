import type { Word } from '@/lib/types';

export type AngryCowMode = 'english' | 'math';

export interface EnglishTarget {
  id: string;
  isCorrect: boolean;
  word: Word;
}

export interface EnglishRound {
  word: Word;
  targets: EnglishTarget[]; // 3, shuffled
}

export interface MathProblem {
  a: number;
  b: number;
  op: '+' | '-';
  answer: number;
}

export interface MathTarget {
  id: string;
  isCorrect: boolean;
  value: number;
}

export interface MathRound {
  problem: MathProblem;
  targets: MathTarget[]; // 3, shuffled
}

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickDistinct(pool: Word[], avoidIds: Set<string>): Word | null {
  const candidates = pool.filter((w) => !avoidIds.has(w.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Builds one English round: a correct word drawn from the first non-empty
// pool (priority order set by the caller), plus 2 distractors drawn from the
// full combined pool set, distinct from the answer and from each other.
// Returns null if the combined pools don't have at least 3 distinct words —
// the caller should retry with a broader pool (e.g. the full phonics bank)
// rather than render a broken round.
export function makeEnglishRound(pools: Word[][]): EnglishRound | null {
  const combined = pools.flat();
  const nonEmpty = pools.find((p) => p.length > 0);
  if (!nonEmpty) return null;
  const word = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];

  const avoid = new Set([word.id]);
  const distractor1 = pickDistinct(combined, avoid);
  if (!distractor1) return null;
  avoid.add(distractor1.id);
  const distractor2 = pickDistinct(combined, avoid);
  if (!distractor2) return null;

  const targets = shuffled(
    [word, distractor1, distractor2].map((w, i) => ({ id: `t${i}-${w.id}`, isCorrect: w.id === word.id, word: w })),
  );
  return { word, targets };
}

// Same 20%-45% per-problem subtraction probability convention used by
// abacus.ts, kept independent here since this game wants simple single-
// operation "a op b = ?" problems rather than abacus's multi-term columns.
const SUB_PROB_MIN = 0.2;
const SUB_PROB_MAX = 0.45;

export function makeMathProblem(maxValue: number): MathProblem {
  const subProb = SUB_PROB_MIN + Math.random() * (SUB_PROB_MAX - SUB_PROB_MIN);
  if (Math.random() < subProb) {
    const a = 1 + Math.floor(Math.random() * maxValue);
    const b = Math.floor(Math.random() * (a + 1)); // 0..a, so a - b never goes negative
    return { a, b, op: '-', answer: a - b };
  }
  const a = 1 + Math.floor(Math.random() * maxValue);
  const b = 1 + Math.floor(Math.random() * maxValue);
  return { a, b, op: '+', answer: a + b };
}

// Two wrong numbers near the correct answer, expanding outward one step at a
// time so they stay plausible rather than wildly off — mirrors the "expand
// outward from the true answer, skip duplicates" approach coordinate-hunt
// uses for its math grid.
function makeMathDistractors(answer: number): [number, number] {
  const used = new Set([answer]);
  const result: number[] = [];
  let offset = 1;
  while (result.length < 2 && offset < 50) {
    for (const candidate of [answer - offset, answer + offset]) {
      if (result.length >= 2) break;
      if (candidate >= 0 && !used.has(candidate)) {
        used.add(candidate);
        result.push(candidate);
      }
    }
    offset++;
  }
  while (result.length < 2) {
    const candidate = Math.floor(Math.random() * 1000);
    if (!used.has(candidate)) {
      used.add(candidate);
      result.push(candidate);
    }
  }
  return [result[0], result[1]];
}

export function makeMathRound(maxValue: number): MathRound {
  const problem = makeMathProblem(maxValue);
  const [d1, d2] = makeMathDistractors(problem.answer);
  const targets = shuffled(
    [problem.answer, d1, d2].map((v, i) => ({ id: `t${i}-${v}-${Math.random()}`, isCorrect: v === problem.answer, value: v })),
  );
  return { problem, targets };
}
