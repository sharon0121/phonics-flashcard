// Pure "logic sequence space racer" game logic — no React.
// The player picks a lane, then dashes the car into the gate showing the
// correct answer (a sequence's next number, an arithmetic result, or an
// English word) among 3 lanes.

import type { Word } from './types';

export const LANES = 3 as const;
export type Lane = 0 | 1 | 2;

export interface SequenceRound {
  sequence: number[]; // the 4 shown terms
  answer: number; // the correct next term
  laneValues: [number, number, number]; // value shown in each lane's gate
  correctLane: Lane;
}

// What kind of question a round asks — parents pick which kinds are in play.
export type QuestionType = 'sequence' | 'arithmetic' | 'vocab';
export const QUESTION_TYPE_OPTIONS = [
  { value: 'sequence', label: '🔢 數列規律' },
  { value: 'arithmetic', label: '🧮 珠心算' },
  { value: 'vocab', label: '📚 英文單字' },
] as const;

// The generalized shape every gate round produces, regardless of kind — the
// view only ever needs prompt text + 3 lane strings + which lane is right.
export interface RaceRound {
  kind: QuestionType;
  prompt: string; // shown at the top of the screen
  laneValues: [string, string, string]; // text shown in each lane's gate
  correctLane: Lane;
  answerLabel: string; // human-readable correct answer, for "太慢了！答案是 X"
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
  // When true, startMin/startMax bound a MULTIPLIER k (start = diff * k)
  // instead of the start value itself — every shown term then lands exactly
  // on the diff's times table (e.g. 5, 10, 15, 20 — not "8, 13, 18, 23",
  // which happens to share the same common difference but isn't recognizable
  // as the 5x table). This is what makes the sequence double as multiplication
  // table practice.
  tableMode?: boolean;
}

// Each entry is the set of NEW patterns unlocked at that level; the pool for
// a given level is the union of this level's entry and every entry before it.
// Levels 2–9 walk straight through the 2x–9x tables (Taiwan's 九九乘法表
// order), one table per level, so the ladder doubles as times-table drill —
// by level 9 all of 2x–9x are mixed together for review.
const LEVEL_UNLOCKS: PatternSpec[][] = [
  [{ diff: 1, startMin: 1, startMax: 6 }], // Level 1 — plain counting warm-up
  [{ diff: 2, startMin: 1, startMax: 5, tableMode: true }], // Level 2 — 2的乘法表
  [{ diff: 3, startMin: 1, startMax: 5, tableMode: true }], // Level 3 — 3的乘法表
  [{ diff: 4, startMin: 1, startMax: 5, tableMode: true }], // Level 4 — 4的乘法表
  [{ diff: 5, startMin: 1, startMax: 5, tableMode: true }], // Level 5 — 5的乘法表
  [{ diff: 6, startMin: 1, startMax: 5, tableMode: true }], // Level 6 — 6的乘法表
  [{ diff: 7, startMin: 1, startMax: 5, tableMode: true }], // Level 7 — 7的乘法表
  [{ diff: 8, startMin: 1, startMax: 5, tableMode: true }], // Level 8 — 8的乘法表
  [{ diff: 9, startMin: 1, startMax: 5, tableMode: true }], // Level 9 (top) — 9的乘法表 + full 2x–9x review
];

function patternPoolForLevel(level: number): PatternSpec[] {
  const capped = Math.max(1, Math.min(level, LEVEL_UNLOCKS.length));
  return LEVEL_UNLOCKS.slice(0, capped).flat();
}

