'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BOARD_COLS,
  BOARD_ROWS,
  EXIT_COL,
  SHAPES,
  buildOccupancy,
  canPlace,
  isSolved,
  solve,
  type KlotskiLevel,
  type Move,
  type PieceDef,
} from '@/lib/klotski';
import { AnimalIcon, ANIMAL_LABEL, TYPE_TO_ANIMAL, type AnimalKind } from './AnimalIcon';
import { playCelebrationChime, playClimbSound, playErrorSound } from '@/lib/sound';

// One shape = one character = one colour, always — a plain white card with
// a thick colour-coded border (rather than a filled colour card) so the
// character's own saturated face art reads clearly instead of competing
// with a background tint.
const ANIMAL_ACCENT: Record<AnimalKind, string> = {
  hero: 'border-amber-600',
  crab: 'border-orange-600',
  giraffe: 'border-yellow-600',
  rabbit: 'border-rose-500',
};

const CONFETTI_EMOJI = ['🎉', '⭐', '🎊', '✨', '🏵️'];

const SOLUTION_STEP_MS = 700;
const DRAG_START_THRESHOLD_PX = 4;
const MAX_HINTS = 3;
const AUTO_ADVANCE_MS = 2600;

type Axis = 'row' | 'col';

interface DragState {
  pieceId: string;
  startX: number;
  startY: number;
  cellW: number;
  cellH: number;
  axis: Axis | null;
  maxNeg: number;
  maxPos: number;
  offset: number; // in whole-cell units along `axis`, fractional while dragging
}

// How far a piece can slide in each direction along one axis, given the
// other pieces currently on the board — walked out one cell at a time so it
// naturally stops at the first obstruction or the board edge.
function computeSlideRange(pieces: PieceDef[], piece: PieceDef, axis: Axis): { maxNeg: number; maxPos: number } {
  const grid = buildOccupancy(pieces);
  let maxNeg = 0;
  let maxPos = 0;
  if (axis === 'col') {
    while (canPlace(grid, piece, piece.row, piece.col - (maxNeg + 1))) maxNeg++;
    while (canPlace(grid, piece, piece.row, piece.col + (maxPos + 1))) maxPos++;
  } else {
    while (canPlace(grid, piece, piece.row - (maxNeg + 1), piece.col)) maxNeg++;
    while (canPlace(grid, piece, piece.row + (maxPos + 1), piece.col)) maxPos++;
  }
  return { maxNeg, maxPos };
}

interface KlotskiBoardProps {
  level: KlotskiLevel;
  isLastLevel: boolean;
  starsEarned: number;
  totalLevels: number;
  bestMoves: number | null;
  solutionItemsAvailable: number;
  onExit: () => void;
  onComplete: (moves: number, usedSolution: boolean) => void;
  onNext: () => void;
  onUseSolutionItem: () => void;
}

