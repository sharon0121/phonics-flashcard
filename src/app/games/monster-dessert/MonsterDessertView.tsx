'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ladderTierValue } from '@/lib/heroClimbSettings';
import { useMonsterDessertSettings, type DifficultyStage } from '@/lib/monsterDessertSettings';
import { useMonsterDessertProgress, recordMonsterDessertRound } from '@/lib/monsterDessertProgress';
import { playCelebrationChime, playCollectSound, playErrorSound, playDingSound } from '@/lib/sound';

// ── Desserts (placeholder art — swap for generated images later) ──────────
const DESSERTS = [
  { key: 'cookie', emoji: '🍪', name: '餅乾', nameEn: 'Cookie' },
  { key: 'cupcake', emoji: '🧁', name: '杯子蛋糕', nameEn: 'Cupcake' },
  { key: 'donut', emoji: '🍩', name: '甜甜圈', nameEn: 'Donut' },
  { key: 'cake', emoji: '🍰', name: '蛋糕', nameEn: 'Cake' },
  { key: 'lollipop', emoji: '🍭', name: '棒棒糖', nameEn: 'Lollipop' },
  { key: 'chocolate', emoji: '🍫', name: '巧克力', nameEn: 'Chocolate' },
] as const;
type DessertKey = (typeof DESSERTS)[number]['key'];
const DESSERT_EMOJI: Record<DessertKey, string> = Object.fromEntries(
  DESSERTS.map((d) => [d.key, d.emoji]),
) as Record<DessertKey, string>;
const DESSERT_NAME_EN: Record<DessertKey, string> = Object.fromEntries(
  DESSERTS.map((d) => [d.key, d.nameEn]),
) as Record<DessertKey, string>;
const DESSERT_NAME_ZH: Record<DessertKey, string> = Object.fromEntries(
  DESSERTS.map((d) => [d.key, d.name]),
) as Record<DessertKey, string>;

type MonsterType = 'normal' | 'impatient' | 'picky' | 'boss';
type Mode = 'basic' | 'advanced';
// How the round ends once the plates are built — 'count' asks "how many
// total?"; 'equation' shows the ×-sentence with the answer blanked out.
// Only meaningful when mode === 'basic' (advanced always skips straight to
// the equation reveal once Ready's sum-check passes).
type ResponseType = 'count' | 'equation';
type Phase = 'building' | 'counting' | 'equation';

interface PlacedItem { id: number; dessert: DessertKey; x: number; y: number; }
interface DirtySpot { id: number; x: number; y: number; }

// Each monster type has one or more art variants; a round picks one at
// random. Files live at /monster-dessert/<variant>-<happy|sad|urgent>.png.
const MONSTER_ART: Record<MonsterType, string[]> = {
  normal: ['monster-normal'],
  impatient: ['monster-impatient-rabbit', 'monster-impatient-squirrel'],
  picky: ['monster-picky-cat', 'monster-picky-pig'],
  boss: ['monster-boss'],
};
const CONFETTI_EMOJI = ['🎉', '✨', '⭐', '🍬', '🎊'];
const BOSS_PAIRS: [number, number][] = [
  [2, 3],
  [3, 4],
  [4, 5],
];

interface RoundSpec {
  monsterType: MonsterType;
  monsterVariant: string;
  mode: Mode;
  responseType: ResponseType;
  plates: number;
  perPlate: number;
  total: number;
  timeLimitSec: number;
  bossStage: number | null;
  targetDessert: DessertKey;
  requestParts: RequestPart[];
  requestText: string;
  requestGlossZh: string;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
// Distance-based hit test in percent-space — used for both "tap an existing
// item to remove it" and "tap a dirty spot to wipe it".
function findNear<T extends { x: number; y: number }>(list: T[], x: number, y: number, radius = 10): T | undefined {
  return list.find((p) => Math.hypot(p.x - x, p.y - y) <= radius);
}
// Keeps a clicked point inside the plate's visible circle so items never sit
// off the rim, regardless of where inside the square hit-area was clicked.
function clampToCircle(xPct: number, yPct: number, radius = 38, center = 50): { x: number; y: number } {
  const dx = xPct - center;
  const dy = yPct - center;
  const dist = Math.hypot(dx, dy);
  if (dist > radius) {
    const scale = radius / dist;
    return { x: center + dx * scale, y: center + dy * scale };
  }
  return { x: xPct, y: yPct };
}
// Evenly spreads n items around a ring so auto-fill / clones look tidy.
function autoLayoutPositions(n: number): { x: number; y: number }[] {
  if (n <= 1) return [{ x: 50, y: 50 }];
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI;
    return { x: 50 + 28 * Math.cos(angle), y: 50 + 28 * Math.sin(angle) };
  });
}

interface RequestPart { text: string; highlight?: boolean; }

