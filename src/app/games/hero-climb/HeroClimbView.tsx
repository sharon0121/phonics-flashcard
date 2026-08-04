'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Word } from '@/lib/types';
import {
  useThisWeekClimbWords,
  useReinforcementClimbWords,
  usePhonicsClimbWords,
  useSightWordsClimb,
  useWordSources,
  useSpeechRate,
  SPEECH_RATE_VALUES,
  useStartDifficulty,
  START_DIFFICULTY_VALUES,
  type WordSourceKey,
} from '@/lib/heroClimbSettings';
import { persistUsedWordIds, clearUsedWordIds, useReviewWordIds, removeReviewWordId } from '@/lib/heroClimbUsedWords';
import { useCustomWords } from '@/lib/customWords';
import {
  generateRows,
  pruneRows,
  makeLetterQueue,
  pickNextWordWithReview,
  makeReviewPickState,
  ROW_SPACING,
  type Platform,
  type ReviewPickState,
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
import HeroClimbSpellPhase from './HeroClimbSpellPhase';
import LeaderboardPanel from './LeaderboardPanel';

const START_LIVES = 5;
const SPEED_BOOST_MS = 10000; // how long a speed-boost pickup lasts
const SPEED_BOOST_MULTIPLIER = 1.8; // ceiling scroll multiplied by this when speed-boost is active (1.8 × 1.8 = ×3.24 max)
const BOOST_EASE_RATE = 3; // per second — how fast the scroll multiplier eases toward its target (higher = snappier)
const FIXED_SCREEN_TOP_PCT = 3; // where the visible window's top edge sits, in world-relative-to-camera terms
const CHAR_HALF_WIDTH = 5; // percent, for horizontal collision
const PICKUP_CENTER_TOLERANCE = 2; // percent — how close to a platform's centre the hero must be to collect its letter/item
const FALL_SPEED = 32; // world units per second while actively falling
const MOVE_SPEED = 62; // percent of stage width per second
const GENERATE_AHEAD = 60; // keep platforms generated this far below the visible bottom
const PRUNE_BEHIND = 40; // drop platforms once they're this far above the visible top
const CELEBRATION_MS = 1800;
const CONVEYOR_SPEED = 26; // percent of stage width per second, added on top of player input
const COLLAPSE_DELAY_MS = 250; // how long a collapsing step holds before giving way
const SPRING_BOOST = 14; // total world units risen over the spring bounce
const SPRING_RISE_MS = 200; // how long the bounce arc takes to play out

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

// Speed increases every DIFFICULTY_WORDS_PER_TIER words completed, stepping
// up by DIFFICULTY_STEP each tier until DIFFICULTY_MAX_MULTIPLIER is reached.
// Tier 0 (0–4 words): ×1.0 → Tier 1 (5–9): ×1.2 → Tier 2 (10–14): ×1.4
// → Tier 3 (15–19): ×1.6 → Tier 4+ (20+): ×1.8 (capped).
const DIFFICULTY_MAX_MULTIPLIER = 1.8;
const DIFFICULTY_WORDS_PER_TIER = 5;
const DIFFICULTY_STEP = 0.2;

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

interface WordPoolInputs {
  weekWords: Word[];
  reinforcementWords: Word[];
  customWords: Word[];
  phonicsWords: Word[];
  sightWords: Word[];
}

// Priority order the target word is drawn from — curated pools first, the
// two big general banks last — independent of the order the settings
// checklist displays them in. Only pools whose source is enabled are
// included at all.
const WORD_POOL_PRIORITY: Array<{ key: WordSourceKey; pick: (p: WordPoolInputs) => Word[] }> = [
  { key: 'thisWeek', pick: (p) => p.weekWords },
  { key: 'reinforcement', pick: (p) => p.reinforcementWords },
  { key: 'custom', pick: (p) => p.customWords },
  { key: 'phonics', pick: (p) => p.phonicsWords },
  { key: 'sightWords', pick: (p) => p.sightWords },
];

function buildWordPools(sources: WordSourceKey[], inputs: WordPoolInputs): Word[][] {
  return WORD_POOL_PRIORITY.filter((tier) => sources.includes(tier.key)).map((tier) => tier.pick(inputs));
}

interface LatestRefs {
  target: Word;
  filledPositions: boolean[];
  wordPools: Word[][];
  reviewPool: Word[];
  speechRateValue: number;
}

export default function HeroClimbView() {
  const weekWords = useThisWeekClimbWords();
  const reinforcementWords = useReinforcementClimbWords();
  const customWords = useCustomWords();
  const phonicsWords = usePhonicsClimbWords();
  const sightWords = useSightWordsClimb();
  const wordSources = useWordSources();
  const speechRate = useSpeechRate();
  const startDifficulty = useStartDifficulty();
  const lastPlayerName = useLastPlayerName();
  const reviewIds = useReviewWordIds();

  const wordPools = buildWordPools(wordSources, { weekWords, reinforcementWords, customWords, phonicsWords, sightWords });
  // Words the player explicitly unchecked in settings to see again — pulled
  // from the full word universe regardless of which sources are enabled,
  // since asking to review a word is a more specific signal than the
  // general source toggles.
  const reviewPool = [...phonicsWords, ...sightWords, ...customWords].filter((w) => reviewIds.has(w.id));

  const usedWordIdsRef = useRef(new Set<string>());
  const reviewStateRef = useRef<ReviewPickState>(makeReviewPickState());
  const initialFromReviewRef = useRef(false);
  const [target, setTarget] = useState<Word>(() => {
    const result = pickNextWordWithReview(wordPools, usedWordIdsRef.current, reviewPool, reviewStateRef.current);
    reviewStateRef.current = result.state;
    initialFromReviewRef.current = result.fromReview;
    return result.word;
  });
  // Used-words reset every time a fresh game starts (mount) rather than
  // persisting across sessions — a word "already asked" in a previous play
  // session should be free to come up again the next time the game is
  // opened, not stay excluded until the entire pool has been exhausted
  // across every session ever played.
  useEffect(() => {
    clearUsedWordIds();
    usedWordIdsRef.current = new Set();
    if (initialFromReviewRef.current) removeReviewWordId(target.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Within a "celebrating" pause: false = still spelling the word from the
  // shuffled letters, true = spelling solved, showing the reveal+narration.
  const [spellSolved, setSpellSolved] = useState(false);
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
  const latestRef = useRef<LatestRefs>({ target, filledPositions, wordPools, reviewPool, speechRateValue: SPEECH_RATE_VALUES[speechRate] });
  useEffect(() => {
    latestRef.current = { target, filledPositions, wordPools, reviewPool, speechRateValue: SPEECH_RATE_VALUES[speechRate] };
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
  const hitSpikeIdsRef = useRef<Set<string>>(new Set());
  const collapseAtRef = useRef<Map<string, number>>(new Map());
  const fallenIdsRef = useRef<Set<string>>(new Set());
  const [fallenIds, setFallenIds] = useState<Set<string>>(new Set());
  const collectedItemIdsRef = useRef<Set<string>>(new Set());
  const [collectedItemIds, setCollectedItemIds] = useState<Set<string>>(new Set());
  const speedBoostRef = useRef<{ remainingMs: number } | null>(null);
  // Eased toward 1 (normal) or SPEED_BOOST_MULTIPLIER (boosted) each frame
  // rather than snapping instantly — an instant multiplier jump makes the
  // ceiling's scroll speed (and therefore everything on screen) visibly
  // jerk the moment a ⚡ is picked up and again when it wears off.
  const boostFactorRef = useRef(1);
  const [boosting, setBoosting] = useState(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const runStartTimeRef = useRef<number | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [runKey, setRunKey] = useState(0);
  const startDifficultyRef = useRef(START_DIFFICULTY_VALUES[startDifficulty]);
  useEffect(() => {
    startDifficultyRef.current = START_DIFFICULTY_VALUES[startDifficulty];
  }, [startDifficulty]);

  const worldRef = useRef<HTMLDivElement>(null);
  const heroElRef = useRef<HTMLDivElement>(null);

  // Measures the gold-bordered game panel's real rendered height so the
  // leaderboard sidebar next to it can match it exactly instead of growing
  // however tall its own row count happens to make it.
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const [gamePanelHeight, setGamePanelHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = gamePanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setGamePanelHeight(Math.round(height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // All letters collected on the ladder — pause the fall and show the
  // spelling puzzle first (word-vault-style: letters reshuffled, spell from
  // memory/by ear). The reveal + narration + advance-to-next-word flow that
  // used to run immediately now runs once the puzzle is actually solved.
  const completeWord = useCallback(() => {
    celebratingRef.current = true;
    setCelebrating(true);
    setSpellSolved(false);
    wordsCompletedRef.current += 1;
    setWordsCompletedCount(wordsCompletedRef.current);
  }, []);

  const handleSpellSolved = useCallback(() => {
    setSpellSolved(true);
    playCelebrationChime();

    // Called once all speech finishes (or immediately if speech is unavailable).
    // The `done` flag prevents double-firing when the safety timer and onend race.
    let done = false;
    function advanceToNextWord() {
      if (done) return;
      done = true;
      const result = pickNextWordWithReview(
        latestRef.current.wordPools,
        usedWordIdsRef.current,
        latestRef.current.reviewPool,
        reviewStateRef.current,
      );
      reviewStateRef.current = result.state;
      if (result.fromReview) removeReviewWordId(result.word.id);
      const nextWord = result.word;
      persistUsedWordIds(usedWordIdsRef.current);
      setTarget(nextWord);
      outstandingRef.current = makeLetterQueue(nextWord.word);
      const fresh = new Array(nextWord.word.length).fill(false);
      filledPositionsRef.current = fresh;
      setFilledPositions(fresh);
      celebratingRef.current = false;
      setCelebrating(false);
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const { word, zh, sentence, sentenceZh } = latestRef.current.target;
      const rate = latestRef.current.speechRateValue;
      // Sequence: English word → Chinese → English sentence → Chinese sentence
      const steps: Array<{ text: string; lang: string }> = [
        { text: word, lang: 'en-US' },
        { text: zh, lang: 'zh-TW' },
        ...(sentence ? [{ text: sentence, lang: 'en-US' }] : []),
        ...(sentenceZh ? [{ text: sentenceZh, lang: 'zh-TW' }] : []),
      ];
      function speakNext(i: number) {
        if (i >= steps.length) {
          setTimeout(advanceToNextWord, 600);
          return;
        }
        const u = new SpeechSynthesisUtterance(steps[i].text);
        u.lang = steps[i].lang;
        u.rate = rate;
        u.onend = () => setTimeout(() => speakNext(i + 1), 400);
        window.speechSynthesis.speak(u);
      }
      window.speechSynthesis.cancel();
      setTimeout(() => speakNext(0), 50);
      // Safety: if the speech chain stalls (can happen on some browsers),
      // advance after 15 s so the game never gets stuck.
      setTimeout(advanceToNextWord, 15000);
    } else {
      setTimeout(advanceToNextWord, CELEBRATION_MS);
    }
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
    if (gameOver || paused) return;
    let rafId: number;

    function tick(now: number) {
      if (lastFrameTimeRef.current == null) lastFrameTimeRef.current = now;
      if (runStartTimeRef.current == null) runStartTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      if (!celebratingRef.current) {
        // Speed tier advances every DIFFICULTY_WORDS_PER_TIER words completed.
        const tier = Math.floor(wordsCompletedRef.current / DIFFICULTY_WORDS_PER_TIER);
        const difficulty = Math.min(DIFFICULTY_MAX_MULTIPLIER, startDifficultyRef.current + tier * DIFFICULTY_STEP);

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

        // Use a tighter 2% margin for "stay on platform" so the hero falls off
        // as soon as their centre clears the edge, not after travelling 5% past it.
        const stillOn = (p: Platform) =>
          charXRef.current + 2 > p.x && charXRef.current - 2 < p.x + p.width;
        if (restingOnRef.current && !stillOn(restingOnRef.current)) {
          restingOnRef.current = null;
        }

        const triggerHazardOnce = (p: Platform) => {
          if (!hitSpikeIdsRef.current.has(p.id)) {
            hitSpikeIdsRef.current.add(p.id);
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
            .filter((p) => p.y > charYRef.current && p.y <= nextY && overlapsX(p))
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
        // Letters and items alike are only triggered once the hero's centre
        // is within PICKUP_CENTER_TOLERANCE of the platform's own centre —
        // so walking past the edge of a platform never accidentally picks up
        // a letter, skull, or heart just from resting somewhere near it.
        const centredOnStanding =
          !!standing && Math.abs(charXRef.current - (standing.x + standing.width / 2)) < PICKUP_CENTER_TOLERANCE;
        if (
          standing &&
          centredOnStanding &&
          standing.letterIndex !== undefined &&
          !latestRef.current.filledPositions[standing.letterIndex]
        ) {
          collectLetter(standing.letterIndex);
        }
        if (standing && centredOnStanding && standing.item !== undefined && !collectedItemIdsRef.current.has(standing.id)) {
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
        // Ease toward the target boost factor instead of snapping to it —
        // smooths out both the pickup and the wear-off transition.
        const targetBoostFactor = speedBoostRef.current ? SPEED_BOOST_MULTIPLIER : 1;
        boostFactorRef.current += (targetBoostFactor - boostFactorRef.current) * Math.min(1, BOOST_EASE_RATE * dt);
        const scrollMultiplier = difficulty * boostFactorRef.current;

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
  }, [gameOver, paused, runKey, loseLife, collectLetter, collectItem]);

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
    hitSpikeIdsRef.current = new Set();
    collapseAtRef.current = new Map();
    fallenIdsRef.current = new Set();
    setFallenIds(new Set());
    collectedItemIdsRef.current = new Set();
    setCollectedItemIds(new Set());
    speedBoostRef.current = null;
    boostFactorRef.current = 1;
    setBoosting(false);
    lastFrameTimeRef.current = null;
    runStartTimeRef.current = null;
    maxDepthRef.current = 0;
    wordsCompletedRef.current = 0;
    clearUsedWordIds();
    usedWordIdsRef.current = new Set();
    reviewStateRef.current = makeReviewPickState();

    const result = pickNextWordWithReview(wordPools, usedWordIdsRef.current, reviewPool, reviewStateRef.current);
    reviewStateRef.current = result.state;
    if (result.fromReview) removeReviewWordId(result.word.id);
    const nextWord = result.word;
    persistUsedWordIds(usedWordIdsRef.current);
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
    setSpellSolved(false);
    setCaughtFlash(false);
    pausedRef.current = false;
    setPaused(false);
    setGameOver(false);
    setRunKey((k) => k + 1);
    setRenamed(false);
  }

  function togglePause() {
    if (gameOver || celebratingRef.current) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
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
          <LeaderboardPanel matchHeight={gamePanelHeight} />

          <div
            ref={gamePanelRef}
            className="relative flex-1 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4"
          >
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
              {!gameOver && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={togglePause}
                    aria-label={paused ? '繼續' : '暫停'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-base hover:bg-white/25"
                  >
                    {paused ? '▶' : '⏸'}
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    aria-label="重新開始"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-base hover:bg-white/25"
                  >
                    🔄
                  </button>
                </div>
              )}
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
                      className="absolute transition-opacity duration-150"
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

              {paused && !gameOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/80">
                  <p className="text-2xl font-bold text-white">⏸ 遊戲暫停</p>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="rounded-xl bg-[var(--hero-gold)] px-6 py-2.5 text-base font-bold text-zinc-900 shadow hover:brightness-110"
                  >
                    ▶ 繼續遊戲
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-xl bg-zinc-600 px-6 py-2.5 text-base font-bold text-white shadow hover:bg-zinc-500"
                  >
                    🔄 重新開始
                  </button>
                </div>
              )}

              {celebrating && !spellSolved && (
                <HeroClimbSpellPhase
                  key={target.word}
                  word={target.word.toUpperCase()}
                  zh={target.zh}
                  zhuyin={target.zhuyin}
                  emoji={target.emoji}
                  speechRate={SPEECH_RATE_VALUES[speechRate]}
                  onSolved={handleSpellSolved}
                />
              )}

              {celebrating && spellSolved && (
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
