// Single-digit addition/subtraction "column" problems, matching the format
// used in physical 珠算 (abacus) certification practice sheets: the first
// term is unsigned, every later term is randomly + or -, and the running
// total is never allowed to go negative (a real abacus can't hold it).
export interface AbacusProblem {
  terms: number[];
  answer: number;
}

export const ROWS_OPTIONS = [7, 8, 10] as const;
export type AbacusRows = (typeof ROWS_OPTIONS)[number];

// "數字大小" difficulty: how large each individual term is allowed to be.
// 個位數 keeps the original single-digit (1-9) practice; the rest let terms
// climb into two digits for a harder column.
export const NUMBER_RANGE_OPTIONS = [
  { value: 9, label: '個位數' },
  { value: 20, label: '20 以內' },
  { value: 30, label: '30 以內' },
  { value: 40, label: '40 以內' },
] as const;
export type AbacusNumberRange = (typeof NUMBER_RANGE_OPTIONS)[number]['value'];

// A term value may repeat at most this many times within a single problem,
// so a column doesn't feel like the same number added/subtracted over and
// over, and it may never repeat back-to-back — flashing the same digit
// twice in a row (逐口閃示) makes it impossible to tell it actually changed.
const MAX_REPEATS_PER_VALUE = 2;

function withinCap(valueCounts: Map<number, number>, v: number): boolean {
  return (valueCounts.get(v) ?? 0) < MAX_REPEATS_PER_VALUE;
}

function candidates(valueCounts: Map<number, number>, maxValue: number, exclude?: number): number[] {
  const result: number[] = [];
  for (let v = 1; v <= maxValue; v++) {
    if (withinCap(valueCounts, v) && v !== exclude) result.push(v);
  }
  return result;
}

function pickFrom(pool: number[]): number {
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateProblem(rows: number, maxValue: number): AbacusProblem {
  const terms: number[] = [];
  let total = 0;
  const valueCounts = new Map<number, number>();
  let prevValue: number | undefined;

  function record(v: number) {
    valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
    prevValue = v;
  }

  // Falls back from "excludes prevValue, within cap" to "within cap only"
  // to "anything in range", so a value is always found.
  function pickValue(maxV: number): number {
    const strict = candidates(valueCounts, maxV, prevValue);
    if (strict.length > 0) return pickFrom(strict);
    const capOnly = candidates(valueCounts, maxV);
    if (capOnly.length > 0) return pickFrom(capOnly);
    return pickFrom(Array.from({ length: maxV }, (_, i) => i + 1));
  }

  for (let i = 0; i < rows; i++) {
    if (i === 0) {
      const first = pickValue(maxValue);
      terms.push(first);
      record(first);
      total = first;
      continue;
    }

    // Subtraction is often forced into a tiny range (can't exceed the
    // running total), which can collide with "not the same as last time".
    // Rather than force a repeat, prefer whichever operation still has a
    // non-excluded option available.
    const maxSub = Math.min(maxValue, total);
    const subCandidates = total >= 1 ? candidates(valueCounts, maxSub, prevValue) : [];
    const addCandidates = candidates(valueCounts, maxValue, prevValue);

    let doSubtract: boolean;
    if (subCandidates.length > 0 && addCandidates.length > 0) {
      doSubtract = Math.random() < 0.30;
    } else if (subCandidates.length > 0) {
      doSubtract = true;
    } else if (addCandidates.length > 0) {
      doSubtract = false;
    } else {
      // Both starved while excluding prevValue — extremely rare; fall back
      // to allowing a repeat rather than failing to generate a term.
      doSubtract = total >= 1 && Math.random() < 0.30;
    }

    if (doSubtract) {
      const val = subCandidates.length > 0 ? pickFrom(subCandidates) : pickValue(maxSub);
      terms.push(-val);
      record(val);
      total -= val;
    } else {
      const val = addCandidates.length > 0 ? pickFrom(addCandidates) : pickValue(maxValue);
      terms.push(val);
      record(val);
      total += val;
    }
  }

  return { terms, answer: total };
}

export function generateProblemSet(count: number, rows: number, maxValue: number = 9): AbacusProblem[] {
  return Array.from({ length: count }, () => generateProblem(rows, maxValue));
}
