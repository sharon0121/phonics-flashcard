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
  prompt: string; // canvas fallback text (sequence/arithmetic draw this directly)
  // Vocab rounds additionally carry the raw Chinese meaning so the view can
  // render it with zhuyin (bopomofo) via <ZhuyinText> instead of plain canvas
  // text, and speak it aloud — canvas can't lay out ruby annotations itself.
  promptZh?: string;
  promptZhuyin?: string;
  promptEmoji?: string;
  laneValues: [string, string, string]; // text shown in each lane's gate
  correctLane: Lane;
  answerLabel: string; // human-readable correct answer, for "太慢了！答案是 X"
  // When set, the view speaks answerLabel in this language once the round
  // resolves (right or wrong) — only vocab rounds want this (hear the English
  // word after answering); sequence/arithmetic answers are just numbers.
  speakAnswerLang?: 'en-US' | 'zh-TW';
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
// Order follows Sharon's requested memorization sequence (easiest-to-recall
// tables first, not numeric order): 1x → 10x → 5x → 2x → 3x → 4x → 6x/7x →
// 8x+9x — so the ladder doubles as times-table drill in the order a child
// actually learns 九九乘法表, and by level 9 all of 1x–9x are mixed for review.
const LEVEL_UNLOCKS: PatternSpec[][] = [
  [{ diff: 1, startMin: 1, startMax: 6, tableMode: true }], // Level 1 — 1的乘法表
  [{ diff: 10, startMin: 1, startMax: 5, tableMode: true }], // Level 2 — 10的乘法表
  [{ diff: 5, startMin: 1, startMax: 5, tableMode: true }], // Level 3 — 5的乘法表
  [{ diff: 2, startMin: 1, startMax: 5, tableMode: true }], // Level 4 — 2的乘法表
  [{ diff: 3, startMin: 1, startMax: 5, tableMode: true }], // Level 5 — 3的乘法表
  [{ diff: 4, startMin: 1, startMax: 5, tableMode: true }], // Level 6 — 4的乘法表
  [{ diff: 6, startMin: 1, startMax: 5, tableMode: true }], // Level 7 — 6的乘法表
  [{ diff: 7, startMin: 1, startMax: 5, tableMode: true }], // Level 8 — 7的乘法表
  [
    { diff: 8, startMin: 1, startMax: 5, tableMode: true },
    { diff: 9, startMin: 1, startMax: 5, tableMode: true },
  ], // Level 9 (top) — 8的乘法表＋9的乘法表 + full 1x–9x review
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

// Parent-facing "珠心算" difficulty knobs — how big the numbers get, and how
// many of them get chained together in one equation. Unlike the sequence
// ladder, this is a direct parent choice rather than auto-leveling, since
// mental-math difficulty is much more about the parent's judgment of their
// kid's current level than about rounds played.
export const ARITHMETIC_SIZE_OPTIONS = [
  { value: 10, label: '10 以內' },
  { value: 20, label: '20 以內' },
  { value: 50, label: '50 以內' },
  { value: 100, label: '100 以內' },
] as const;
export type ArithmeticSize = (typeof ARITHMETIC_SIZE_OPTIONS)[number]['value'];

export const ARITHMETIC_TERMS_OPTIONS = [
  { value: 2, label: '2 個數字' },
  { value: 3, label: '3 個數字' },
  { value: 4, label: '4 個數字' },
] as const;
export type ArithmeticTerms = (typeof ARITHMETIC_TERMS_OPTIONS)[number]['value'];

// A "珠心算" (mental arithmetic) equation chaining `termCount` numbers with
// +/− — each step keeps a running total and only subtracts an amount the
// total can afford, so the equation never dips negative partway through.
function generateArithmeticRound(maxVal: ArithmeticSize, termCount: ArithmeticTerms): RaceRound {
  let total = randInt(1, maxVal);
  const parts: string[] = [String(total)];
  for (let i = 1; i < termCount; i++) {
    const subtract = Math.random() < 0.4 && total > 0;
    const b = subtract ? randInt(1, total) : randInt(1, maxVal);
    if (subtract) {
      total -= b;
    } else {
      total += b;
    }
    parts.push(subtract ? '−' : '+', String(b));
  }
  const answer = total;

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
    prompt: `${parts.join(' ')} = ?`,
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
    promptZh: word.zh,
    promptZhuyin: word.zhuyin,
    promptEmoji: word.emoji,
    laneValues: values as [string, string, string],
    correctLane: laneOrder[0],
    answerLabel: word.word,
    speakAnswerLang: 'en-US',
  };
}

// Picks a question kind from whichever the parent enabled (falling back to
// 數列 if none are enabled, or if vocab is the only pick but the word pool
// is too small for a 3-choice question) and builds that round.
export function generateRaceRound(
  level: number,
  types: QuestionType[],
  wordPool: Word[],
  arithmeticSize: ArithmeticSize,
  arithmeticTerms: ArithmeticTerms,
): RaceRound {
  const requested = types.length > 0 ? types : (['sequence'] as QuestionType[]);
  const usable = requested.filter((t) => t !== 'vocab' || wordPool.length >= 3);
  const pool = usable.length > 0 ? usable : (['sequence'] as QuestionType[]);
  const kind = pool[Math.floor(Math.random() * pool.length)];
  if (kind === 'arithmetic') return generateArithmeticRound(arithmeticSize, arithmeticTerms);
  if (kind === 'vocab') return generateVocabRound(wordPool);
  return sequenceToRaceRound(generateSequenceRound(level));
}

// Score per correct gate, scaled up a little by combo streak (capped so it
// doesn't spiral out of control) — mirrors the escalating-but-bounded
// scoring style used elsewhere on the platform (e.g. Block Puzzle's combo).
export function gateScore(combo: number): number {
  return 10 + Math.min(combo, 10) * 5;
}