// Breaks the English request into segments so the key numbers/quantities can
// be rendered bigger + in an eye-catching color, while the connective words
// stay normal size.
function buildRequestParts(
  monsterType: MonsterType,
  mode: Mode,
  plates: number,
  perPlate: number,
  total: number,
  bossStage: number | null,
  dessertNameEn: string,
): RequestPart[] {
  const pluralEn = `${dessertNameEn}s`;
  const perPlatePart: RequestPart = { text: `${perPlate} ${pluralEn}`, highlight: true };
  const platesPart: RequestPart = { text: `${plates} plates`, highlight: true };
  const totalPart: RequestPart = { text: `${total} ${pluralEn}`, highlight: true };

  if (monsterType === 'boss') {
    return [
      { text: `[BOSS Round ${bossStage}/3] Each plate needs ` },
      perPlatePart,
      { text: '! I want ' },
      platesPart,
      { text: '! Feed me more!' },
    ];
  }
  if (monsterType === 'impatient') {
    return [
      { text: 'Quick, quick! Each plate needs ' },
      perPlatePart,
      { text: '! I want ' },
      platesPart,
      { text: '! Hurry!' },
    ];
  }
  if (monsterType === 'picky') {
    return [
      { text: 'This plate is dirty! Clean it first! Each plate needs ' },
      perPlatePart,
      { text: '! I want ' },
      platesPart,
      { text: '!' },
    ];
  }
  if (mode === 'advanced') {
    return [
      { text: 'I want ' },
      totalPart,
      { text: ', split into ' },
      platesPart,
      { text: '! How many on each plate?' },
    ];
  }
  return [
    { text: 'Each plate needs ' },
    perPlatePart,
    { text: '! I want ' },
    platesPart,
    { text: '!' },
  ];
}

function buildRequestGlossZh(
  monsterType: MonsterType,
  mode: Mode,
  plates: number,
  perPlate: number,
  total: number,
  bossStage: number | null,
  dessertNameZh: string,
): string {
  if (monsterType === 'boss') return `（大胃王 BOSS 第 ${bossStage}／3 關：每盤 ${perPlate} 個 ${dessertNameZh}，共 ${plates} 盤）`;
  if (monsterType === 'impatient') return `（急躁小怪：每盤 ${perPlate} 個 ${dessertNameZh}，共 ${plates} 盤，動作快！）`;
  if (monsterType === 'picky') return `（挑食怪獸：先擦乾淨盤子！每盤 ${perPlate} 個 ${dessertNameZh}，共 ${plates} 盤）`;
  if (mode === 'advanced') return `（想要 ${total} 個 ${dessertNameZh}，分成 ${plates} 個盤子，每盤要放幾個呢？）`;
  return `（每盤 ${perPlate} 個 ${dessertNameZh}，共 ${plates} 盤）`;
}

function generateRound(maxFactor: number, stage: DifficultyStage, monsterType: MonsterType, bossStage: number | null): RoundSpec {
  let plates: number;
  let perPlate: number;
  let mode: Mode = 'basic';
  let responseType: ResponseType = 'count';
  let timeLimitSec: number;

  if (monsterType === 'boss') {
    const bStage = bossStage ?? 1;
    [plates, perPlate] = BOSS_PAIRS[bStage - 1];
    timeLimitSec = 22;
  } else if (monsterType === 'impatient') {
    plates = randInt(2, 3);
    perPlate = randInt(2, 3);
    timeLimitSec = 6;
  } else if (monsterType === 'picky') {
    plates = randInt(2, maxFactor);
    perPlate = randInt(2, maxFactor);
    timeLimitSec = 26;
  } else {
    // Special monsters always keep the concrete "given both, count the
    // total" format regardless of stage — their own mechanic (speed /
    // obstacle / boss-chain) is already the added challenge. Only the
    // "normal" monster follows the parent-selected difficulty stage.
    plates = randInt(2, maxFactor);
    perPlate = randInt(2, maxFactor);
    if (stage === 2) { mode = 'basic'; responseType = 'equation'; }
    else if (stage === 3) { mode = 'advanced'; responseType = 'count'; }
    else { mode = 'basic'; responseType = 'count'; }
    timeLimitSec = mode === 'advanced' ? 30 : 20;
  }

  const total = plates * perPlate;
  const targetDessert = pick(DESSERTS).key;
  const requestParts = buildRequestParts(monsterType, mode, plates, perPlate, total, bossStage ?? 1, DESSERT_NAME_EN[targetDessert]);
  return {
    monsterType,
    monsterVariant: pick(MONSTER_ART[monsterType]),
    mode,
    responseType,
    plates,
    perPlate,
    total,
    timeLimitSec,
    bossStage: monsterType === 'boss' ? (bossStage ?? 1) : null,
    targetDessert,
    requestParts,
    requestText: requestParts.map((p) => p.text).join(''),
    requestGlossZh: buildRequestGlossZh(monsterType, mode, plates, perPlate, total, bossStage ?? 1, DESSERT_NAME_ZH[targetDessert]),
  };
}

function pickMonsterType(variety: Record<'impatient' | 'picky' | 'boss', boolean>): MonsterType {
  const roll = Math.random();
  if (variety.boss && roll < 0.08) return 'boss';
  if (variety.picky && roll < 0.2) return 'picky';
  if (variety.impatient && roll < 0.35) return 'impatient';
  return 'normal';
}

