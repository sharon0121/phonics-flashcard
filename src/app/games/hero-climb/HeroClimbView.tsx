'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Word } from '@/lib/types';
import { useThisWeekClimbWords, useReinforcementClimbWords } from '@/lib/heroClimbSettings';
import { useCustomWords } from '@/lib/customWords';
import {
  generateRows,
  pruneRows,
  makeLetterQueue,
  pickNextTargetWord,
  ROW_SPACING,
  type Platform,
} from '@/lib/heroClimb';
import { recordClimbRun, renameClimbRecord, useLastPlayerName } from '@/lib/heroClimbHistory';
import {
  playCollectSound,
  playCelebrationChime,
  playErrorSound,
  playFallSound,
  playDingSound,
  playPortalSound,
} from '@/lib/sound';
import HeroMascot from '@/components/HeroMascot';
import ZhuyinText from '@/components/ZhuyinText';
import LeaderboardPanel from './LeaderboardPanel';

const START_LIVES = 5;
const SPEED_BOOST_MS = 10000; // how long a speed-boost pickup lasts
const SPEED_BOOST_MULTIPLIER = 1.8; // applied to the ceiling's scroll speed only, on top of difficulty
const FIXED_SCREEN_TOP_PCT = 30; // where the visible window's top edge sits, in world-relative-to-camera terms
const CHAR_HALF_WIDTH = 5; // percent, for horizontal collision
const FALL_SPEED = 32; // world units per second while actively falling
const MOVE_SPEED = 62; // percent of stage width per second
const GENERATE_AHEAD = 60; // keep platforms generated this far below the visible bottom
const PRUNE_BEHIND = 40; // drop platforms once they're this far above the visible top
const HAZARD_COOLDOWN_MS = 900;
const CELEBRATION_MS = 1800;
const CONVEYOR_SPEED = 26; // percent of stage width per second, added on top of player input
const COLLAPSE_DELAY_MS = 550; // how long a collapsing step holds before giving way
const SPRING_BOOST = 26; // total world units risen over the spring bounce
const SPRING_RISE_MS = 260; // how long the bounce arc takes to play out

// The ceiling scrolls down at a constant pace no matter what the hero is
// doing — falling faster than this widens the safety lead; resting on a
// platform (or moving sideways without descending) lets it shrink. This is
// what makes "just stand still" actually dangerous, matching the reference.
const SCROLL_SPEED = 14; // world units per second
const CAMERA_START_LEAD = 30; // hero starts this far ahead of the ceiling
const DANGER_MARGIN = 2; // lead this small (or less) means the ceiling caught up
const RECOVERY_LEAD = 20; // lead restored after getting caught

// Falling is faster than the ceiling's scroll, so an uninterrupted freefall
// (skipping every platform on the way down) widens the lead without limit —
// past (100 - FIXED_SCREEN_TOP_PCT) world units the hero would visually drop
// below the bottom edge of the stage and could land on a platform that
// hasn't scrolled into view yet. MAX_LEAD keeps a buffer under that so the
// camera speeds up to keep the hero on-screen instead.
const MAX_LEAD = 100 - FIXED_SCREEN_TOP_PCT - 15;

// The longer a run goes (by wall-clock time, not depth — so it keeps ramping
// even if the hero is stuck bouncing in place), the faster everything gets:
// falling, the chasing ceiling, and the conveyors all scale up together (so
// the danger-margin math above stays balanced), ramping from 1x up to
// DIFFICULTY_MAX_MULTIPLIER over DIFFICULTY_RAMP_SECONDS, then holding
// steady so it never becomes literally unbeatable.
const DIFFICULTY_MAX_MULTIPLIER = 1.8;
const DIFFICULTY_RAMP_SECONDS = 90;

type Direction = 'left' | 'right';

