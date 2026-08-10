'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import { playCelebrationChime } from '@/lib/sound';
import {
  emptyFillGrid,
  findConflicts,
  isPuzzleSolved,
  SMART_GRID_DIFFICULTY,
  SMART_GRID_DIFFICULTIES,
  type SmartGridDifficulty,
  type SmartGridLevel,
} from '@/lib/smartGrid';
import { useSmartGridProgress, recordSmartGridSolved } from '@/lib/smartGridProgress';
import { SMART_GRID_LEVELS } from '@/data/smartGridLevels';

type Stage = 'difficulty' | 'playing';

// One pastel color per cage, cycling if there are more cages than colors —
// purely a visual grouping aid, doesn't affect correctness.
const CAGE_COLORS = [
  '#bfdbfe', '#bbf7d0', '#fbcfe8', '#fde68a', '#ddd6fe', '#a5f3fc', '#fecaca', '#fed7aa',
];

const DIFFICULTY_CARD: Record<
  SmartGridDifficulty,
  { emoji: string; desc: string; color: string }
> = {
  easy: { emoji: '⭐', desc: '提示大多只有 1～2 格，比較好推理', color: 'border-emerald-400 bg-emerald-500/10 text-emerald-200' },
  medium: { emoji: '⭐⭐', desc: '提示混合 1～3 格，中等挑戰', color: 'border-amber-400 bg-amber-500/10 text-amber-200' },
  hard: { emoji: '⭐⭐⭐', desc: '提示至少 2 格起跳，需要多想幾步', color: 'border-rose-400 bg-rose-500/10 text-rose-200' },
};

const CONFETTI_EMOJI = ['🎉', '✨', '⭐', '🏆', '🎊'];

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function pickLevel(pool: SmartGridLevel[], usedIds: Set<string>, excludeId?: string): SmartGridLevel {
  let available = pool.filter((l) => !usedIds.has(l.id) && l.id !== excludeId);
  if (available.length === 0) { usedIds.clear(); available = pool.filter((l) => l.id !== excludeId); }
  if (available.length === 0) available = pool;
  return available[Math.floor(Math.random() * available.length)];
}

const BackChevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path
      fillRule="evenodd"
      d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
      clipRule="evenodd"
    />
  </svg>
);

