'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  COLS,
  VISIBLE_ROWS,
  PuyoType,
  PUYO_COLORS,
  type Grid,
  type PuyoPair,
  type PuyoGameState,
  emptyGrid,
  newPair,
  getSubPos,
  rotatePair,
  movePair,
  dropPair,
  hardDropPair,
  lockPair,
  applyGravity,
  performClearStep,
  calcChainScore,
  addGarbageLines,
  isAllClear,
  isDead,
  initialPuyoState,
} from '@/lib/puyo';

// ─── Layout constants ───────────────────────────────────────────────────────
const CELL_SIZE = 46;
const BOARD_W = COLS * CELL_SIZE;          // 276
const BOARD_H = VISIBLE_ROWS * CELL_SIZE;  // 552
const LEFT_W = 90;
const RIGHT_W = 90;
const GAP = 8;
const CANVAS_W = LEFT_W + GAP + BOARD_W + GAP + RIGHT_W; // 556
const CANVAS_H = BOARD_H + 60;                             // 612
const BOARD_X = LEFT_W + GAP;
const BOARD_Y = 30;

// DAS / ARR
const DAS = 133;
const ARR = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rowToScreenY(row: number): number {
  // row 0 = bottom = screen bottom of board
  return BOARD_Y + (VISIBLE_ROWS - 1 - row) * CELL_SIZE;
}

