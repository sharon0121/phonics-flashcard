// Pure "logic sequence space racer" game logic — no React.
// The player steers a ship between 3 lanes into the gate showing the
// correct next number in a sequence (e.g. 2, 4, 6, ? -> steer into "8").

export const LANES = 3 as const;
export type Lane = 0 | 1 | 2;

// Common-difference tiers a parent can enable — matches angry-cow's
// NUMBER_RANGE_OPTIONS multi-select-ladder convention exactly (paired with
// ladderTierValue from heroClimbSettings.ts).
export const STEP_TIER_OPTIONS = [
  { value: 1, label: '+1（1、2、3、4…）' },
  { value: 2, label: '+2（2、4、6、8…）' },
  { value: 5, label: '+5（5、10、15、20…）' },
  { value: 10, label: '+10（10、20、30、40…）' },
] as const;
export type StepTier = (typeof STEP_TIER_OPTIONS)[number]['value'];

export interface SequenceRound {
  sequence: number[]; // the 4 shown terms
  answer: number; // the correct next term
  laneValues: [number, number, number]; // value shown in each lane's gate
  correctLane: Lane;
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function shuffleLanes<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Builds a 4-term arithmetic sequence with the given common difference,
// the correct 5th term, and 2 plausible-but-wrong distractors (off by one
// step in either direction, or off by a small nudge) — then randomly
// assigns correct/wrong values to the 3 lanes.
export function generateSequenceRound(step: StepTier): SequenceRound {
  const start = step >= 5 ? randInt(0, 4) * step : randInt(1, 6);
  const sequence = [0, 1, 2, 3].map((i) => start + i * step);
  const answer = start + 4 * step;

  const distractorPool = new Set<number>();
  const candidateOffsets = [step, -step, step * 2, Math.max(1, Math.round(step / 2))];
  for (const off of candidateOffsets) {
    const candidate = answer + off;
    if (candidate >= 0 && candidate !== answer) distractorPool.add(candidate);
  }
  // Guarantee 2 distractors even in edge cases (e.g. sequence starts at 0).
  let fallback = 1;
  while (distractorPool.size < 2) {
    const candidate = answer + fallback;
    if (candidate >= 0 && candidate !== answer) distractorPool.add(candidate);
    fallback++;
  }
  const distractors = [...distractorPool].slice(0, 2);

  const laneOrder = shuffleLanes([0, 1, 2]) as Lane[];
  const values: number[] = [];
  values[laneOrder[0]] = answer;
  values[laneOrder[1]] = distractors[0];
  values[laneOrder[2]] = distractors[1];

  return {
    sequence,
    answer,
    laneValues: values as [number, number, number],
    correctLane: laneOrder[0],
  };
}

// Score per correct gate, scaled up a little by combo streak (capped so it
// doesn't spiral out of control) — mirrors the escalating-but-bounded
// scoring style used elsewhere on the platform (e.g. Block Puzzle's combo).
export function gateScore(combo: number): number {
  return 10 + Math.min(combo, 10) * 5;
}