function buildCountingChoices(correct: number): number[] {
  const values = new Set<number>([correct]);
  let guard = 0;
  while (values.size < 3 && guard < 30) {
    guard++;
    const delta = randInt(1, 4) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = correct + delta;
    if (candidate > 0 && candidate !== correct) values.add(candidate);
  }
  return shuffle(Array.from(values));
}

function speak(text: string, lang: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.speak(u), 50);
}

function makeInitialDirtySpots(round: RoundSpec): DirtySpot[] {
  if (round.monsterType !== 'picky') return [];
  const count = round.perPlate >= 3 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(1, count)) * 2 * Math.PI + 1;
    return { id: i, x: 50 + 22 * Math.cos(angle), y: 50 + 22 * Math.sin(angle) };
  });
}

// A tappable (or purely decorative) round plate. Items and dirty spots are
// drawn at their exact stored (x%, y%), so a cloned plate — same items array
// — renders pixel-identical to its source.
function PlateCanvas({
  items,
  dirtySpots = [],
  onPointAt,
  sizeClass = 'h-32 w-32',
  shake = false,
}: {
  items: PlacedItem[];
  dirtySpots?: DirtySpot[];
  onPointAt?: (x: number, y: number) => void;
  sizeClass?: string;
  shake?: boolean;
}) {
  return (
    <div
      onClick={
        onPointAt
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const rawX = ((e.clientX - rect.left) / rect.width) * 100;
              const rawY = ((e.clientY - rect.top) / rect.height) * 100;
              const { x, y } = clampToCircle(rawX, rawY);
              onPointAt(x, y);
            }
          : undefined
      }
      className={`relative shrink-0 rounded-full border-2 border-dashed border-zinc-300 bg-white ${sizeClass} ${shake ? 'cell-shake' : ''} ${onPointAt ? 'cursor-pointer' : ''}`}
    >
      {dirtySpots.map((d) => (
        <span key={`dirty-${d.id}`} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, transform: 'translate(-50%,-50%)' }} className="text-2xl">
          🪳
        </span>
      ))}
      {items.map((it) => (
        // Centering (translate -50%,-50%) lives on this outer span and is never
        // animated. cell-pop's scale animation lives on the inner span instead —
        // both target `transform`, so on one shared element the animation would
        // briefly override the centering translate and the item would visibly
        // snap into place once the animation ended.
        <span key={it.id} style={{ position: 'absolute', left: `${it.x}%`, top: `${it.y}%`, transform: 'translate(-50%,-50%)' }}>
          <span className="cell-pop block text-2xl">{DESSERT_EMOJI[it.dessert]}</span>
        </span>
      ))}
    </div>
  );
}