export default function SmartGridView() {
  const [stage, setStage] = useState<Stage>('difficulty');
  const [difficulty, setDifficulty] = useState<SmartGridDifficulty | null>(null);
  const progress = useSmartGridProgress();

  const pool = useMemo(
    () => (difficulty ? SMART_GRID_LEVELS.filter((l) => l.difficulty === difficulty) : []),
    [difficulty],
  );

  const [level, setLevel] = useState<SmartGridLevel | null>(null);
  const usedIdsRef = useRef(new Set<string>());
  const [fill, setFill] = useState<number[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [solved, setSolved] = useState(false);

  function startDifficulty(d: SmartGridDifficulty) {
    const levelsForD = SMART_GRID_LEVELS.filter((l) => l.difficulty === d);
    const next = pickLevel(levelsForD, new Set());
    usedIdsRef.current = new Set([next.id]);
    setDifficulty(d);
    setLevel(next);
    setFill(emptyFillGrid(next.n));
    setSelected(null);
    setSolved(false);
    setStage('playing');
  }

  function newPuzzle() {
    if (!level) return;
    const next = pickLevel(pool, usedIdsRef.current, level.id);
    usedIdsRef.current.add(next.id);
    setLevel(next);
    setFill(emptyFillGrid(next.n));
    setSelected(null);
    setSolved(false);
  }

  function backToDifficulty() {
    setStage('difficulty');
    setDifficulty(null);
    setLevel(null);
  }

  const n = level?.n ?? 0;
  const conflicts = useMemo(() => (level ? findConflicts(level.n, fill) : []), [level, fill]);

  const cageColorByCell = useMemo(() => {
    const map = new Map<string, string>();
    if (!level) return map;
    level.cages.forEach((cage, i) => {
      const color = CAGE_COLORS[i % CAGE_COLORS.length];
      for (const [r, c] of cage.cells) map.set(cellKey(r, c), color);
    });
    return map;
  }, [level]);

  const anchorLabelByCell = useMemo(() => {
    const map = new Map<string, string>();
    if (!level) return map;
    for (const cage of level.cages) {
      const sorted = [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const [ar, ac] = sorted[0];
      map.set(cellKey(ar, ac), cage.cells.length === 1 ? `${cage.sum}` : `${cage.sum}+`);
    }
    return map;
  }, [level]);

  function borderStyle(r: number, c: number): React.CSSProperties {
    if (!level) return {};
    const thick = '3px solid #57534e'; // stone-600 — cage-boundary lines
    const thin = '1px solid rgba(87,83,78,0.3)'; // faint — same-cage internal lines
    const id = level.cageId[r][c];
    // Cells sit flush against each other (no gap) so the grid reads as one
    // block, not separate tiles. Each internal edge is only drawn ONCE — by
    // this cell's top/left — so it never doubles up with the neighbor's own
    // border. The true outer perimeter (r=0/c=0 and the last row/column) is
    // NOT drawn here at all — the wrapper panel's own thick border handles
    // that instead, since a border on a rounded element never gets clipped
    // at the corners the way a clipped child border can.
    const style: React.CSSProperties = {};
    if (r > 0) style.borderTop = level.cageId[r - 1][c] !== id ? thick : thin;
    if (c > 0) style.borderLeft = level.cageId[r][c - 1] !== id ? thick : thin;
    return style;
  }

  function handleSelect(r: number, c: number) {
    if (solved) return;
    setSelected([r, c]);
  }

  function handleNumber(v: number) {
    if (!selected || solved || !level || !difficulty) return;
    const [r, c] = selected;
    const next = fill.map((row) => [...row]);
    next[r][c] = v;
    setFill(next);
    if (isPuzzleSolved(level, next)) {
      setSolved(true);
      recordSmartGridSolved(difficulty);
      playCelebrationChime();
    }
  }

  function handleDelete() {
    if (!selected || solved) return;
    const [r, c] = selected;
    const next = fill.map((row) => [...row]);
    next[r][c] = 0;
    setFill(next);
  }

  if (stage === 'playing' && level && difficulty) {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={backToDifficulty}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
            >
              <BackChevron />
              難度
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                🏆 {progress[difficulty]}
              </span>
              <Link
                href="/games/smart-grid/settings"
                aria-label="遊戲設定"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
              >
                ⚙️
              </Link>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--hero-gold)]">🔢 聰明格</h1>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-200">
              {DIFFICULTY_CARD[difficulty].emoji} {SMART_GRID_DIFFICULTY[difficulty].label}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-300">
            在 {n}×{n} 的格子裡填入 1～{n}，每一列、每一行都不能重複；粗框內的數字是這個區域全部格子加起來的總和！
          </p>

          <div className="relative mt-5 rounded-3xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-3 shadow-xl sm:p-5">
            <div
              className="mx-auto grid w-full max-w-sm overflow-hidden rounded-2xl border-[5px] border-stone-700 shadow-inner sm:max-w-md"
              style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
            >
              {Array.from({ length: n }, (_, r) =>
                Array.from({ length: n }, (_, c) => {
                  const key = cellKey(r, c);
                  const isSelected = selected?.[0] === r && selected?.[1] === c;
                  const value = fill[r][c];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelect(r, c)}
                      style={{ ...borderStyle(r, c), backgroundColor: cageColorByCell.get(key) }}
                      className={`relative flex aspect-square items-center justify-center text-xl font-extrabold transition-all duration-150 active:scale-95 sm:text-3xl ${
                        isSelected ? 'z-10 ring-[3px] ring-inset ring-[var(--hero-red)] brightness-95' : 'hover:brightness-105'
                      } ${conflicts[r]?.[c] ? 'text-[var(--hero-red)]' : 'text-zinc-900'}`}
                    >
                      {anchorLabelByCell.has(key) && (
                        <span className="absolute left-1 top-1 rounded-md bg-zinc-900/80 px-1 py-0.5 text-[0.55rem] leading-none font-extrabold text-white shadow sm:text-[0.65rem]">
                          {anchorLabelByCell.get(key)}
                        </span>
                      )}
                      {value !== 0 && (
                        <span className={isSelected ? 'scale-110 transition-transform' : ''}>{value}</span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>

            {solved && (
              <button
                type="button"
                onClick={newPuzzle}
                className="absolute inset-3 z-40 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-b from-amber-900/85 to-orange-950/90 text-center shadow-2xl sm:inset-5"
              >
                {CONFETTI_EMOJI.concat(CONFETTI_EMOJI).map((e, i) => (
                  <span
                    key={i}
                    className="klotski-confetti pointer-events-none absolute top-0 text-2xl"
                    style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.15}s` }}
                  >
                    {e}
                  </span>
                ))}
                <span className="animate-bounce text-6xl">🎉</span>
                <p className="text-2xl font-bold text-[var(--hero-gold)]">太棒了！全部填對了！</p>
                <p className="rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-white">點一下換下一題 →</p>
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: n }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleNumber(v)}
                disabled={!selected || solved}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-[var(--hero-gold)] to-amber-400 text-xl font-extrabold text-zinc-900 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-md sm:h-14 sm:w-14 sm:text-2xl"
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!selected || solved}
              className="flex h-12 items-center gap-1 rounded-xl bg-rose-100 px-4 text-sm font-bold text-rose-600 shadow-md transition-all hover:-translate-y-0.5 hover:bg-rose-200 hover:shadow-lg active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-md sm:h-14"
            >
              🗑️ 清除
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={newPuzzle}
              className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              🔄 換一題
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/games"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <BackChevron />
            Back
          </Link>
          <Link
            href="/games/smart-grid/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔢 聰明格</h1>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Smart Grid</p>
        <p className="mt-3 text-sm font-medium text-zinc-300">
          在格子裡填入 1～N，每一列、每一行都不能重複；粗框內的數字是這個區域全部格子加起來的總和！選一個難度：
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SMART_GRID_DIFFICULTIES.map((d) => {
            const config = SMART_GRID_DIFFICULTY[d];
            const card = DIFFICULTY_CARD[d];
            return (
              <button
                key={d}
                type="button"
                onClick={() => startDifficulty(d)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border-2 ${card.color} p-6 text-center shadow-lg transition-all hover:shadow-xl`}
              >
                <span className="text-4xl transition-transform group-hover:scale-110">{card.emoji}</span>
                <span className="text-xl font-bold">{config.label}</span>
                <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
                  {config.size} × {config.size}
                </span>
                <span className="text-sm leading-relaxed text-zinc-300">{card.desc}</span>
                <span className="text-xs font-bold text-[var(--hero-gold)]">🏆 已完成 {progress[d]} 題</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
