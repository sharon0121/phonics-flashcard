import { words as PHONICS_WORDS } from '@/data/words';
import type { Word } from '@/lib/types';

export type PlatformKind = 'plank' | 'spike' | 'collapse' | 'conveyorLeft' | 'conveyorRight' | 'spring';
export type ItemKind = 'heart' | 'skull' | 'speedBoost';

export interface Platform {
  id: string;
  y: number; // world depth — increases downward, unbounded
  x: number; // left position, percent of stage width
  width: number; // percent of stage width
  kind: PlatformKind;
  letterIndex?: number; // index into the current target word, if this platform carries a letter
  item?: ItemKind; // a one-off pickup, mutually exclusive with letterIndex
}

export const ROW_SPACING = 20; // world units between rows
const MIN_WIDTH = 24;
const MAX_WIDTH = 36;
const STAGE_MARGIN = 6;
const SPIKE_CHANCE = 0.16;
const LETTER_CHANCE = 0.80;
// Rolled only when a plank didn't already get a letter — a heart heals, a
// skull costs a life, and a speed boost temporarily speeds up the ceiling.
const HEART_CHANCE = 0.1;
const SKULL_CHANCE = 0.08;
const SPEED_BOOST_CHANCE = 0.06;
const SAFE_DEPTH = ROW_SPACING * 2; // no spikes for the first couple of rows
// Minimum empty space between two platforms sharing a row. Must clear the
// hero's own collision width (2 * CHAR_HALF_WIDTH = 10 in HeroClimbView) with
// real margin — a gap only as wide as the hero is never actually fall-through-
// able, since both platforms register as "overlapping" at once.
const ROW_GAP = 16;

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Splits the stage width into `count` non-overlapping zones (separated by
// ROW_GAP) and drops one randomly-sized platform into each — by construction
// no two platforms in the same row can ever overlap, unlike a retry-until-it-
// fits approach which can silently give up and place them on top of each
// other.
function placeRowRanges(count: number): Array<[number, number]> {
  const usable = 100 - STAGE_MARGIN * 2;
  const zoneWidth = (usable - ROW_GAP * (count - 1)) / count;
  const maxWidth = Math.min(MAX_WIDTH, zoneWidth);
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const zoneStart = STAGE_MARGIN + i * (zoneWidth + ROW_GAP);
    const width = randBetween(minWidth, maxWidth);
    const x = zoneStart + randBetween(0, zoneWidth - width);
    ranges.push([x, width]);
  }
  return ranges;
}

// Extends `platforms` with new rows until the deepest one reaches `targetY`.
// Consumes from `outstandingLetterIndices` (shift()) to decide which
// platforms carry the current target word's still-unplaced letters — a
// platform gets at most one, and not every platform gets one.
export function generateRows(
  platforms: Platform[],
  targetY: number,
  outstandingLetterIndices: number[],
): Platform[] {
  const added: Platform[] = [];
  let deepestY = platforms.reduce((max, p) => Math.max(max, p.y), 0);

  while (deepestY < targetY) {
    deepestY += ROW_SPACING;
    const count = Math.random() < 0.3 ? 2 : 1;
    const ranges = placeRowRanges(count);
    for (let i = 0; i < count; i++) {
      const [x, width] = ranges[i];

      const isSpike = deepestY > SAFE_DEPTH && Math.random() < SPIKE_CHANCE;
      let kind: PlatformKind = 'plank';
      if (isSpike) {
        kind = 'spike';
      } else if (deepestY > SAFE_DEPTH) {
        const roll = Math.random();
        if (roll < 0.1) kind = 'collapse';
        else if (roll < 0.18) kind = 'conveyorLeft';
        else if (roll < 0.26) kind = 'conveyorRight';
        else if (roll < 0.32) kind = 'spring';
      }
      const letterIndex =
        kind === 'plank' && outstandingLetterIndices.length > 0 && Math.random() < LETTER_CHANCE
          ? outstandingLetterIndices.shift()
          : undefined;

      let item: ItemKind | undefined;
      if (kind === 'plank' && letterIndex === undefined && deepestY > SAFE_DEPTH) {
        const itemRoll = Math.random();
        if (itemRoll < HEART_CHANCE) item = 'heart';
        else if (itemRoll < HEART_CHANCE + SKULL_CHANCE) item = 'skull';
        else if (itemRoll < HEART_CHANCE + SKULL_CHANCE + SPEED_BOOST_CHANCE) item = 'speedBoost';
      }

      added.push({
        id: `p-${Math.round(deepestY)}-${i}-${Math.round(x)}`,
        y: deepestY,
        x,
        width,
        kind,
        letterIndex,
        item,
      });
    }
  }

  return added.length > 0 ? [...platforms, ...added] : platforms;
}

