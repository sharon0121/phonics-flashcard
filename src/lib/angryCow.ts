import type { Word } from '@/lib/types';

export type AngryCowMode = 'english' | 'math' | 'mixed';

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
  nums: number[];           // all operands in order
  ops: Array<'+' | '-'>;   // operators between operands (length = nums.length - 1)
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
    if (!used.has(candidate)) { used.add(candidate); result.push(candidate); }
  }
  return [result[0], result[1]];
}

// terms=2: addition or subtraction (classic 2-operand).
// terms>=3: all-addition chain (simpler for young children).
export function makeMathRound(maxValue: number, terms: number = 2): MathRound {
  let nums: number[];
  let ops: Array<'+' | '-'>;

  if (terms <= 2) {
    const subProb = 0.2 + Math.random() * 0.25;
    if (Math.random() < subProb) {
      const a = 1 + Math.floor(Math.random() * maxValue);
      const b = Math.floor(Math.random() * (a + 1));
      nums = [a, b]; ops = ['-'];
    } else {
      nums = [1 + Math.floor(Math.random() * maxValue), 1 + Math.floor(Math.random() * maxValue)];
      ops = ['+'];
    }
  } else {
    nums = Array.from({ length: terms }, () => 1 + Math.floor(Math.random() * maxValue));
    ops = Array<'+' | '-'>(terms - 1).fill('+');
  }

  const answer = ops.reduce<number>((acc, op, i) => (op === '+' ? acc + nums[i + 1] : acc - nums[i + 1]), nums[0]);
  const [d1, d2] = makeMathDistractors(answer);
  const targets = shuffled(
    [answer, d1, d2].map((v, i) => ({ id: `t${i}-${v}-${Math.random()}`, isCorrect: v === answer, value: v })),
  );
  return { problem: { nums, ops, answer }, targets };
}