export default function KlotskiBoard({
  level,
  isLastLevel,
  starsEarned,
  totalLevels,
  bestMoves,
  solutionItemsAvailable,
  onExit,
  onComplete,
  onNext,
  onUseSolutionItem,
}: KlotskiBoardProps) {
  const [pieces, setPieces] = useState<PieceDef[]>(() => level.pieces.map((p) => ({ ...p })));
  const [moveCount, setMoveCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [usedSolutionToWin, setUsedSolutionToWin] = useState(false);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [solutionPlaying, setSolutionPlaying] = useState(false);
  const [noSolutionFound, setNoSolutionFound] = useState(false);
  const [, setDragTick] = useState(0); // bump to force a re-render while dragging (live value lives in dragRef)
  const completedRef = useRef(false);
  const priorBestRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    setPieces(level.pieces.map((p) => ({ ...p })));
    setMoveCount(0);
    setSolved(false);
    setUsedSolutionToWin(false);
    setHintMove(null);
    setHintsUsed(0);
    setSolutionPlaying(false);
    setNoSolutionFound(false);
    completedRef.current = false;
    dragRef.current = null;
  }, [level]);

  useEffect(() => {
    if (solved && !completedRef.current) {
      completedRef.current = true;
      priorBestRef.current = bestMoves;
      playCelebrationChime();
      onComplete(moveCount, usedSolutionToWin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, moveCount, usedSolutionToWin, onComplete]);

  useEffect(() => {
    if (!solved) return;
    const timer = setTimeout(onNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [solved, onNext]);

  function commitSteps(pieceId: string, axis: Axis, steps: number) {
    if (steps === 0) return;
    const dr = axis === 'row' ? Math.sign(steps) : 0;
    const dc = axis === 'col' ? Math.sign(steps) : 0;
    setPieces((prev) => {
      let state = prev;
      for (let i = 0; i < Math.abs(steps); i++) {
        state = state.map((p) => (p.id === pieceId ? { ...p, row: p.row + dr, col: p.col + dc } : p));
      }
      if (isSolved(state)) setSolved(true);
      return state;
    });
    setMoveCount((c) => c + Math.abs(steps));
    setHintMove(null);
    playClimbSound();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, piece: PieceDef) {
    if (solutionPlaying || solved) return;
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pieceId: piece.id,
      startX: e.clientX,
      startY: e.clientY,
      cellW: rect.width / BOARD_COLS,
      cellH: rect.height / BOARD_ROWS,
      axis: null,
      maxNeg: 0,
      maxPos: 0,
      offset: 0,
    };
    setHintMove(null);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (drag.axis === null) {
      if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
      const axis: Axis = Math.abs(dx) > Math.abs(dy) ? 'col' : 'row';
      const piece = pieces.find((p) => p.id === drag.pieceId);
      if (!piece) return;
      const { maxNeg, maxPos } = computeSlideRange(pieces, piece, axis);
      drag.axis = axis;
      drag.maxNeg = maxNeg;
      drag.maxPos = maxPos;
    }
    const raw = drag.axis === 'col' ? dx / drag.cellW : dy / drag.cellH;
    drag.offset = Math.max(-drag.maxNeg, Math.min(drag.maxPos, raw));
    setDragTick((t) => t + 1);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.axis) {
      const steps = Math.round(drag.offset);
      commitSteps(drag.pieceId, drag.axis, steps);
    }
    setDragTick((t) => t + 1);
  }

  function handleHint() {
    if (solutionPlaying || solved || hintsUsed >= MAX_HINTS) return;
    dragRef.current = null;
    const result = solve(pieces, 400000);
    if (!result.solvable || result.path.length === 0) {
      setNoSolutionFound(true);
      playErrorSound();
      return;
    }
    setHintMove(result.path[0]);
    setHintsUsed((n) => n + 1);
  }

  function handleShowSolution() {
    if (solutionPlaying || solved || solutionItemsAvailable <= 0) return;
    dragRef.current = null;
    const result = solve(pieces, 400000);
    if (!result.solvable || result.path.length === 0) {
      setNoSolutionFound(true);
      playErrorSound();
      return;
    }
    onUseSolutionItem();
    setHintMove(null);
    setSolutionPlaying(true);
    setUsedSolutionToWin(true);
    let i = 0;
    const path = result.path;
    const timer = setInterval(() => {
      setPieces((prev) => {
        const m = path[i];
        const next = prev.map((p) => (p.id === m.pieceId ? { ...p, row: p.row + m.dr, col: p.col + m.dc } : p));
        if (isSolved(next)) setSolved(true);
        return next;
      });
      setMoveCount((c) => c + 1);
      i++;
      if (i >= path.length) {
        clearInterval(timer);
        setSolutionPlaying(false);
      }
    }, SOLUTION_STEP_MS);
  }

  const drag = dragRef.current;
  const priorBest = priorBestRef.current;
  const isNewRecord = solved && (priorBest === null || moveCount < priorBest);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between text-sm font-semibold text-zinc-300">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          返回
        </button>
        <span>
          步數：<span className="text-[var(--hero-gold)]">{moveCount}</span>
          {bestMoves != null && <span className="ml-2 text-xs text-zinc-400">最佳 {bestMoves} 步</span>}
        </span>
      </div>

      <div
        ref={boardRef}
        className="relative w-full max-w-md touch-none select-none rounded-[2rem] border-[6px] border-amber-800/70 bg-gradient-to-b from-amber-100/90 to-orange-200/90 p-3 shadow-2xl"
        style={{ aspectRatio: `${BOARD_COLS} / ${BOARD_ROWS}` }}
      >
        {/* Grid background — the exit's 2x2 target zone gets a distinct
            glowing dashed highlight so the goal is visible even before the
            hero piece is anywhere near it. */}
        <div
          className="absolute inset-3 grid gap-1 rounded-xl"
          style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`, gridTemplateRows: `repeat(${BOARD_ROWS}, 1fr)` }}
        >
          {Array.from({ length: BOARD_COLS * BOARD_ROWS }).map((_, i) => {
            const row = Math.floor(i / BOARD_COLS);
            const col = i % BOARD_COLS;
            const isExitZone = row >= BOARD_ROWS - 2 && col >= EXIT_COL && col < EXIT_COL + 2;
            return (
              <div
                key={i}
                className={
                  isExitZone
                    ? 'rounded-md border-2 border-dashed border-[var(--hero-gold)] bg-[var(--hero-gold)]/25 shadow-[inset_0_0_10px_rgba(255,204,51,0.5)]'
                    : 'rounded-md border-2 border-dashed border-amber-700/25 bg-white/30'
                }
              />
            );
          })}
        </div>

        {/* Pieces */}
        <div className="absolute inset-3">
          {pieces.map((piece) => {
            const { w, h } = SHAPES[piece.type];
            const animal = TYPE_TO_ANIMAL[piece.type];
            const isHinted = hintMove?.pieceId === piece.id;
            const isDragging = drag?.pieceId === piece.id;
            let translate = '';
            if (isDragging && drag?.axis) {
              // Pixel-based, not percentage — CSS `%` in transform is
              // relative to the ELEMENT's own box, not the board, so a
              // percentage computed from board-relative cell counts would
              // move small pieces far too little and large pieces too much
              // (this previously let dragged pieces drift outside the
              // frame once the drop snapped them to their real position).
              const dxPx = drag.axis === 'col' ? drag.offset * drag.cellW : 0;
              const dyPx = drag.axis === 'row' ? drag.offset * drag.cellH : 0;
              translate = `translate(${dxPx}px, ${dyPx}px)`;
            }
            return (
              <button
                key={piece.id}
                type="button"
                onPointerDown={(e) => handlePointerDown(e, piece)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute flex touch-none items-center justify-center rounded-2xl border-[3px] shadow-md ease-out ${ANIMAL_ACCENT[animal]} ${
                  animal === 'hero'
                    ? 'bg-gradient-to-br from-amber-200 via-yellow-100 to-amber-200 shadow-amber-400/60'
                    : 'bg-white'
                } ${
                  isDragging ? 'z-20 scale-[1.05] cursor-grabbing ring-4 ring-white' : 'z-10 cursor-grab transition-all duration-200'
                } ${isHinted ? 'animate-pulse ring-4 ring-[var(--hero-gold)]' : ''}`}
                style={{
                  left: `${(piece.col / BOARD_COLS) * 100}%`,
                  top: `${(piece.row / BOARD_ROWS) * 100}%`,
                  width: `${(w / BOARD_COLS) * 100}%`,
                  height: `${(h / BOARD_ROWS) * 100}%`,
                  padding: '3px',
                  transform: translate || undefined,
                  touchAction: 'none',
                }}
              >
                <span className="sr-only">{ANIMAL_LABEL[animal]}</span>
                <AnimalIcon kind={animal} className="h-[min(85%,7.5vh)] w-[min(85%,7.5vh)]" />
                {isHinted && (
                  <span className="pointer-events-none absolute -top-3 text-xl">
                    {hintMove?.dr === -1 ? '⬆️' : hintMove?.dr === 1 ? '⬇️' : hintMove?.dc === -1 ? '⬅️' : '➡️'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Exit chute — protrudes below the frame so it visually reads as
            an actual opening, not just a decoration inside the board. */}
        <div
          className="absolute -bottom-9 flex flex-col items-center"
          style={{
            left: `${3 + (EXIT_COL / BOARD_COLS) * 94}%`,
            width: `${(2 / BOARD_COLS) * 94}%`,
          }}
        >
          <div className="flex h-9 w-full animate-bounce items-center justify-center rounded-b-2xl border-[6px] border-t-0 border-amber-800/70 bg-gradient-to-b from-[var(--hero-gold)] to-amber-300 text-[clamp(0.6rem,3vw,0.85rem)] font-bold text-amber-900 shadow-lg">
            🚪 出口
          </div>
        </div>

        {solved && (
          <button
            type="button"
            onClick={onNext}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-amber-900/80 to-orange-950/85 text-center"
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
            <span className="text-6xl">{isLastLevel ? '🏆' : '🎉'}</span>
            <p className="text-2xl font-bold text-[var(--hero-gold)]">
              {isLastLevel ? '難度全部過關！' : usedSolutionToWin ? '看完解答過關囉！' : '太棒了！英雄逃出來了！'}
            </p>
            <p className="text-sm font-semibold text-amber-100">
              使用步數：{moveCount}（最佳解 {level.minSteps} 步）
            </p>
            {isNewRecord && !usedSolutionToWin && (
              <p className="text-sm font-bold text-emerald-300">🏅 打破這關的最佳步數紀錄！</p>
            )}
            <p className="text-lg font-bold text-[var(--hero-gold)]">
              {'⭐'.repeat(starsEarned)}
              {'☆'.repeat(Math.max(0, totalLevels - starsEarned))}
            </p>
            <p className="rounded-full bg-white/15 px-5 py-2 text-sm font-bold text-white">
              {isLastLevel ? '點一下回到難度選擇 →' : '點一下馬上下一關 →'}
            </p>
          </button>
        )}
      </div>

      {!solved && (
        <div className="mt-6 flex w-full max-w-md items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleHint}
            disabled={solutionPlaying || hintsUsed >= MAX_HINTS}
            className="flex items-center gap-1.5 rounded-full border-2 border-sky-300 bg-sky-500/20 px-5 py-2.5 text-sm font-bold text-sky-200 shadow hover:scale-105 hover:bg-sky-500/30 disabled:opacity-40"
          >
            💡 提示（{hintsUsed}/{MAX_HINTS}）
          </button>
          <button
            type="button"
            onClick={handleShowSolution}
            disabled={solutionPlaying || solutionItemsAvailable <= 0}
            className="flex items-center gap-1.5 rounded-full border-2 border-purple-300 bg-purple-500/20 px-5 py-2.5 text-sm font-bold text-purple-200 shadow hover:scale-105 hover:bg-purple-500/30 disabled:opacity-40"
          >
            {solutionPlaying
              ? '▶️ 播放中…'
              : solutionItemsAvailable > 0
                ? `📖 看解答（剩 ${solutionItemsAvailable} 個）`
                : '📖 看解答（🔒 破10關解鎖）'}
          </button>
        </div>
      )}

      {noSolutionFound && (
        <p className="text-xs font-semibold text-rose-300">目前盤面找不到解法，請確認英雄沒有被完全卡死。</p>
      )}
    </div>
  );
}