// Drops platforms that have scrolled above `minY`. Any letter they were
// still carrying (never collected) is returned so the caller can requeue it
// — otherwise a missed letter could vanish forever and a word could never
// be completed.
export function pruneRows(platforms: Platform[], minY: number): { kept: Platform[]; missedLetterIndices: number[] } {
  const kept: Platform[] = [];
  const missedLetterIndices: number[] = [];
  for (const p of platforms) {
    if (p.y >= minY) {
      kept.push(p);
    } else if (p.letterIndex !== undefined) {
      missedLetterIndices.push(p.letterIndex);
    }
  }
  return { kept, missedLetterIndices: missedLetterIndices.length > 0 ? missedLetterIndices : [] };
}

function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// A fresh shuffled queue of every letter-position in `word`, in the order
// platforms should offer them.
export function makeLetterQueue(word: string): number[] {
  return shuffled(Array.from({ length: word.length }, (_, i) => i));
}

// Picks the next word to spell from `pools`, tried in the order given (the
// caller decides which sources are enabled and in what priority — see
// heroClimbSettings' word-source setting), avoiding repeats within the run
// until every pool is exhausted (then starts over). `fallbackPool` is a
// last-resort safety net — used only if every configured pool is completely
// empty (e.g. every source got disabled), so the game never gets stuck.
export function pickNextTargetWord(pools: Word[][], usedIds: Set<string>, fallbackPool: Word[] = PHONICS_WORDS): Word {
  for (const pool of pools) {
    const available = pool.filter((w) => !usedIds.has(w.id));
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)];
      usedIds.add(picked.id);
      return picked;
    }
  }
  usedIds.clear();
  const safePool = pools.find((p) => p.length > 0) ?? fallbackPool;
  const picked = safePool[Math.floor(Math.random() * safePool.length)];
  usedIds.add(picked.id);
  return picked;
}

export interface ReviewPickState {
  wordsInBlock: number; // how many words drawn since the last forced review pick
  nextSlot: number; // the (1-indexed) position within the current block that forces a review pick
}

function randomSlot(): number {
  return 1 + Math.floor(Math.random() * 10);
}

export function makeReviewPickState(): ReviewPickState {
  return { wordsInBlock: 0, nextSlot: randomSlot() };
}

// Same as pickNextTargetWord, but every ~10 words (at a randomised position
// within that window) forces a pick from `reviewPool` instead — the words the
// player explicitly unchecked in settings to see again. Only kicks in while
// reviewPool is non-empty; falls through to the normal pools otherwise.
export function pickNextWordWithReview(
  pools: Word[][],
  usedIds: Set<string>,
  reviewPool: Word[],
  state: ReviewPickState,
  fallbackPool: Word[] = PHONICS_WORDS,
): { word: Word; state: ReviewPickState; fromReview: boolean } {
  const wordsInBlock = state.wordsInBlock + 1;
  if (reviewPool.length > 0 && wordsInBlock >= state.nextSlot) {
    const word = reviewPool[Math.floor(Math.random() * reviewPool.length)];
    usedIds.add(word.id);
    return { word, state: { wordsInBlock: 0, nextSlot: randomSlot() }, fromReview: true };
  }
  const word = pickNextTargetWord(pools, usedIds, fallbackPool);
  return { word, state: { wordsInBlock, nextSlot: state.nextSlot }, fromReview: false };
}