// Single fixed-size "arcade cabinet" frame — mirrors 分數披薩大廚's GameFrame so
// every zone (header / customer / work area / actions) reads as one screen
// instead of a stack of separate cards.
function GameFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center bg-[#0b1130] p-4" style={{ minHeight: 'calc(100vh - 56px)' }}>
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl bg-[#f0f9ff]"
        style={{
          width: '960px',
          height: '640px',
          flexShrink: 0,
          border: '3px solid #0ea5e9',
          boxShadow: '0 0 50px rgba(236,72,153,0.3),0 0 0 1px rgba(236,72,153,0.15)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const backArrow = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
  </svg>
);

export default function MonsterDessertView() {
  const { maxFactorTiers, difficultyStage, monsterVariety } = useMonsterDessertSettings();
  const progress = useMonsterDessertProgress();

  const [streak, setStreak] = useState(0);
  const bossStageRef = useRef<number | null>(null);
  const idCounterRef = useRef(0);
  function nextId(): number {
    idCounterRef.current += 1;
    return idCounterRef.current;
  }

  const [round, setRound] = useState<RoundSpec>(() => {
    const sorted = [...maxFactorTiers].sort((a, b) => a - b);
    const maxFactor = ladderTierValue(sorted, 0);
    return generateRound(maxFactor, difficultyStage, pickMonsterType(monsterVariety), null);
  });

  const isBasic = round.mode === 'basic';

  const [phase, setPhase] = useState<Phase>('building');
  const [selectedDessert, setSelectedDessert] = useState<DessertKey>('cookie');

  // Basic mode: one editable "first plate", finalized then cloned into `plates`.
  const [firstPlateItems, setFirstPlateItems] = useState<PlacedItem[]>([]);
  const [dirtySpots, setDirtySpots] = useState<DirtySpot[]>(() => makeInitialDirtySpots(round));
  const [firstPlateFinalized, setFirstPlateFinalized] = useState(false);
  const [wipeMode, setWipeMode] = useState(false);
  const [firstPlateShake, setFirstPlateShake] = useState(false);

  // Advanced mode: `round.plates` independently-editable plates from the start.
  const [advancedShakeIdx, setAdvancedShakeIdx] = useState<number | null>(null);

  // Shared "table": basic mode's clones, or advanced mode's independent plates.
  const [plates, setPlates] = useState<PlacedItem[][]>(() =>
    round.mode === 'advanced' ? Array.from({ length: round.plates }, () => []) : [],
  );
  const [mismatch, setMismatch] = useState<string | null>(null);

  const [secsLeft, setSecsLeft] = useState(round.timeLimitSec);
  const [freezeUsesLeft, setFreezeUsesLeft] = useState(3);
  const [freezeFlash, setFreezeFlash] = useState(false);
  const [autoStampUsesLeft, setAutoStampUsesLeft] = useState(2);

  const [countingChoices, setCountingChoices] = useState<number[]>([]);
  const [countingWrongFlash, setCountingWrongFlash] = useState(false);

  const [comboPerfectStreak, setComboPerfectStreak] = useState(0);
  const [partyModeActive, setPartyModeActive] = useState(false);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [monsterMood, setMonsterMood] = useState<'idle' | 'happy' | 'sad'>('idle');
  const [equationInfo, setEquationInfo] = useState<{ perPlateCounts: number[]; total: number; coins: number } | null>(null);

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const deadlineRef = useRef(0);
  const phaseRef = useRef<Phase>('building');
  const rafRef = useRef(0);
  const handleTimeoutRef = useRef<() => void>(() => {});

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Speak the monster's request (in English) whenever a fresh round loads.
  useEffect(() => { speak(round.requestText, 'en-US'); }, [round]);

  function loadNextRound() {
    const sorted = [...maxFactorTiers].sort((a, b) => a - b);
    const maxFactor = ladderTierValue(sorted, streak);
    const monsterType: MonsterType = bossStageRef.current != null ? 'boss' : pickMonsterType(monsterVariety);
    const nextRound = generateRound(maxFactor, difficultyStage, monsterType, bossStageRef.current);
    setRound(nextRound);
    setPhase('building');
    setFirstPlateItems([]);
    setDirtySpots(makeInitialDirtySpots(nextRound));
    setFirstPlateFinalized(false);
    setWipeMode(false);
    setPlates(nextRound.mode === 'advanced' ? Array.from({ length: nextRound.plates }, () => []) : []);
    setMismatch(null);
    setCountingChoices([]);
    setMonsterMood('idle');
    setEquationInfo(null);
  }

  // Shared "wrong" ending — used for timeouts and for building the wrong
  // number of plates. Resets streak/combo/boss-chain, shows why it was
  // wrong, then moves on to the next customer.
  function failRound(message: string) {
    setStreak(0);
    setComboPerfectStreak(0);
    setPartyModeActive(false);
    bossStageRef.current = null;
    setMonsterMood('sad');
    playErrorSound();
    setBanner({ text: message, key: performance.now() });
    setTimeout(() => { setBanner(null); loadNextRound(); }, 2600);
  }

  function handleTimeout() {
    failRound(`Time's up! ${round.plates} × ${round.perPlate} = ${round.total}`);
  }
  useEffect(() => { handleTimeoutRef.current = handleTimeout; });

  // Countdown loop — rAF-driven, only re-renders when the displayed integer
  // changes, and fully skips ticking while paused.
  useEffect(() => {
    deadlineRef.current = performance.now() + round.timeLimitSec * 1000;
    setSecsLeft(round.timeLimitSec);
    let lastDisplayed = round.timeLimitSec;
    let timedOut = false;
    function tick() {
      const now = performance.now();
      if ((phaseRef.current === 'building' || phaseRef.current === 'counting') && !timedOut && !pausedRef.current) {
        const remainingMs = deadlineRef.current - now;
        const sec = Math.max(0, Math.ceil(remainingMs / 1000));
        if (sec !== lastDisplayed) { lastDisplayed = sec; setSecsLeft(sec); }
        if (remainingMs <= 0) {
          timedOut = true;
          handleTimeoutRef.current();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [round]);

  function togglePause() {
    if (paused) {
      if (pausedAtRef.current != null) {
        deadlineRef.current += performance.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      setPaused(false);
    } else {
      pausedAtRef.current = performance.now();
      setPaused(true);
    }
  }

  function triggerFirstPlateShake() {
    setFirstPlateShake(true);
    setTimeout(() => setFirstPlateShake(false), 400);
  }
  function triggerAdvancedShake(idx: number) {
    setAdvancedShakeIdx(idx);
    setTimeout(() => setAdvancedShakeIdx((v) => (v === idx ? null : v)), 400);
  }

  // Basic mode: tap the single editable plate to place/remove an item, or to
  // wipe a dirty spot (only while wipe mode is armed).
  function handleFirstPlatePoint(x: number, y: number) {
    if (firstPlateFinalized) return;
    const dirtyHit = findNear(dirtySpots, x, y);
    if (dirtyHit) {
      if (!wipeMode) { triggerFirstPlateShake(); return; }
      setDirtySpots((prev) => prev.filter((d) => d.id !== dirtyHit.id));
      setWipeMode(false);
      playDingSound();
      return;
    }
    if (wipeMode) { setWipeMode(false); return; }
    const itemHit = findNear(firstPlateItems, x, y);
    if (itemHit) {
      setFirstPlateItems((prev) => prev.filter((it) => it.id !== itemHit.id));
      return;
    }
    if (firstPlateItems.length >= round.perPlate) { triggerFirstPlateShake(); return; }
    if (selectedDessert !== round.targetDessert) { triggerFirstPlateShake(); playErrorSound(); return; }
    setFirstPlateItems((prev) => [...prev, { id: nextId(), dessert: selectedDessert, x, y }]);
    playCollectSound();
  }

  // Advanced mode: every plate on the table is independently tappable.
  function handleAdvancedPlatePoint(plateIdx: number, x: number, y: number) {
    const items = plates[plateIdx] ?? [];
    const itemHit = findNear(items, x, y);
    if (itemHit) {
      setPlates((prev) => prev.map((p, i) => (i === plateIdx ? p.filter((it) => it.id !== itemHit.id) : p)));
      return;
    }
    if (items.length >= 9) { triggerAdvancedShake(plateIdx); return; }
    if (selectedDessert !== round.targetDessert) { triggerAdvancedShake(plateIdx); playErrorSound(); return; }
    setPlates((prev) => prev.map((p, i) => (i === plateIdx ? [...p, { id: nextId(), dessert: selectedDessert, x, y }] : p)));
    playCollectSound();
  }

  const firstPlateReady = firstPlateItems.length === round.perPlate && dirtySpots.length === 0;

  function finalizeFirstPlate() {
    if (!firstPlateReady) return;
    setFirstPlateFinalized(true);
    setPlates([firstPlateItems.map((it) => ({ ...it }))]);
    playDingSound();
  }

  function useWand() {
    if (!firstPlateFinalized) return;
    if (plates.length >= 10) return;
    setPlates((prev) => [...prev, firstPlateItems.map((it) => ({ ...it }))]);
    playCollectSound();
  }

  function removeLastPlate() {
    if (plates.length > 1) setPlates((prev) => prev.slice(0, -1));
  }

  function redesignFirstPlate() {
    setFirstPlateFinalized(false);
    setPlates([]);
    setMismatch(null);
    setFirstPlateItems([]);
    setDirtySpots(makeInitialDirtySpots(round));
  }

  function enterCounting(finalPlates: PlacedItem[][]) {
    const correct = finalPlates.reduce((sum, p) => sum + p.length, 0);
    setCountingChoices(buildCountingChoices(correct));
    setPhase('counting');
  }

  function handleReadyBasic() {
    if (plates.length !== round.plates) {
      failRound(`Not quite! The monster asked for ${round.plates} plates, but you made ${plates.length}.`);
      return;
    }
    enterCounting(plates);
  }

  function handleReadyAdvanced() {
    const attemptedTotal = plates.reduce((sum, p) => sum + p.length, 0);
    if (attemptedTotal !== round.total) {
      setMismatch(`Right now you have ${attemptedTotal}, but the monster wants ${round.total}. Try adjusting a plate!`);
      playErrorSound();
      return;
    }
    setMismatch(null);
    finalizeRoundSuccess(plates);
  }

  function handleCountingChoice(value: number) {
    const correct = plates.reduce((sum, p) => sum + p.length, 0);
    if (value === correct) {
      finalizeRoundSuccess(plates);
    } else {
      setCountingWrongFlash(true);
      playErrorSound();
      setTimeout(() => setCountingWrongFlash(false), 400);
    }
  }

  function finalizeRoundSuccess(finalPlates: PlacedItem[][]) {
    const now = performance.now();
    const fracLeft = Math.max(0, (deadlineRef.current - now) / (round.timeLimitSec * 1000));
    const isPerfect = fracLeft > 0.5;
    let coins = 10 + round.total;
    if (isPerfect) coins *= 2;
    let usedParty = false;
    if (partyModeActive) { coins *= 2; usedParty = true; }

    const newStreak = streak + 1;
    setStreak(newStreak);

    let newPerfectStreak = comboPerfectStreak;
    if (isPerfect) {
      newPerfectStreak += 1;
      if (newPerfectStreak >= 3) {
        setPartyModeActive(true);
        newPerfectStreak = 0;
        setBanner({ text: '🎉 Party Mode! Next round pays double!', key: performance.now() });
        setTimeout(() => setBanner(null), 2200);
      }
    } else {
      newPerfectStreak = 0;
    }
    setComboPerfectStreak(newPerfectStreak);
    if (usedParty) setPartyModeActive(false);

    recordMonsterDessertRound(coins, newStreak);
    setMonsterMood('happy');
    playCelebrationChime();

    if (isPerfect && !usedParty) {
      setBanner({ text: 'PERFECT! Double coins!', key: performance.now() });
      setTimeout(() => setBanner(null), 1800);
    }

    const perPlateCounts = finalPlates.map((p) => p.length);
    setEquationInfo({ perPlateCounts, total: round.total, coins });
    const allEqual = perPlateCounts.every((c) => c === perPlateCounts[0]);
    const spoken = allEqual
      ? `${perPlateCounts.join('加')}，等於 ${perPlateCounts.length} 乘 ${perPlateCounts[0]}，答案都是 ${round.total}！`
      : `${perPlateCounts.join('加')}，等於 ${round.total}！`;
    speak(spoken, 'zh-TW');
    setPhase('equation');

    if (round.monsterType === 'boss') {
      if ((round.bossStage ?? 1) < 3) {
        bossStageRef.current = (round.bossStage ?? 1) + 1;
      } else {
        bossStageRef.current = null;
        setTimeout(() => setBanner({ text: '🏆 You fed the whole BOSS!', key: performance.now() }), 2600);
      }
    }
  }

  function handleNextCustomer() {
    setBanner(null);
    loadNextRound();
  }

  function handleFreeze() {
    if (freezeUsesLeft <= 0) return;
    deadlineRef.current += 5000;
    setFreezeUsesLeft((c) => c - 1);
    setFreezeFlash(true);
    setTimeout(() => setFreezeFlash(false), 1200);
  }

  function handleAutoStamp() {
    if (autoStampUsesLeft <= 0) return;
    const positions = autoLayoutPositions(round.perPlate);
    const contents: PlacedItem[] = positions.map((p) => ({ id: nextId(), dessert: round.targetDessert, x: p.x, y: p.y }));
    const solved = Array.from({ length: round.plates }, () => contents.map((it) => ({ ...it })));
    setPlates(solved);
    setAutoStampUsesLeft((c) => c - 1);
    if (isBasic) {
      setFirstPlateItems(contents);
      setDirtySpots([]);
      setFirstPlateFinalized(true);
      enterCounting(solved);
    } else {
      finalizeRoundSuccess(solved);
    }
  }

  const timeFrac = secsLeft / round.timeLimitSec;
  const timerColor = freezeFlash ? '#38bdf8' : timeFrac > 0.5 ? '#44dd77' : timeFrac > 0.25 ? '#ffcc33' : '#ff4444';
  const urgent = secsLeft <= 3 && (phase === 'building' || phase === 'counting');
  const monsterMoodKey = monsterMood === 'happy' ? 'happy' : monsterMood === 'sad' ? 'sad' : urgent ? 'urgent' : 'happy';
  const totalSoFar = plates.reduce((s, p) => s + p.length, 0);

  return (
    <GameFrame>
      {/* ── Overlays ── */}
      {paused && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 rounded-2xl bg-black/75">
          <p className="text-7xl">⏸</p>
          <p className="text-3xl font-black text-white">Paused</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-sky-500 px-12 py-4 text-2xl font-black text-white shadow-xl hover:bg-sky-600 active:scale-95">
            ▶ Resume
          </button>
          <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
            {backArrow} Back
          </Link>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b-2 border-sky-300 bg-gradient-to-r from-sky-100 to-blue-100 px-3 py-1.5">
        <Link href="/games" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900/10 px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-900/15">
          {backArrow} Back
        </Link>
        <span className="text-sm font-black text-sky-700">🍰 Monster Dessert Shop</span>
        <div className="flex shrink-0 items-center gap-2">
          {streak >= 3 && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-sm font-black text-purple-600">🔥{streak}</span>}
          <span className="text-sm font-bold text-amber-600">🪙{progress.coins}</span>
          {phase !== 'equation' && (
            <button type="button" onClick={togglePause} className="px-1 text-xl text-sky-400 transition-transform hover:scale-110 active:scale-90" title="暫停">
              ⏸
            </button>
          )}
          <Link href="/games/monster-dessert/settings" aria-label="遊戲設定" className="px-1 text-xl text-sky-400 transition-transform hover:scale-110 active:scale-90">
            ⚙️
          </Link>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 shrink-0 bg-gray-200">
        {(phase === 'building' || phase === 'counting') && !paused && (
          <div
            className={`h-full rounded-r-full transition-[width] duration-300 ease-linear ${urgent ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(0, timeFrac * 100)}%`, background: timerColor }}
          />
        )}
      </div>

      {/* ══ MAIN LAYOUT ═══════════════════════════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* ── TOP ROW: monster + speech bubble ── */}
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-sky-200 px-4 py-2" style={{ height: '24%', background: 'linear-gradient(135deg,#eff6ff,#e0f2fe)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/monster-dessert/${round.monsterVariant}-${monsterMoodKey}.png`}
            alt=""
            className={`shrink-0 object-contain drop-shadow ${monsterMood === 'happy' ? 'animate-bounce' : ''}`}
            style={{ height: round.monsterType === 'boss' ? '108px' : '92px', width: 'auto' }}
          />
          <div className="relative min-w-0 flex-1">
            <div className="absolute left-[-9px] top-1/2 -translate-y-1/2" style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: '12px solid white' }} />
            <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-3 shadow-md" style={{ border: '2.5px solid #7dd3fc' }}>
              <button type="button" aria-label="唸出需求" onClick={() => speak(round.requestText, 'en-US')} className="shrink-0 text-2xl transition-transform hover:scale-110 active:scale-90">
                🔊
              </button>
              <div className="min-w-0">
                <p className="font-black leading-snug text-sky-800" style={{ fontSize: '1.05rem' }}>
                  {round.requestParts.map((part, i) =>
                    part.highlight ? (
                      <span key={i} className="text-[var(--hero-red)]" style={{ fontSize: '1.3em' }}>{part.text}</span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
                <p className="mt-0.5 text-xs font-normal text-zinc-400">{round.requestGlossZh}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="flex min-h-0 flex-1">
          {/* LEFT: dessert stamp picker */}
          <div className={`flex shrink-0 flex-col gap-1.5 overflow-y-auto border-r-2 p-2 transition-all ${phase === 'building' ? 'border-sky-300 bg-sky-50/60' : 'border-zinc-200 bg-zinc-50 opacity-40'}`} style={{ width: '22%' }}>
            <p className="shrink-0 text-center text-[10px] font-black uppercase tracking-widest text-sky-500">Pick a Stamp</p>
            {DESSERTS.map((d) => (
              <button
                key={d.key}
                type="button"
                disabled={phase !== 'building'}
                onClick={() => { setSelectedDessert(d.key); speak(d.nameEn, 'en-US'); }}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 transition-all ${
                  selectedDessert === d.key ? 'border-2 border-sky-400 bg-white shadow-md' : 'border-2 border-sky-200/60 bg-white/60 hover:bg-white'
                }`}
              >
                <span className="text-2xl">{d.emoji}</span>
                <span className="text-xs font-black text-sky-700">{d.nameEn}</span>
                {selectedDessert === d.key && <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">✓</span>}
              </button>
            ))}
          </div>

          {/* CENTER: the work area (single plate / table / counting / equation) */}
          {/* justify-start (not center): this zone's content grows taller as
              plates are added, and vertical centering would re-shift the
              whole block — including every already-placed dessert — on each
              click. Top-anchored + top padding keeps everything still. */}
          <div className="relative flex flex-1 flex-col items-center justify-start overflow-auto bg-white p-4 pt-10">
            {/* Feedback dialogs (wrong/perfect/party/timeout) are scoped to this
                zone specifically — never the header, monster bubble, dessert
                palette, or actions column — so they can't cover other info. */}
            {banner && (
              <div key={banner.key} className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-4">
                {/* pop-in (not tier-up-pop): tier-up-pop bakes in a
                    translate(-50%,-50%) meant for absolute+top:50%/left:50%
                    positioning, which fights this flexbox centering and
                    shoves the box sideways. pop-in is pure scale+opacity. */}
                <div className="pop-in max-w-full rounded-2xl border-4 border-sky-300 bg-white px-8 py-6 text-center text-xl font-black break-words text-sky-700 shadow-2xl">{banner.text}</div>
              </div>
            )}
            {phase === 'building' && isBasic && !firstPlateFinalized && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-zinc-500">Tap the plate anywhere ({firstPlateItems.length}/{round.perPlate})</p>
                <PlateCanvas items={firstPlateItems} dirtySpots={dirtySpots} onPointAt={handleFirstPlatePoint} sizeClass="h-56 w-56" shake={firstPlateShake} />
                {dirtySpots.length > 0 && (
                  <button type="button" onClick={() => setWipeMode((v) => !v)} className={`rounded-lg px-4 py-2 text-sm font-bold ${wipeMode ? 'bg-sky-400 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>
                    🧽 Wipe (tap me, then tap the dirt)
                  </button>
                )}
              </div>
            )}

            {phase === 'building' && isBasic && firstPlateFinalized && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-amber-700">🍽️ Serving table — {plates.length}/{round.plates} plates</p>
                {/* justify-start (not center): this row grows plate-by-plate as the
                    wand is used, and center-alignment would re-shift every existing
                    plate sideways on each click — left-anchoring keeps them still. */}
                <div className="flex flex-wrap justify-start gap-3 rounded-2xl border-4 border-amber-700 bg-amber-100 p-4">
                  {/* No pop/bounce transform here on purpose — it scales+rotates the
                      whole plate, which visually drags the absolutely-positioned
                      dessert along with it until the animation settles, looking like
                      the dessert "jumps" into place a beat late. Plain instant render
                      keeps the copied dessert exactly centered from the first frame. */}
                  {plates.map((p, pIdx) => (
                    <PlateCanvas key={pIdx} items={p} sizeClass="h-20 w-20" />
                  ))}
                </div>
              </div>
            )}

            {phase === 'building' && !isBasic && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-amber-700">🍽️ Serving table — {totalSoFar}/{round.total} total — tap any plate</p>
                <div className="flex flex-wrap justify-center gap-3 rounded-2xl border-4 border-amber-700 bg-amber-100 p-4">
                  {plates.map((p, pIdx) => (
                    <PlateCanvas key={pIdx} items={p} sizeClass="h-28 w-28" shake={advancedShakeIdx === pIdx} onPointAt={(x, y) => handleAdvancedPlatePoint(pIdx, x, y)} />
                  ))}
                </div>
                {mismatch && <p className="max-w-md text-center text-sm font-bold text-[var(--hero-red)]">{mismatch}</p>}
              </div>
            )}

            {phase === 'counting' && (
              <div className="flex flex-col items-center gap-4">
                {round.responseType === 'equation' ? (
                  <p className="text-2xl font-black text-zinc-800">{round.plates} × {round.perPlate} = ?</p>
                ) : (
                  <p className="text-sm font-black text-zinc-700">🔢 How many desserts in total?</p>
                )}
                <div className="flex flex-wrap justify-center gap-3 rounded-2xl border-4 border-amber-700 bg-amber-100 p-4">
                  {plates.map((p, pIdx) => (
                    <PlateCanvas key={pIdx} items={p} sizeClass="h-20 w-20" />
                  ))}
                </div>
                <div className={`flex justify-center gap-3 ${countingWrongFlash ? 'stage-shake' : ''}`}>
                  {countingChoices.map((c) => (
                    <button key={c} type="button" onClick={() => handleCountingChoice(c)} className="rounded-2xl bg-sky-400 px-6 py-3 text-xl font-black text-white shadow hover:brightness-95">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'equation' && equationInfo && (
              <div className="pop-in flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-bold text-zinc-500">Yum! The monster is happy!</p>
                <p className="text-2xl font-black text-zinc-900">{equationInfo.perPlateCounts.join(' + ')}</p>
                {equationInfo.perPlateCounts.every((c) => c === equationInfo.perPlateCounts[0]) ? (
                  <p className="text-3xl font-black text-sky-600">
                    = {equationInfo.perPlateCounts.length} × {equationInfo.perPlateCounts[0]} = {equationInfo.total}
                  </p>
                ) : (
                  <p className="text-3xl font-black text-sky-600">= {equationInfo.total}</p>
                )}
                <p className="text-sm font-bold text-amber-600">🪙 +{equationInfo.coins} coins!</p>
                <button type="button" onClick={handleNextCustomer} className="mt-2 rounded-full bg-sky-500 px-6 py-2 text-sm font-black text-white shadow hover:brightness-110">
                  Next Customer →
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: actions + power-ups */}
          <div className="flex shrink-0 flex-col gap-2 border-l-2 border-sky-200 bg-sky-50/40 p-2" style={{ width: '24%' }}>
            {phase === 'building' && isBasic && !firstPlateFinalized && (
              <button type="button" onClick={finalizeFirstPlate} disabled={!firstPlateReady} className="rounded-xl bg-[var(--hero-red)] px-3 py-3 text-sm font-black text-white shadow hover:brightness-110 disabled:opacity-40">
                ✅ Done Stamping!
              </button>
            )}
            {phase === 'building' && isBasic && firstPlateFinalized && (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={removeLastPlate} disabled={plates.length <= 1} aria-label="Remove Plate" className="flex-1 rounded-xl bg-amber-500 py-3 text-2xl font-black text-white shadow hover:brightness-110 disabled:opacity-40">
                    −
                  </button>
                  <button type="button" onClick={useWand} disabled={plates.length >= 10} aria-label="Copy Plate" className="flex-1 rounded-xl bg-purple-500 py-3 text-2xl font-black text-white shadow hover:brightness-110 disabled:opacity-40">
                    +
                  </button>
                </div>
                <p className="text-center text-[10px] font-bold text-zinc-500">🪄 Copy / Remove Plate</p>
                <button type="button" onClick={handleReadyBasic} className="rounded-xl bg-emerald-500 px-3 py-3 text-sm font-black text-white shadow hover:brightness-110">
                  ✅ Ready! Serve!
                </button>
                <button type="button" onClick={redesignFirstPlate} className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-200">
                  🔄 Redo First Plate
                </button>
              </>
            )}
            {phase === 'building' && !isBasic && (
              <button type="button" onClick={handleReadyAdvanced} className="rounded-xl bg-emerald-500 px-3 py-3 text-sm font-black text-white shadow hover:brightness-110">
                ✅ Ready! Serve!
              </button>
            )}

            {phase === 'building' && (
              <div className="mt-1 flex flex-col gap-2 border-t-2 border-sky-200 pt-2">
                <button type="button" onClick={handleFreeze} disabled={freezeUsesLeft <= 0} className="rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-200 disabled:opacity-40">
                  🧊 Freeze Potion ×{freezeUsesLeft}
                </button>
                <button type="button" onClick={handleAutoStamp} disabled={autoStampUsesLeft <= 0} className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-200 disabled:opacity-40">
                  ✨ Auto Stamp ×{autoStampUsesLeft}
                </button>
              </div>
            )}

            <div className="mt-auto rounded-xl bg-white/70 px-3 py-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">Timer</p>
              <p className={`text-2xl font-black ${urgent ? 'animate-pulse text-[var(--hero-red)]' : 'text-zinc-700'}`}>{freezeFlash ? '❄️' : `${secsLeft}s`}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn{0%{transform:scale(0.4);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        .pop-in{animation:popIn 0.4s ease-out forwards}
      `}</style>
    </GameFrame>
  );
}