function colToScreenX(col: number): number {
  return BOARD_X + col * CELL_SIZE;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPuyo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: PuyoType,
  alpha = 1
) {
  if (type === PuyoType.NONE) return;

  const pad = 2;
  const r = size - pad * 2;
  const rx = x + pad;
  const ry = y + pad;

  ctx.globalAlpha = alpha;

  if (type === PuyoType.GARBAGE) {
    // Gray circle
    ctx.fillStyle = PUYO_COLORS[PuyoType.GARBAGE];
    drawRoundedRect(ctx, rx, ry, r, r, 6);
    ctx.fill();
    // White X
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const m = 6;
    ctx.beginPath();
    ctx.moveTo(rx + m, ry + m);
    ctx.lineTo(rx + r - m, ry + r - m);
    ctx.moveTo(rx + r - m, ry + m);
    ctx.lineTo(rx + m, ry + r - m);
    ctx.stroke();
  } else {
    const color = PUYO_COLORS[type];
    // Main fill
    ctx.fillStyle = color;
    drawRoundedRect(ctx, rx, ry, r, r, 10);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(rx + r * 0.28, ry + r * 0.28, r * 0.2, r * 0.16, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Dark outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, rx, ry, r, r, 10);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function drawMiniPuyo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: PuyoType
) {
  if (type === PuyoType.NONE) return;
  const pad = 2;
  const r = size - pad * 2;
  ctx.fillStyle = PUYO_COLORS[type];
  drawRoundedRect(ctx, x + pad, y + pad, r, r, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + pad + r * 0.3, y + pad + r * 0.3, r * 0.18, r * 0.14, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Main draw function ───────────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: PuyoGameState,
  chainAnim: { chain: number; alpha: number } | null,
  allClearAnim: boolean
) {
  const { grid, current, nextPairs, score, chain, maxChain, garbagePending } = state;

  // Background
  ctx.fillStyle = '#0b1130';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── Left panel ──
  const leftX = 4;

  // Garbage indicator
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GARBAGE', leftX, BOARD_Y + 16);

  const maxGarbageShow = 24;
  const displayGarbage = Math.min(garbagePending, maxGarbageShow);
  const circR = 7;
  for (let i = 0; i < displayGarbage; i++) {
    const gx = leftX + (i % 8) * 10 + circR;
    const gy = BOARD_Y + 28 + Math.floor(i / 8) * 18;
    ctx.beginPath();
    ctx.arc(gx, gy, circR, 0, Math.PI * 2);
    ctx.fillStyle = PUYO_COLORS[PuyoType.GARBAGE];
    ctx.fill();
  }
  if (garbagePending > maxGarbageShow) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`+${garbagePending - maxGarbageShow}`, leftX, BOARD_Y + 80);
  }

  // Score
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', leftX, BOARD_Y + 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(String(score), leftX, BOARD_Y + 126);

  // Chain
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('CHAIN', leftX, BOARD_Y + 155);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(String(chain), leftX, BOARD_Y + 175);

  // Max Chain
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.fillText('MAX', leftX, BOARD_Y + 200);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(String(maxChain), leftX, BOARD_Y + 216);

  // ── Board background ──
  ctx.fillStyle = '#0f1a3d';
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= VISIBLE_ROWS; r++) {
    const y = BOARD_Y + r * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(BOARD_X, y);
    ctx.lineTo(BOARD_X + BOARD_W, y);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    const x = BOARD_X + c * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, BOARD_Y);
    ctx.lineTo(x, BOARD_Y + BOARD_H);
    ctx.stroke();
  }

  // Board outline
  ctx.strokeStyle = '#2d3a6e';
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

  // ── Draw grid cells ──
  for (let r = 0; r < VISIBLE_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === PuyoType.NONE) continue;
      const sx = colToScreenX(c);
      const sy = rowToScreenY(r);
      drawPuyo(ctx, sx, sy, CELL_SIZE, t);
    }
  }

  // ── Ghost pair ──
  if (current && state.phase !== 'over' && state.phase !== 'paused') {
    const { pair: ghostPair } = hardDropPair(grid, current);
    const [ghostSubRow, ghostSubCol] = getSubPos(
      ghostPair.centerRow,
      ghostPair.centerCol,
      ghostPair.rotation
    );

    if (ghostPair.centerRow < VISIBLE_ROWS) {
      const sx = colToScreenX(ghostPair.centerCol);
      const sy = rowToScreenY(ghostPair.centerRow);
      drawPuyo(ctx, sx, sy, CELL_SIZE, current.centerType, 0.25);
    }
    if (ghostSubRow >= 0 && ghostSubRow < VISIBLE_ROWS) {
      const sx = colToScreenX(ghostSubCol);
      const sy = rowToScreenY(ghostSubRow);
      drawPuyo(ctx, sx, sy, CELL_SIZE, current.subType, 0.25);
    }
  }

  // ── Current pair ──
  if (current && state.phase !== 'over') {
    const [subRow, subCol] = getSubPos(
      current.centerRow,
      current.centerCol,
      current.rotation
    );

    if (current.centerRow >= 0 && current.centerRow < VISIBLE_ROWS) {
      const sx = colToScreenX(current.centerCol);
      const sy = rowToScreenY(current.centerRow);
      drawPuyo(ctx, sx, sy, CELL_SIZE, current.centerType);
    }
    if (subRow >= 0 && subRow < VISIBLE_ROWS && subCol >= 0 && subCol < COLS) {
      const sx = colToScreenX(subCol);
      const sy = rowToScreenY(subRow);
      drawPuyo(ctx, sx, sy, CELL_SIZE, current.subType);
    }
  }

  // ── Right panel: NEXT queue ──
  const rightX = BOARD_X + BOARD_W + GAP;
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEXT', rightX + 14, BOARD_Y + 16);

  const miniSize = 30;
  const nextLabels = ['1st', '2nd'];
  for (let i = 0; i < 2 && i < nextPairs.length; i++) {
    const [ct, st] = nextPairs[i];
    const baseY = BOARD_Y + 28 + i * (miniSize * 2 + 20);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(nextLabels[i], rightX + 8, baseY + 10);

    // sub (top = rotation 0 = above center)
    drawMiniPuyo(ctx, rightX + 24, baseY + 14, miniSize, st);
    // center (bottom)
    drawMiniPuyo(ctx, rightX + 24, baseY + 14 + miniSize, miniSize, ct);
  }

  // ── Chain announcement ──
  if (chainAnim && chainAnim.alpha > 0 && chainAnim.chain >= 2) {
    ctx.globalAlpha = chainAnim.alpha;
    ctx.fillStyle = '#ffcc33';
    ctx.font = `bold ${chainAnim.chain >= 5 ? 36 : 28}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`CHAIN ×${chainAnim.chain}!`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2);
    ctx.globalAlpha = 1;
  }

  // ── All Clear ──
  if (allClearAnim) {
    ctx.fillStyle = 'rgba(255,204,51,0.9)';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALL CLEAR!', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 - 20);
  }

  // ── Game Over overlay ──
  if (state.phase === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Score: ${score}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 4);
    ctx.fillText(`Max Chain: ${maxChain}`, BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 28);

    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Press Enter to Restart', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 58);
  }

  // ── Paused overlay ──
  if (state.phase === 'paused') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('Press P to resume', BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 + 26);
  }
}

// ─── Spawn helper ─────────────────────────────────────────────────────────────
function spawnPair(state: PuyoGameState): PuyoGameState {
  const [centerType, subType] = state.nextPairs[0];
  const next = state.nextPairs.slice(1) as [PuyoType, PuyoType][];
  while (next.length < 3) next.push(newPair());

  // Drop pending garbage before spawning
  let grid = state.grid;
  if (state.garbagePending > 0) {
    grid = addGarbageLines(grid, Math.min(state.garbagePending, 5));
  }
  const newGarbagePending = Math.max(0, state.garbagePending - 5);

  const pair: PuyoPair = {
    centerRow: 11,  // visible row 11 (just under hidden row)
    centerCol: 2,
    centerType,
    subType,
    rotation: 0,   // sub above center
  };

  // Check if death
  if (isDead(grid)) {
    return { ...state, grid, phase: 'over' };
  }

  return {
    ...state,
    grid,
    current: pair,
    nextPairs: next,
    garbagePending: newGarbagePending,
    phase: 'falling',
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PuyoView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PuyoGameState>(initialPuyoState());
  const animRef = useRef<number>(0);
  const lastDropRef = useRef<number>(0);
  const lockTimerRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string>('spawning');

  // Chain animation state (kept in ref to avoid triggering re-renders mid-loop)
  const chainAnimRef = useRef<{ chain: number; alpha: number; startTime: number } | null>(null);
  const allClearAnimRef = useRef<boolean>(false);
  const allClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Input state
  const keysRef = useRef<Set<string>>(new Set());
  const dasRef = useRef<{ dir: 0 | 1 | -1; startTime: number; lastRepeat: number }>({
    dir: 0,
    startTime: 0,
    lastRepeat: 0,
  });
  const softDropRef = useRef<boolean>(false);

  // Force re-render trigger (only for overlays)
  const [tick, setTick] = useState(0);

  // ── Restart ──────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    gameRef.current = initialPuyoState();
    chainAnimRef.current = null;
    allClearAnimRef.current = false;
    lastDropRef.current = 0;
    lockTimerRef.current = null;
    setTick((t) => t + 1);
  }, []);

  // ── Process chain resolution ──────────────────────────────────────────────
  const processChain = useCallback(() => {
    const state = gameRef.current;
    const withGravity = applyGravity(state.grid);
    const step = performClearStep(withGravity);

    if (step === null) {
      // Chain done
      const ac = isAllClear(withGravity);
      if (ac) {
        allClearAnimRef.current = true;
        if (allClearTimerRef.current) clearTimeout(allClearTimerRef.current);
        allClearTimerRef.current = setTimeout(() => {
          allClearAnimRef.current = false;
        }, 2000);
      }
      gameRef.current = {
        ...state,
        grid: withGravity,
        chain: 0,
        allClear: ac,
        phase: 'spawning',
      };
      setTick((t) => t + 1);
      return;
    }

    const newChain = state.chain + 1;
    const { score: delta, nuisance } = calcChainScore(
      newChain,
      step.puyosCleared,
      step.colorCount,
      step.groupBonus
    );

    const newScore = state.score + delta;
    const newMaxChain = Math.max(state.maxChain, newChain);
    const newGarbagePending = state.garbagePending + nuisance;

    // Chain anim
    chainAnimRef.current = { chain: newChain, alpha: 1, startTime: performance.now() };

    gameRef.current = {
      ...state,
      grid: step.newGrid,
      score: newScore,
      chain: newChain,
      maxChain: newMaxChain,
      garbagePending: newGarbagePending,
      phase: 'chain',
    };

    // Continue chain after brief pause
    setTimeout(() => {
      processChain();
    }, 300);
  }, []);

  // ── Lock current piece ────────────────────────────────────────────────────
  const lockCurrent = useCallback(() => {
    const state = gameRef.current;
    if (!state.current) return;

    const newGrid = lockPair(state.grid, state.current);
    gameRef.current = {
      ...state,
      grid: newGrid,
      current: null,
      chain: 0,
      phase: 'chain',
    };
    lockTimerRef.current = null;
    setTick((t) => t + 1);

    // Start chain resolution
    setTimeout(() => processChain(), 100);
  }, [processChain]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const _ctx = ctx as CanvasRenderingContext2D;

    let prevTime = 0;

    function loop(time: number) {
      animRef.current = requestAnimationFrame(loop);
      const dt = time - prevTime;
      prevTime = time;

      const state = gameRef.current;

      // Chain anim fade
      if (chainAnimRef.current) {
        const elapsed = time - chainAnimRef.current.startTime;
        chainAnimRef.current.alpha = Math.max(0, 1 - elapsed / 1200);
        if (chainAnimRef.current.alpha <= 0) chainAnimRef.current = null;
      }

      // Spawning phase
      if (state.phase === 'spawning') {
        const next = spawnPair(state);
        gameRef.current = next;
        lastDropRef.current = time;
        prevPhaseRef.current = 'falling';
        setTick((t) => t + 1);
      }

      // Falling phase
      if (state.phase === 'falling' && state.current) {
        // DAS / ARR horizontal movement
        const leftHeld = keysRef.current.has('ArrowLeft');
        const rightHeld = keysRef.current.has('ArrowRight');
        const das = dasRef.current;

        if (leftHeld || rightHeld) {
          const dir = leftHeld ? -1 : 1;
          if (das.dir !== dir) {
            das.dir = dir;
            das.startTime = time;
            das.lastRepeat = time;
            // Immediate move
            const moved = movePair(gameRef.current.grid, gameRef.current.current!, dir);
            if (moved) {
              gameRef.current = { ...gameRef.current, current: moved };
            }
          } else {
            if (time - das.startTime >= DAS && time - das.lastRepeat >= ARR) {
              das.lastRepeat = time;
              const moved = movePair(gameRef.current.grid, gameRef.current.current!, dir);
              if (moved) {
                gameRef.current = { ...gameRef.current, current: moved };
              }
            }
          }
        } else {
          das.dir = 0;
        }

        // Gravity
        const dropInterval = softDropRef.current ? 80 : 500;
        if (time - lastDropRef.current >= dropInterval) {
          lastDropRef.current = time;
          const dropped = dropPair(gameRef.current.grid, gameRef.current.current!);
          if (dropped === null) {
            // Hit bottom: start lock timer
            if (lockTimerRef.current === null) {
              gameRef.current = { ...gameRef.current, phase: 'locking' };
              lockTimerRef.current = window.setTimeout(() => lockCurrent(), 300);
            }
          } else {
            gameRef.current = { ...gameRef.current, current: dropped };
            // Clear lock timer if we moved down
            if (lockTimerRef.current !== null) {
              clearTimeout(lockTimerRef.current);
              lockTimerRef.current = null;
            }
          }
        }
      }

      // Locking phase — waiting for lock timer
      if (state.phase === 'locking' && state.current) {
        // Allow horizontal moves and rotates during lock delay
        const leftHeld = keysRef.current.has('ArrowLeft');
        const rightHeld = keysRef.current.has('ArrowRight');
        const das = dasRef.current;

        if (leftHeld || rightHeld) {
          const dir = leftHeld ? -1 : 1;
          if (das.dir !== dir) {
            das.dir = dir;
            das.startTime = time;
            das.lastRepeat = time;
            const moved = movePair(gameRef.current.grid, gameRef.current.current!, dir);
            if (moved) {
              gameRef.current = { ...gameRef.current, current: moved };
            }
          } else if (time - das.startTime >= DAS && time - das.lastRepeat >= ARR) {
            das.lastRepeat = time;
            const moved = movePair(gameRef.current.grid, gameRef.current.current!, dir);
            if (moved) {
              gameRef.current = { ...gameRef.current, current: moved };
            }
          }
        } else {
          das.dir = 0;
        }
      }

      // Draw
      drawFrame(_ctx, gameRef.current, chainAnimRef.current, allClearAnimRef.current);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [lockCurrent]);

  // ── Keyboard input ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = gameRef.current;

      if (e.key === 'Enter' && state.phase === 'over') {
        restart();
        return;
      }

      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        if (state.phase === 'paused') {
          gameRef.current = { ...state, phase: 'falling' };
          setTick((t) => t + 1);
        } else if (state.phase === 'falling' || state.phase === 'locking') {
          gameRef.current = { ...state, phase: 'paused' };
          setTick((t) => t + 1);
        }
        return;
      }

      if (state.phase === 'paused' || state.phase === 'over' || state.phase === 'chain') return;

      keysRef.current.add(e.key);

      if (!state.current) return;

      if (e.key === 'ArrowDown') {
        softDropRef.current = true;
      }

      if (e.key === ' ') {
        e.preventDefault();
        // Hard drop
        const { pair: dropped } = hardDropPair(gameRef.current.grid, gameRef.current.current!);
        gameRef.current = { ...gameRef.current, current: dropped, phase: 'locking' };
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
        // Lock immediately on hard drop
        setTimeout(() => lockCurrent(), 50);
        return;
      }

      if (e.key === 'z' || e.key === 'Z' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rotated = rotatePair(gameRef.current.grid, gameRef.current.current!, -1);
        if (rotated) {
          gameRef.current = { ...gameRef.current, current: rotated };
          // Reset lock timer on rotation
          if (lockTimerRef.current !== null) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
            gameRef.current = { ...gameRef.current, phase: 'locking' };
            lockTimerRef.current = window.setTimeout(() => lockCurrent(), 300);
          }
        }
      }

      if (e.key === 'x' || e.key === 'X') {
        const rotated = rotatePair(gameRef.current.grid, gameRef.current.current!, 1);
        if (rotated) {
          gameRef.current = { ...gameRef.current, current: rotated };
          if (lockTimerRef.current !== null) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = null;
            gameRef.current = { ...gameRef.current, phase: 'locking' };
            lockTimerRef.current = window.setTimeout(() => lockCurrent(), 300);
          }
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
      if (e.key === 'ArrowDown') {
        softDropRef.current = false;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        dasRef.current.dir = 0;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [restart, lockCurrent]);

  // ── Touch / mobile controls ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const _canvas = canvas;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    const SWIPE_THRESHOLD = 30;
    const TAP_THRESHOLD = 250;

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;
      const state = gameRef.current;

      if (state.phase === 'over') {
        restart();
        return;
      }
      if (state.phase === 'paused') {
        gameRef.current = { ...state, phase: 'falling' };
        return;
      }
      if (!state.current) return;

      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe = move
        const dir = dx > 0 ? 1 : -1;
        const moved = movePair(gameRef.current.grid, gameRef.current.current!, dir);
        if (moved) gameRef.current = { ...gameRef.current, current: moved };
        return;
      }

      if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        // Swipe down = soft drop / hard drop
        const { pair: dropped } = hardDropPair(gameRef.current.grid, gameRef.current.current!);
        gameRef.current = { ...gameRef.current, current: dropped, phase: 'locking' };
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
        setTimeout(() => lockCurrent(), 50);
        return;
      }

      // Tap
      if (elapsed < TAP_THRESHOLD && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        const rect = _canvas.getBoundingClientRect();
        const tapX = t.clientX - rect.left;
        const boardMid = BOARD_X + BOARD_W / 2;
        const scaleX = _canvas.width / rect.width;
        const scaledTapX = tapX * scaleX;

        const dir: 1 | -1 = scaledTapX < boardMid ? -1 : 1;
        const rotated = rotatePair(gameRef.current.grid, gameRef.current.current!, dir);
        if (rotated) {
          gameRef.current = { ...gameRef.current, current: rotated };
          if (lockTimerRef.current !== null) {
            clearTimeout(lockTimerRef.current);
            lockTimerRef.current = window.setTimeout(() => lockCurrent(), 300);
          }
        }
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [restart, lockCurrent]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ backgroundColor: '#0b1130' }}
    >
      {/* Back button */}
      <div className="w-full max-w-2xl px-4 mb-3 flex items-center gap-3">
        <Link
          href="/games"
          className="flex items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: '#94a3b8' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#ffcc33')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <span style={{ color: '#ffcc33' }} className="font-bold text-lg">
          魔法氣泡 Puyo Puyo
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: 'block',
          border: '2px solid #2d3a6e',
          borderRadius: '8px',
          maxWidth: '100vw',
          touchAction: 'none',
        }}
      />

      {/* Controls hint */}
      <div
        className="mt-3 text-xs grid grid-cols-2 gap-x-6 gap-y-1"
        style={{ color: '#64748b' }}
      >
        <span>← → : Move</span>
        <span>Z / ↑ : Rotate CCW</span>
        <span>↓ : Soft Drop</span>
        <span>X : Rotate CW</span>
        <span>Space : Hard Drop</span>
        <span>P / Esc : Pause</span>
      </div>
    </div>
  );
}