// A row of `teeth` symmetric triangular spikes, base-tip-base-tip..., either
// pointing down from a ceiling (tipDown) or up from a floor mount.
function spikeClipPath(teeth: number, tipDown: boolean): string {
  const step = 100 / teeth;
  const base = tipDown ? 0 : 100;
  const tip = tipDown ? 100 : 0;
  const points = [`0% ${base}%`];
  for (let i = 1; i <= teeth; i++) {
    points.push(`${(i - 0.5) * step}% ${tip}%`);
    points.push(`${i * step}% ${base}%`);
  }
  return `polygon(${points.join(', ')})`;
}

const ICY_SPIKE_GRADIENT = 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 55%, #64748b 100%)';

function PlatformBar({ kind }: { kind: Platform['kind'] }) {
  if (kind === 'spike') {
    return (
      <div className="relative h-4 w-full">
        <div className="absolute inset-x-0 bottom-0 h-1 rounded-sm bg-zinc-700 shadow-[0_2px_0_rgba(0,0,0,0.5)]" />
        <div
          className="absolute inset-x-0 bottom-0 h-4"
          style={{
            background: ICY_SPIKE_GRADIENT,
            clipPath: spikeClipPath(9, false),
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))',
          }}
        />
      </div>
    );
  }
  if (kind === 'collapse') {
    return (
      <div className="h-2.5 w-full rounded-md border border-dashed border-zinc-300/70 bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-600 shadow-[0_3px_0_rgba(0,0,0,0.45)]" />
    );
  }
  if (kind === 'conveyorLeft' || kind === 'conveyorRight') {
    return (
      <div
        className={`h-2.5 w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-400 shadow-[0_3px_0_rgba(0,0,0,0.45)] ${
          kind === 'conveyorLeft' ? 'conveyor-left' : 'conveyor-right'
        }`}
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #52525b 0 4px, #a1a1aa 4px 10px)',
          backgroundSize: '200% 100%',
        }}
      />
    );
  }
  if (kind === 'spring') {
    return (
      <div
        className="h-3 w-full rounded-sm border-y-2 border-lime-400 shadow-[0_3px_0_rgba(0,0,0,0.45)]"
        style={{
          backgroundColor: '#052e16',
          backgroundImage:
            'linear-gradient(135deg, transparent 42%, #f0fdf4 42%, #f0fdf4 58%, transparent 58%), linear-gradient(45deg, transparent 42%, #f0fdf4 42%, #f0fdf4 58%, transparent 58%)',
          backgroundSize: '14px 100%',
          backgroundRepeat: 'repeat-x',
        }}
      />
    );
  }
  return (
    <div className="h-2.5 w-full rounded-md border border-amber-950/70 bg-gradient-to-b from-amber-300 via-amber-600 to-amber-900 shadow-[0_3px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]" />
  );
}

interface LatestRefs {
  target: Word;
  filledPositions: boolean[];
  weekWords: Word[];
  reinforcementWords: Word[];
  customWords: Word[];
}