// Builds a 4-term arithmetic sequence, the correct 5th term, and 2
// plausible-but-wrong distractors — then randomly assigns correct/wrong
// values to the 3 lanes. In tableMode the start is snapped to a multiple of
// diff so the whole sequence reads as a times-table segment.
export function generateSequenceRound(level: number): SequenceRound {
  const pool = patternPoolForLevel(level);
  const spec = pool[Math.floor(Math.random() * pool.length)];
  const { diff } = spec;
  const start = spec.tableMode
    ? Math.abs(diff) * randInt(spec.startMin, spec.startMax)
    : randInt(spec.startMin, spec.startMax);

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

function sequenceToRaceRound(round: SequenceRound): RaceRound {
  return {
    kind: 'sequence',
    prompt: `${round.sequence.join(', ')}, ?`,
    laneValues: round.laneValues.map(String) as [string, string, string],
    correctLane: round.correctLane,
    answerLabel: String(round.answer),
  };
}

// A simple 2-term "珠心算" (mental arithmetic) equation — operand size grows
// gently with level, subtraction never goes negative.
function generateArithmeticRound(level: number): RaceRound {
  const maxVal = Math.min(30, 8 + level * 3);
  let a = randInt(2, maxVal);
  let b = randInt(1, maxVal);
  const subtract = Math.random() < 0.4;
  let op = '+';
  let answer = a + b;
  if (subtract) {
    if (b > a) [a, b] = [b, a];
    op = '−';
    answer = a - b;
  }

  const distractorPool = new Set<number>();
  for (const off of [1, -1, 2, -2, 3]) {
    const candidate = answer + off;
    if (candidate >= 0 && candidate !== answer) distractorPool.add(candidate);
  }
  const distractors = [...distractorPool].slice(0, 2);

  const laneOrder = shuffleLanes([0, 1, 2]) as Lane[];
  const values: string[] = [];
  values[laneOrder[0]] = String(answer);
  values[laneOrder[1]] = String(distractors[0]);
  values[laneOrder[2]] = String(distractors[1]);

  return {
    kind: 'arithmetic',
    prompt: `${a} ${op} ${b} = ?`,
    laneValues: values as [string, string, string],
    correctLane: laneOrder[0],
    answerLabel: String(answer),
  };
}

// Shows an emoji + Chinese meaning as the prompt, English spellings as the 3
// lane choices — reuses whichever word pool the quiz settings select.
function generateVocabRound(pool: Word[]): RaceRound {
  const word = pool[Math.floor(Math.random() * pool.length)];
  const distractors = shuffleLanes(pool.filter((w) => w.id !== word.id)).slice(0, 2);

  const laneOrder = shuffleLanes([0, 1, 2]) as Lane[];
  const values: string[] = [];
  values[laneOrder[0]] = word.word;
  values[laneOrder[1]] = distractors[0].word;
  values[laneOrder[2]] = distractors[1].word;

  return {
    kind: 'vocab',
    prompt: `${word.emoji} ${word.zh}`,
    laneValues: values as [string, string, string],
    correctLane: laneOrder[0],
    answerLabel: word.word,
  };
}

// Picks a question kind from whichever the parent enabled (falling back to
// 數列 if none are enabled, or if vocab is the only pick but the word pool
// is too small for a 3-choice question) and builds that round.
export function generateRaceRound(level: number, types: QuestionType[], wordPool: Word[]): RaceRound {
  const requested = types.length > 0 ? types : (['sequence'] as QuestionType[]);
  const usable = requested.filter((t) => t !== 'vocab' || wordPool.length >= 3);
  const pool = usable.length > 0 ? usable : (['sequence'] as QuestionType[]);
  const kind = pool[Math.floor(Math.random() * pool.length)];
  if (kind === 'arithmetic') return generateArithmeticRound(level);
  if (kind === 'vocab') return generateVocabRound(wordPool);
  return sequenceToRaceRound(generateSequenceRound(level));
}

// Score per correct gate, scaled up a little by combo streak (capped so it
// doesn't spiral out of control) — mirrors the escalating-but-bounded
// scoring style used elsewhere on the platform (e.g. Block Puzzle's combo).
export function gateScore(combo: number): number {
  return 10 + Math.min(combo, 10) * 5;
}
