// Pure "logic sequence space racer" game logic — no React.
// The player picks a lane, then dashes the car into the gate showing the
// correct next number in a sequence (e.g. 2, 4, 6, ? -> dash into "8").

export const LANES = 3 as const;
export type Lane = 0 | 1 | 2;

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

// ─── Progressive difficulty ─────────────────────────────────────────────────
// Levels never regress on a wrong answer — they only advance as the child
// plays more rounds, one level every 5 rounds, capping at MAX_LEVEL. Each
// level ADDS a new pattern type to the pool rather than replacing the old
// ones, so easy patterns keep interspersing with newly-unlocked harder ones
// instead of disappearing once a harder pattern unlocks.
export const MAX_LEVEL = 9;
export const ROUNDS_PER_LEVEL = 5;

export function levelForRounds(roundsPlayed: number): number {
  return Math.min(MAX_LEVEL, Math.floor(roundsPlayed / ROUNDS_PER_LEVEL) + 1);
}

// Time allowed to pick a lane and dash before the round auto-fails, in ms.
// Shrinks a little each level for extra challenge, but never below 5s.
export function roundTimeMsForLevel(level: number): number {
  return Math.max(5000, 10000 - (level - 1) * 600);
}

// A parent-facing cap on how far the auto-leveling is allowed to go.
// 0 means "uncapped" (ride the ladder all the way to MAX_LEVEL).
export const LEVEL_CAP_OPTIONS = [
  { value: 0, label: '不限制（預設）' },
  { value: 3, label: '關卡 3' },
  { value: 5, label: '關卡 5' },
  { value: 7, label: '關卡 7' },
] as const;
export type LevelCap = (typeof LEVEL_CAP_OPTIONS)[number]['value'];

export function effectiveLevel(roundsPlayed: number, cap: LevelCap): number {
  const raw = levelForRounds(roundsPlayed);
  return cap > 0 ? Math.min(raw, cap) : raw;
}

interface PatternSpec {
  diff: number;
  startMin: number;
  startMax: number;
}

// Each entry is the set of NEW patterns unlocked at that level; the pool for
// a given level is the union of this level's entry and every entry before it.
const LEVEL_UNLOCKS: PatternSpec[][] = [
  // Level 1 — plain counting
  [{ diff: 1, startMin: 1, startMax: 6 }],
  // Level 2 — 2x / 5x tables, kept to small starting numbers
  [
    { diff: 2, startMin: 0, startMax: 10 },
    { diff: 5, startMin: 0, startMax: 10 },
  ],
  // Level 3 — same tables, wider starting range
  [
    { diff: 2, startMin: 0, startMax: 30 },
    { diff: 5, startMin: 0, startMax: 50 },
  ],
  // Level 4 — 10x table
  [{ diff: 10, startMin: 0, startMax: 50 }],
  // Level 5 — counting backwards
  [{ diff: -1, startMin: 5, startMax: 20 }],
  // Level 6 — counting backwards by 2 / 5 / 10
  [
    { diff: -2, startMin: 10, startMax: 30 },
    { diff: -5, startMin: 25, startMax: 60 },
    { diff: -10, startMin: 50, startMax: 90 },
  ],
  // Level 7 — other common differences
  [
    { diff: 3, startMin: 0, startMax: 20 },
    { diff: 4, startMin: 0, startMax: 20 },
    { diff: 6, startMin: 0, startMax: 20 },
    { diff: 7, startMin: 0, startMax: 20 },
  ],
  // Level 8 — those differences, backwards
  [
    { diff: -3, startMin: 12, startMax: 30 },
    { diff: -4, startMin: 16, startMax: 30 },
    { diff: -6, startMin: 24, startMax: 40 },
    { diff: -7, startMin: 28, startMax: 40 },
  ],
  // Level 9 (top) — everything, with numbers stretched out toward 100
  [
    { diff: 1, startMin: 1, startMax: 90 },
    { diff: 2, startMin: 0, startMax: 46 },
    { diff: 5, startMin: 0, startMax: 80 },
    { diff: 10, startMin: 0, startMax: 60 },
  ],
];

function patternPoolForLevel(level: number): PatternSpec[] {
  const capped = Math.max(1, Math.min(level, LEVEL_UNLOCKS.length));
  return LEVEL_UNLOCKS.slice(0, capped).flat();
}

// Builds a 4-term arithmetic sequence (ascending or descending depending on
// the pattern's sign), the correct 5th term, and 2 plausible-but-wrong
// distractors — then randomly assigns correct/wrong values to the 3 lanes.
export function generateSequenceRound(level: number): SequenceRound {
  const pool = patternPoolForLevel(level);
  const spec = pool[Math.floor(Math.random() * pool.length)];
  const { diff } = spec;
  const start = randInt(spec.startMin, spec.startMax);

  const sequence = [0, 1, 2, 3].map((i) => start + i * diff);
  const answer = start + 4 * diff;

  const distractorPool = new Set<number>();
  const candidateOffsets = [diff, -diff, diff * 2, Math.max(1, Math.round(diff / 2))];
  for (const off of candidateOffsets) {
    const candidate = answer + off;
    if (candidate >= 0 && candidate !== answer) distractorPool.add(candidate);
  }
  // Guarantee 2 distractors even in edge cases (e.g. sequence lands on 0).
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