export default function HeroClimbView() {
  const weekWords = useThisWeekClimbWords();
  const reinforcementWords = useReinforcementClimbWords();
  const customWords = useCustomWords();
  const lastPlayerName = useLastPlayerName();

  const usedWordIdsRef = useRef(new Set<string>());
  const [target, setTarget] = useState<Word>(() =>
    pickNextTargetWord(weekWords, reinforcementWords, customWords, usedWordIdsRef.current),
  );
  const outstandingRef = useRef<number[]>(makeLetterQueue(target.word));
  const [filledPositions, setFilledPositions] = useState<boolean[]>(() => new Array(target.word.length).fill(false));

  const [platforms, setPlatforms] = useState<Platform[]>(() =>
    generateRows([], 100 - FIXED_SCREEN_TOP_PCT + GENERATE_AHEAD, outstandingRef.current),
  );
  const platformsRef = useRef(platforms);

  const [lives, setLives] = useState(START_LIVES);
  const [depth, setDepth] = useState(0);
  const [maxDepth, setMaxDepth] = useState(0);
  const [wordsCompletedCount, setWordsCompletedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [caughtFlash, setCaughtFlash] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [nameInput, setNameInput] = useState(lastPlayerName);
  const [renamed, setRenamed] = useState(false);

  const livesRef = useRef(lives);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  const maxDepthRef = useRef(maxDepth);
  const wordsCompletedRef = useRef(wordsCompletedCount);
  const filledPositionsRef = useRef(filledPositions);
  const celebratingRef = useRef(false);
  const finishedRef = useRef(false);
  const savedRecordIdRef = useRef<string | null>(null);
  const lastPlayerNameRef = useRef(lastPlayerName);
  useEffect(() => {
    lastPlayerNameRef.current = lastPlayerName;
  }, [lastPlayerName]);

  // Always-fresh snapshot of state the physics loop needs but shouldn't
  // restart the loop over — read at the moment an event actually happens.
  const latestRef = useRef<LatestRefs>({ target, filledPositions, weekWords, reinforcementWords, customWords });
  useEffect(() => {
    latestRef.current = { target, filledPositions, weekWords, reinforcementWords, customWords };
  });

  const charXRef = useRef(50);
  const charYRef = useRef(0);
  const cameraYRef = useRef(-CAMERA_START_LEAD);
  const restingOnRef = useRef<Platform | null>(null);
  const springBounceRef = useRef<{ remainingMs: number; perMs: number } | null>(null);
  // How much of the danger-margin check to forgive right now, purely so a
  // spring bounce itself can never be the thing that costs a life — it does
  // NOT touch cameraYRef, so the background's own scroll rhythm never pauses
  // or reverses for a bounce, only the hero's own position does. Decays back
  // to 0 over time, so it's a temporary shield, not a permanent exploit.
  const springGraceRef = useRef(0);
  const heldDirRef = useRef<Direction | null>(null);
  const facingRef = useRef<Direction>('right');
  const hazardHitAtRef = useRef<Map<string, number>>(new Map());
  const collapseAtRef = useRef<Map<string, number>>(new Map());
  const fallenIdsRef = useRef<Set<string>>(new Set());
  const [fallenIds, setFallenIds] = useState<Set<string>>(new Set());
  const collectedItemIdsRef = useRef<Set<string>>(new Set());
  const [collectedItemIds, setCollectedItemIds] = useState<Set<string>>(new Set());
  const speedBoostRef = useRef<{ remainingMs: number } | null>(null);
  const [boosting, setBoosting] = useState(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const runStartTimeRef = useRef<number | null>(null);

  const worldRef = useRef<HTMLDivElement>(null);
  const heroElRef = useRef<HTMLDivElement>(null);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGameOver(true);
    const id = recordClimbRun(lastPlayerNameRef.current, maxDepthRef.current, wordsCompletedRef.current, Date.now());
    savedRecordIdRef.current = id;
  }, []);

  const loseLife = useCallback(() => {
    playErrorSound();
    const remaining = livesRef.current - 1;
    livesRef.current = remaining;
    setLives(remaining);
    setCaughtFlash(true);
    setTimeout(() => setCaughtFlash(false), 400);
    if (remaining <= 0) {
      finishGame();
    }
  }, [finishGame]);

  const gainLife = useCallback(() => {
    playDingSound();
    const capped = Math.min(START_LIVES, livesRef.current + 1);
    livesRef.current = capped;
    setLives(capped);
  }, []);

  const activateSpeedBoost = useCallback(() => {
    playPortalSound();
    speedBoostRef.current = { remainingMs: SPEED_BOOST_MS };
    setBoosting(true);
  }, []);

  const completeWord = useCallback(() => {
    celebratingRef.current = true;
    setCelebrating(true);
    playCelebrationChime();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(latestRef.current.target.word);
      utter.lang = 'en-US';
      utter.rate = 0.85;
      window.speechSynthesis.cancel();
      setTimeout(() => window.speechSynthesis.speak(utter), 50);
    }
    wordsCompletedRef.current += 1;
    setWordsCompletedCount(wordsCompletedRef.current);

    setTimeout(() => {
      const { weekWords: w, reinforcementWords: r, customWords: c } = latestRef.current;
      const nextWord = pickNextTargetWord(w, r, c, usedWordIdsRef.current);
      setTarget(nextWord);
      outstandingRef.current = makeLetterQueue(nextWord.word);
      const fresh = new Array(nextWord.word.length).fill(false);
      filledPositionsRef.current = fresh;
      setFilledPositions(fresh);
      celebratingRef.current = false;
      setCelebrating(false);
    }, CELEBRATION_MS);
  }, []);

  const collectLetter = useCallback(
    (index: number) => {
      playCollectSound();
      if (heroElRef.current) {
        heroElRef.current.classList.remove('hero-letter-glow');
        // Force a reflow so re-adding the class restarts the animation even
        // if two letters are collected in quick succession.
        void heroElRef.current.offsetWidth;
        heroElRef.current.classList.add('hero-letter-glow');
        setTimeout(() => heroElRef.current?.classList.remove('hero-letter-glow'), 500);
      }
      const next = [...filledPositionsRef.current];
      next[index] = true;
      filledPositionsRef.current = next;
      setFilledPositions(next);
      if (next.every(Boolean)) completeWord();
    },
    [completeWord],
  );

  const collectItem = useCallback(
    (platform: Platform) => {
      if (collectedItemIdsRef.current.has(platform.id)) return;
      collectedItemIdsRef.current.add(platform.id);
      setCollectedItemIds(new Set(collectedItemIdsRef.current));
      if (platform.item === 'heart') gainLife();
      else if (platform.item === 'skull') loseLife();
      else if (platform.item === 'speedBoost') activateSpeedBoost();
    },
    [gainLife, loseLife, activateSpeedBoost],
  );

  function updatePlatforms(next: Platform[]) {
    platformsRef.current = next;
    setPlatforms(next);
  }

  // Main physics loop — runs once per game (only restarts on game-over/retry),
  // reading fresh word/pool data via latestRef so it never goes stale.
  useEffect(() => {
    if (gameOver) return;
    let rafId: number;

    function tick(now: number) {
      if (lastFrameTimeRef.current == null) lastFrameTimeRef.current = now;
      if (runStartTimeRef.current == null) runStartTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      if (!celebratingRef.current) {
        // Everything speeds up together the longer this run has lasted, so
        // the danger-margin balance from the constants above holds throughout.
        const elapsedSec = (now - runStartTimeRef.current) / 1000;
        const difficulty =
          1 + (DIFFICULTY_MAX_MULTIPLIER - 1) * Math.min(1, elapsedSec / DIFFICULTY_RAMP_SECONDS);

        if (heldDirRef.current === 'left') charXRef.current -= MOVE_SPEED * dt;
        if (heldDirRef.current === 'right') charXRef.current += MOVE_SPEED * dt;

        const overlapsX = (p: Platform) =>
          charXRef.current + CHAR_HALF_WIDTH > p.x && charXRef.current - CHAR_HALF_WIDTH < p.x + p.width;
        const isStandable = (p: Platform) => !fallenIdsRef.current.has(p.id);

        if (restingOnRef.current) {
          // Conveyors carry the hero along even without input.
          if (restingOnRef.current.kind === 'conveyorLeft') charXRef.current -= CONVEYOR_SPEED * difficulty * dt;
          if (restingOnRef.current.kind === 'conveyorRight') charXRef.current += CONVEYOR_SPEED * difficulty * dt;
        }
        charXRef.current = Math.min(100 - CHAR_HALF_WIDTH, Math.max(CHAR_HALF_WIDTH, charXRef.current));

        if (restingOnRef.current && !overlapsX(restingOnRef.current)) {
          restingOnRef.current = null;
        }

        const triggerHazardOnce = (p: Platform) => {
          const last = hazardHitAtRef.current.get(p.id) ?? -Infinity;
          if (now - last > HAZARD_COOLDOWN_MS) {
            hazardHitAtRef.current.set(p.id, now);
            loseLife();
          }
        };

        if (springBounceRef.current) {
          // Rising out of a spring — only the hero's own position moves; the
          // background/ceiling keeps scrolling at its own constant pace
          // below, completely undisturbed by the bounce. springGraceRef is
          // what keeps the bounce itself from reading as "falling behind."
          const bounce = springBounceRef.current;
          const dtMs = dt * 1000;
          const consumedMs = Math.min(bounce.remainingMs, dtMs);
          const rise = consumedMs * bounce.perMs;
          charYRef.current = Math.max(0, charYRef.current - rise);
          bounce.remainingMs -= consumedMs;
          if (bounce.remainingMs <= 0) springBounceRef.current = null;
        } else if (!restingOnRef.current) {
          const nextY = charYRef.current + FALL_SPEED * difficulty * dt;
          const crossedPlatforms = platformsRef.current
            .filter((p) => p.y > charYRef.current - 0.01 && p.y <= nextY && overlapsX(p))
            .sort((a, b) => a.y - b.y);

          // A spike still catches the hero like solid ground — it costs a
          // life on contact, but the hero lands and rests on it rather than
          // falling straight through.
          for (const p of crossedPlatforms) {
            if (p.kind === 'spike') triggerHazardOnce(p);
          }
          const landing = crossedPlatforms.find(isStandable);
          if (landing) {
            if (landing.kind === 'spring') {
              // A spring never holds the hero — it touches down for an
              // instant then bounces back up over SPRING_RISE_MS before the
              // fall resumes from the higher point.
              playCollectSound();
              charYRef.current = landing.y;
              springBounceRef.current = { remainingMs: SPRING_RISE_MS, perMs: SPRING_BOOST / SPRING_RISE_MS };
              springGraceRef.current += SPRING_BOOST;
            } else {
              charYRef.current = landing.y;
              restingOnRef.current = landing;
              if (landing.kind === 'collapse' && !collapseAtRef.current.has(landing.id)) {
                collapseAtRef.current.set(landing.id, now);
              }
            }
          } else {
            charYRef.current = nextY;
          }
        }

        // A collapsing step gives way if the hero lingers on it too long.
        if (restingOnRef.current?.kind === 'collapse') {
          const since = collapseAtRef.current.get(restingOnRef.current.id) ?? now;
          if (now - since > COLLAPSE_DELAY_MS) {
            playFallSound();
            fallenIdsRef.current.add(restingOnRef.current.id);
            setFallenIds(new Set(fallenIdsRef.current));
            restingOnRef.current = null;
          }
        }

        // Also catch sliding sideways into a spike that's in the same row
        // as wherever the hero currently is (falling or resting).
        for (const p of platformsRef.current) {
          if (p.kind === 'spike' && Math.abs(p.y - charYRef.current) < 1 && overlapsX(p)) {
            triggerHazardOnce(p);
          }
        }

        const standing = restingOnRef.current;
        if (standing && standing.letterIndex !== undefined && !latestRef.current.filledPositions[standing.letterIndex]) {
          collectLetter(standing.letterIndex);
        }
        if (standing && standing.item !== undefined && !collectedItemIdsRef.current.has(standing.id)) {
          collectItem(standing);
        }

        // A speedBoost pickup temporarily speeds up just the ceiling's own
        // scroll, on top of the normal difficulty ramp.
        if (speedBoostRef.current) {
          speedBoostRef.current.remainingMs -= dt * 1000;
          if (speedBoostRef.current.remainingMs <= 0) {
            speedBoostRef.current = null;
            setBoosting(false);
          }
        }
        const scrollMultiplier = difficulty * (speedBoostRef.current ? SPEED_BOOST_MULTIPLIER : 1);

        // The ceiling scrolls down at a constant pace regardless of what the
        // hero is doing — this never pauses or reverses for anything,
        // springs included. Falling faster than this widens the safety
        // lead; resting (or dawdling) lets it shrink — that's what makes
        // standing still genuinely dangerous, matching the reference game.
        cameraYRef.current += SCROLL_SPEED * scrollMultiplier * dt;
        // An uninterrupted freefall (dodging every platform) gains lead
        // faster than the ceiling scrolls, without limit — cap it so the
        // hero never drops below the visible stage and can't land on a
        // platform that hasn't scrolled into view yet.
        if (charYRef.current - cameraYRef.current > MAX_LEAD) {
          cameraYRef.current = charYRef.current - MAX_LEAD;
        }
        springGraceRef.current = Math.max(0, springGraceRef.current - SCROLL_SPEED * scrollMultiplier * dt);
        if (charYRef.current - cameraYRef.current + springGraceRef.current < DANGER_MARGIN) {
          playFallSound();
          loseLife();
          restingOnRef.current = null;
          springBounceRef.current = null;
          springGraceRef.current = 0;
          charYRef.current = cameraYRef.current + RECOVERY_LEAD;
        }

        const flooredDepth = Math.floor(charYRef.current / ROW_SPACING);
        if (flooredDepth !== maxDepthRef.current) {
          maxDepthRef.current = Math.max(maxDepthRef.current, flooredDepth);
          setDepth(flooredDepth);
          setMaxDepth(maxDepthRef.current);
        }

        const deepestNeeded = Math.max(charYRef.current, cameraYRef.current) + (100 - FIXED_SCREEN_TOP_PCT);
        const grown = generateRows(platformsRef.current, deepestNeeded + GENERATE_AHEAD, outstandingRef.current);
        if (grown !== platformsRef.current) updatePlatforms(grown);

        const shallowestNeeded = Math.min(charYRef.current, cameraYRef.current) - FIXED_SCREEN_TOP_PCT;
        const pruneBelow = shallowestNeeded - PRUNE_BEHIND;
        if (platformsRef.current.some((p) => p.y < pruneBelow)) {
          const { kept, missedLetterIndices } = pruneRows(platformsRef.current, pruneBelow);
          if (missedLetterIndices.length > 0) outstandingRef.current.push(...missedLetterIndices);
          updatePlatforms(kept);
        }
      }

      if (worldRef.current) {
        worldRef.current.style.transform = `translateY(${FIXED_SCREEN_TOP_PCT - cameraYRef.current}%)`;
      }
      if (heroElRef.current) {
        const isFalling = !restingOnRef.current && heldDirRef.current === null;
        // Falling always faces the player head-on (arms flailing symmetrically);
        // only the left/right run pose leans into a side-facing flip.
        const flip = !isFalling && facingRef.current === 'left';
        heroElRef.current.style.top = `${charYRef.current}%`;
        heroElRef.current.style.left = `${charXRef.current}%`;
        heroElRef.current.style.transform = `translate(-50%, -100%) scaleX(${flip ? -1 : 1})`;
        heroElRef.current.classList.toggle('hero-running', heldDirRef.current !== null);
        heroElRef.current.classList.toggle('hero-falling', isFalling);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      lastFrameTimeRef.current = null;
    };
  }, [gameOver, loseLife, collectLetter, collectItem]);

  function startHold(dir: Direction) {
    heldDirRef.current = dir;
    facingRef.current = dir;
  }
  function stopHold() {
    heldDirRef.current = null;
  }

  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right' };
    function handleKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      heldDirRef.current = dir;
      facingRef.current = dir;
    }
    function handleKeyUp(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      if (heldDirRef.current === dir) heldDirRef.current = null;
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  function retry() {
    finishedRef.current = false;
    savedRecordIdRef.current = null;
    charXRef.current = 50;
    charYRef.current = 0;
    cameraYRef.current = -CAMERA_START_LEAD;
    restingOnRef.current = null;
    springBounceRef.current = null;
    springGraceRef.current = 0;
    heldDirRef.current = null;
    facingRef.current = 'right';
    hazardHitAtRef.current = new Map();
    collapseAtRef.current = new Map();
    fallenIdsRef.current = new Set();
    setFallenIds(new Set());
    collectedItemIdsRef.current = new Set();
    setCollectedItemIds(new Set());
    speedBoostRef.current = null;
    setBoosting(false);
    lastFrameTimeRef.current = null;
    runStartTimeRef.current = null;
    maxDepthRef.current = 0;
    wordsCompletedRef.current = 0;
    usedWordIdsRef.current = new Set();

    const nextWord = pickNextTargetWord(weekWords, reinforcementWords, customWords, usedWordIdsRef.current);
    outstandingRef.current = makeLetterQueue(nextWord.word);
    const fresh = new Array(nextWord.word.length).fill(false);
    filledPositionsRef.current = fresh;

    updatePlatforms(generateRows([], 100 - FIXED_SCREEN_TOP_PCT + GENERATE_AHEAD, outstandingRef.current));
    setTarget(nextWord);
    setFilledPositions(fresh);
    setLives(START_LIVES);
    setDepth(0);
    setMaxDepth(0);
    setWordsCompletedCount(0);
    setCelebrating(false);
    celebratingRef.current = false;
    setCaughtFlash(false);
    setGameOver(false);
    setRenamed(false);
  }

  function handleRename() {
    if (!savedRecordIdRef.current) return;
    renameClimbRecord(savedRecordIdRef.current, nameInput);
    setRenamed(true);
  }

  const dirButtonClass =
    'flex h-14 w-20 items-center justify-center rounded-2xl bg-white text-2xl text-zinc-900 shadow-lg transition-colors hover:bg-zinc-100 active:bg-zinc-200 select-none';

  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-2 sm:py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/games"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <Link
            href="/games/hero-climb/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl">🪜</span>
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">小英雄下樓梯</h1>
        </div>
        <p className="hidden text-xs font-semibold tracking-wide text-zinc-400 uppercase sm:block">
          Hero Ladder Descend
        </p>
        <p className="mt-1 hidden text-sm text-zinc-300 sm:block">
          左右閃避尖刺、電動階梯、彈簧和會塌陷的階梯，收集字母拼出英文單字！路上還會出現 ❤️ 補命、💀
          扣命、⚡ 加速的道具。
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:mt-6 sm:gap-6 sm:flex-row">
          <LeaderboardPanel />

          <div className="relative flex-1 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
            <div className="flex w-full items-center justify-between text-sm font-bold text-[var(--hero-gold)]">
              <span>
                {'❤️'.repeat(Math.max(lives, 0))}
                {'🖤'.repeat(Math.max(START_LIVES - lives, 0))}
              </span>
              <span>
                🏢 深度 {depth}
                {maxDepth > 0 && <span className="ml-1.5 text-xs font-medium text-zinc-400">（最深 {maxDepth}）</span>}
              </span>
              <span>🔤 拼出 {wordsCompletedCount} 個</span>
            </div>

            {boosting && (
              <div className="mt-1.5 flex justify-center">
                <span className="animate-pulse rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                  ⚡ 加速中
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center justify-center gap-1.5">
              {target.word.toUpperCase().split('').map((ch, i) => (
                <span
                  key={i}
                  className={`flex h-9 w-8 items-center justify-center rounded-md border-2 text-lg font-extrabold ${
                    filledPositions[i]
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-zinc-500 bg-zinc-800 text-transparent'
                  }`}
                >
                  {filledPositions[i] ? ch : '?'}
                </span>
              ))}
            </div>

            <div
              className={`relative mx-auto mt-3 aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border-[6px] border-slate-400 shadow-[inset_0_0_30px_rgba(0,0,0,0.7)] sm:max-w-sm ${
                caughtFlash ? 'stage-shake' : ''
              }`}
              style={{
                background:
                  'radial-gradient(ellipse 40% 25% at 15% 15%, rgba(10,20,50,0.55) 0%, transparent 100%),' +
                  'radial-gradient(ellipse 45% 30% at 85% 35%, rgba(10,20,50,0.5) 0%, transparent 100%),' +
                  'radial-gradient(ellipse 40% 25% at 25% 70%, rgba(10,20,50,0.5) 0%, transparent 100%),' +
                  'radial-gradient(ellipse 45% 30% at 80% 85%, rgba(10,20,50,0.55) 0%, transparent 100%),' +
                  'linear-gradient(180deg, #16309e 0%, #0d2170 45%, #071349 100%)',
              }}
            >
              {/* Fixed ceiling spikes — dawdle too long and they catch you. */}
              <div
                className="pointer-events-none absolute top-0 left-0 z-10 h-6 w-full"
                style={{
                  background: ICY_SPIKE_GRADIENT,
                  clipPath: spikeClipPath(14, true),
                  filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))',
                }}
              />

              <div ref={worldRef} className="absolute inset-0" style={{ transition: 'none' }}>
                {platforms.map((p) => {
                  const collected = p.letterIndex !== undefined && filledPositions[p.letterIndex];
                  const fallen = fallenIds.has(p.id);
                  const itemCollected = p.item !== undefined && collectedItemIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="absolute transition-opacity duration-300"
                      style={{ top: `${p.y}%`, left: `${p.x}%`, width: `${p.width}%`, opacity: fallen ? 0 : 1 }}
                    >
                      <PlatformBar kind={p.kind} />
                      {p.letterIndex !== undefined && !collected && (
                        <div className="absolute left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white text-xs font-extrabold text-zinc-900 shadow-md">
                          {target.word[p.letterIndex]?.toUpperCase()}
                        </div>
                      )}
                      {p.item !== undefined && !itemCollected && (
                        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-full text-lg leading-none drop-shadow-md">
                          {p.item === 'heart' ? '❤️' : p.item === 'skull' ? '💀' : '⚡'}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  ref={heroElRef}
                  className="hero-sprite pointer-events-none absolute text-3xl drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)] sm:text-4xl"
                  style={{ top: '0%', left: '50%' }}
                >
                  <div className="hero-figure">
                    <div className="hero-arm hero-arm-left" />
                    <div className="hero-arm hero-arm-right" />
                    <div className="hero-head" />
                    <div className="hero-torso" />
                    <div className="hero-leg hero-leg-left" />
                    <div className="hero-leg hero-leg-right" />
                  </div>
                </div>
              </div>

              {celebrating && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 text-center">
                  <p className="text-lg font-bold text-[var(--hero-gold)]">🎉 拼出單字了！</p>
                  <span className="text-5xl">{target.emoji}</span>
                  <span className="text-2xl font-extrabold text-white uppercase">{target.word}</span>
                  <ZhuyinText zh={target.zh} zhuyin={target.zhuyin} className="text-lg font-bold text-white" />
                </div>
              )}

              {gameOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
                  <p className="text-2xl font-bold text-white">😵 Game Over！</p>
                  <p className="text-sm text-zinc-200">
                    下降到深度 {maxDepth}，拼出了 {wordsCompletedCount} 個單字！
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        setRenamed(false);
                      }}
                      maxLength={10}
                      placeholder="輸入名字上榜"
                      className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={handleRename}
                      className="rounded-md bg-[var(--hero-gold)] px-3 py-1 text-xs font-bold text-zinc-900"
                    >
                      {renamed ? '已更新 ✓' : '更新名字'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-2 rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
                  >
                    再試一次
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-6" style={{ touchAction: 'none' }}>
              <button
                type="button"
                onPointerDown={() => startHold('left')}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                className={dirButtonClass}
                aria-label="向左"
              >
                ⬅️
              </button>
              <button
                type="button"
                onPointerDown={() => startHold('right')}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                className={dirButtonClass}
                aria-label="向右"
              >
                ➡️
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
