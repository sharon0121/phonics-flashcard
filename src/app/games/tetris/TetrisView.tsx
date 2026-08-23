'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import Link from 'next/link';
import {
  COLS, ROWS, VISIBLE_ROWS, BUFFER_ROWS,
  LOCK_DELAY_MS, MAX_LOCK_RESETS, DAS_MS, ARR_MS, SOFT_DROP_INTERVAL,
  PIECE_COLORS, PIECE_SHAPES, GHOST_COLOR, GARBAGE_COLOR,
  type TetrisState, type ActivePiece, type CellColor, type PieceType,
  initialState, getPieceCells, isValid, trySRS, tryMove, tryDrop,
  hardDrop, getGhost, lockPiece, clearLines, detectTSpin, calcClearScore,
  addGarbage, advancePiece, activateHold, calcLevel, gravityInterval,
} from '@/lib/tetris';

// ── Canvas layout ─────────────────────────────────────────────────────────────
const CELL = 28;
const BOARD_W = CELL * COLS;   // 280
const BOARD_H = CELL * VISIBLE_ROWS; // 560
const L_PANEL = 96;  // left panel width (HOLD + stats)
const R_PANEL = 128; // right panel width (NEXT queue)
const GAP = 8;
const PAD_TOP = 20;
const PAD_BOT = 20;
const CANVAS_W = L_PANEL + GAP + BOARD_W + GAP + R_PANEL;
const CANVAS_H = PAD_TOP + BOARD_H + PAD_BOT;
const BX = L_PANEL + GAP;   // board left x
const BY = PAD_TOP;          // board top y

// ── Preview rendering ─────────────────────────────────────────────────────────
const PREV_CELL = 14;
const PREV_SIZE = PREV_CELL * 4; // 56px square preview box

// ── Colors ────────────────────────────────────────────────────────────────────
const BG = '#0b1130';
const PANEL_BG = 'rgba(255,255,255,0.04)';
const GRID_LINE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,204,51,0.6)'; // hero-gold
const TEXT_COLOR = '#f5f6fa';
const LABEL_COLOR = '#ffcc33';
const DIM_COLOR = 'rgba(255,255,255,0.3)';

// ── Mutable live game data (held in a ref, not React state) ───────────────────
interface LiveState {
  gs: TetrisState;
  lastTime: number;
  gravAccum: number;
  lockStart: number | null;
  leftHeld: boolean;
  rightHeld: boolean;
  dasStart: number | null;
  dasDir: -1 | 0 | 1;
  arrAccum: number;
  softDrop: boolean;
  softAccum: number;
  lastAction: 'rotate' | 'other';
  clearAnim: { rows: number[]; start: number } | null;
  tspinAnim: { text: string; start: number } | null;
  flashAnim: { start: number } | null; // garbage flash
}

// ── Helper: draw a single Tetris cell (with highlight) ────────────────────────
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  color: string, ghost = false,
) {
  if (ghost) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    return;
  }
  // Filled cell
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  // Highlight (top-left inner edge)
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 2, y + 2, size - 4, 3);
  ctx.fillRect(x + 2, y + 2, 3, size - 4);
  // Shadow (bottom-right inner edge)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 2, y + size - 5, size - 4, 3);
  ctx.fillRect(x + size - 5, y + 2, 3, size - 4);
}

// ── Draw a piece preview in a centered box ────────────────────────────────────
function drawPreview(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  cx: number, cy: number, // center of preview area
  cellSize: number,
) {
  const shape = PIECE_SHAPES[type][0];
  const color = PIECE_COLORS[type];
  // Find bounding box
  const rows = shape.map(([r]) => r);
  const cols = shape.map(([, c]) => c);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const w = (maxC - minC + 1) * cellSize;
  const h = (maxR - minR + 1) * cellSize;
  const ox = cx - w / 2;
  const oy = cy - h / 2;
  for (const [r, c] of shape) {
    drawCell(ctx, ox + (c - minC) * cellSize, oy + (r - minR) * cellSize, cellSize, color);
  }
}

// ── Convert board coords to canvas coords ─────────────────────────────────────
function boardToCanvas(row: number, col: number): [number, number] {
  const visRow = row - BUFFER_ROWS;
  return [BX + col * CELL, BY + visRow * CELL];
}

export default function TetrisView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<LiveState | null>(null);
  const rafRef = useRef<number>(0);
  const [overlay, setOverlay] = useState<'none' | 'over' | 'paused'>('none');
  const [topScore, setTopScore] = useState(0);

  // ── drawFrame ────────────────────────────────────────────────────────────────
  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const live = liveRef.current;
    if (!canvas || !live) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { gs } = live;
    const { board, current, hold, nextQueue } = gs;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── LEFT PANEL ──────────────────────────────────────────────────────────
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(0, BY, L_PANEL, BOARD_H);

    // HOLD label
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('HOLD', L_PANEL / 2, BY + 16);

    // HOLD piece preview box
    const holdBoxY = BY + 24;
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, holdBoxY, L_PANEL - 16, 56);
    if (hold) {
      drawPreview(ctx, hold, L_PANEL / 2, holdBoxY + 28, PREV_CELL);
      if (gs.holdUsed) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(8, holdBoxY, L_PANEL - 16, 56);
      }
    }

    // Stats
    const statsX = L_PANEL / 2;
    let sy = holdBoxY + 72;
    const statLabel = (label: string, value: string | number) => {
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(label, statsX, sy);
      sy += 14;
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(String(value), statsX, sy);
      sy += 22;
    };
    statLabel('SCORE', gs.score.toLocaleString());
    statLabel('LEVEL', gs.level);
    statLabel('LINES', gs.lines);
    if (gs.combo > 0) {
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = '#ff9800';
      ctx.fillText(`${gs.combo}× COMBO`, statsX, sy);
      sy += 18;
    }
    if (gs.b2b) {
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = '#e91e63';
      ctx.fillText('B2B', statsX, sy);
    }

    // ── BOARD ────────────────────────────────────────────────────────────────
    // Board background
    ctx.fillStyle = '#050a1a';
    ctx.fillRect(BX, BY, BOARD_W, BOARD_H);

    // Grid lines
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BX + c * CELL, BY);
      ctx.lineTo(BX + c * CELL, BY + BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < VISIBLE_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BX, BY + r * CELL);
      ctx.lineTo(BX + BOARD_W, BY + r * CELL);
      ctx.stroke();
    }

    // Board cells
    for (let r = BUFFER_ROWS; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell) continue;
        const [cx, cy] = boardToCanvas(r, c);
        // Clear animation: flash white
        let color = cell;
        if (live.clearAnim) {
          const elapsed = now - live.clearAnim.start;
          if (live.clearAnim.rows.includes(r) && elapsed < 200) {
            color = `rgba(255,255,255,${0.8 * (1 - elapsed / 200)})`;
          }
        }
        drawCell(ctx, cx, cy, CELL, color);
      }
    }

    // Ghost piece
    if (current) {
      const ghost = getGhost(board, current);
      if (ghost.row !== current.row) {
        for (const [r, c] of getPieceCells(ghost)) {
          if (r < BUFFER_ROWS) continue;
          const [cx, cy] = boardToCanvas(r, c);
          drawCell(ctx, cx, cy, CELL, GHOST_COLOR, true);
        }
      }
    }

    // Current piece
    if (current) {
      const color = PIECE_COLORS[current.type];
      for (const [r, c] of getPieceCells(current)) {
        if (r < BUFFER_ROWS) continue;
        const [cx, cy] = boardToCanvas(r, c);
        drawCell(ctx, cx, cy, CELL, color);
      }
    }

    // Garbage flash overlay
    if (live.flashAnim) {
      const elapsed = now - live.flashAnim.start;
      if (elapsed < 250) {
        ctx.fillStyle = `rgba(255,50,50,${0.25 * (1 - elapsed / 250)})`;
        ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
      } else {
        live.flashAnim = null;
      }
    }

    // Board border
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(BX, BY, BOARD_W, BOARD_H);

    // ── T-SPIN / CLEAR announcement ──────────────────────────────────────────
    if (live.tspinAnim) {
      const elapsed = now - live.tspinAnim.start;
      if (elapsed < 1800) {
        const alpha = elapsed < 300 ? elapsed / 300 : 1 - (elapsed - 300) / 1500;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc33';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const textY = BY + BOARD_H / 2;
        ctx.strokeText(live.tspinAnim.text, BX + BOARD_W / 2, textY);
        ctx.fillText(live.tspinAnim.text, BX + BOARD_W / 2, textY);
        ctx.restore();
      } else {
        live.tspinAnim = null;
      }
    }

    // ── RIGHT PANEL ──────────────────────────────────────────────────────────
    const RX = BX + BOARD_W + GAP;
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(RX, BY, R_PANEL, BOARD_H);

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', RX + R_PANEL / 2, BY + 16);

    // NEXT 5 pieces
    let ny = BY + 28;
    for (let i = 0; i < Math.min(5, nextQueue.length); i++) {
      const type = nextQueue[i];
      const boxH = i === 0 ? 56 : 44;
      const cs = i === 0 ? PREV_CELL : 11;
      ctx.strokeStyle = i === 0 ? BORDER : DIM_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(RX + 8, ny, R_PANEL - 16, boxH);
      drawPreview(ctx, type, RX + R_PANEL / 2, ny + boxH / 2, cs);
      ny += boxH + 4;
    }

    // Garbage pending indicator
    if (gs.garbagePending > 0) {
      const barH = Math.min(gs.garbagePending * 8, BOARD_H - 4);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(BX - 6, BY + BOARD_H - barH, 4, barH);
    }
  }, []);

  // ── Game logic: lock piece, clear lines, score, advance ───────────────────
  const lockAndAdvance = useCallback((live: LiveState, now: number) => {
    const { gs } = live;
    if (!gs.current) return;

    // Detect T-Spin before locking
    const tSpin = detectTSpin(gs.board, gs.current, live.lastAction);

    // Lock piece
    let board = lockPiece(gs.board, gs.current);

    // Clear lines
    const { board: clearedBoard, linesCleared, clearedRows } = clearLines(board);

    // Trigger clear animation
    if (linesCleared > 0) {
      live.clearAnim = { rows: clearedRows, start: now };
    }

    // Calculate score
    const result = calcClearScore(linesCleared, tSpin, gs.b2b, linesCleared > 0 ? gs.combo + 1 : 0, gs.level);
    const newCombo = linesCleared > 0 ? gs.combo + 1 : 0;
    const newLines = gs.lines + linesCleared;
    const newLevel = calcLevel(newLines);

    // Show T-spin / clear announcement
    if (result.description) {
      live.tspinAnim = { text: result.description.toUpperCase(), start: now };
    }

    // Add incoming garbage (if no cancellation)
    let finalBoard = clearedBoard;
    const netGarbage = Math.max(0, gs.garbagePending - result.linesSent);
    if (netGarbage > 0) {
      finalBoard = addGarbage(finalBoard, netGarbage);
      live.flashAnim = { start: now };
    }

    // Advance to next piece
    const advance = advancePiece({
      ...gs,
      board: finalBoard,
    });

    // Check game over: new piece spawns into occupied cells
    if (!isValid(finalBoard, advance.current)) {
      live.gs = {
        ...gs,
        board: finalBoard,
        current: advance.current,
        phase: 'over',
        score: gs.score + result.scoreDelta,
        lines: newLines,
        level: newLevel,
        combo: newCombo,
        b2b: result.newB2B,
        garbagePending: 0,
      };
      setOverlay('over');
      setTopScore(prev => Math.max(prev, gs.score + result.scoreDelta));
      return;
    }

    live.gs = {
      ...gs,
      board: finalBoard,
      ...advance,
      score: gs.score + result.scoreDelta,
      lines: newLines,
      level: newLevel,
      combo: newCombo,
      b2b: result.newB2B,
      garbagePending: Math.max(0, result.linesSent > gs.garbagePending ? 0 : gs.garbagePending - result.linesSent),
    };
    live.lockStart = null;
    live.gravAccum = 0;
    live.lastAction = 'other';
  }, []);

  // ── Main game loop ────────────────────────────────────────────────────────
  const gameLoop = useCallback((now: number) => {
    const live = liveRef.current;
    if (!live) return;

    const { gs } = live;
    if (gs.phase !== 'playing') {
      drawFrame(now);
      return;
    }

    const dt = Math.min(now - live.lastTime, 100); // cap delta to 100ms
    live.lastTime = now;

    const currentGravity = live.softDrop
      ? SOFT_DROP_INTERVAL
      : gravityInterval(gs.level);

    // ── Gravity ──────────────────────────────────────────────────────────────
    live.gravAccum += dt;
    while (live.gravAccum >= currentGravity) {
      live.gravAccum -= currentGravity;

      if (gs.current) {
        const dropped = tryDrop(gs.board, gs.current);
        if (dropped) {
          // Track lowest row for lock reset counting
          if (dropped.row > live.gs.lowestRow) {
            live.gs = { ...live.gs, current: dropped, lowestRow: dropped.row, lockResets: 0 };
            live.lockStart = null; // reset lock timer when reaching new row
          } else {
            live.gs = { ...live.gs, current: dropped };
          }
          if (live.softDrop) {
            live.gs = { ...live.gs, score: live.gs.score + 1 };
          }
        } else {
          // Piece is resting on floor — start lock timer
          if (live.lockStart === null) {
            live.lockStart = now;
          } else if (now - live.lockStart >= LOCK_DELAY_MS || live.gs.lockResets >= MAX_LOCK_RESETS) {
            lockAndAdvance(live, now);
          }
        }
      }
    }

    // ── DAS / ARR ────────────────────────────────────────────────────────────
    if (live.dasDir !== 0 && live.dasStart !== null) {
      const elapsed = now - live.dasStart;
      if (elapsed >= DAS_MS) {
        // ARR phase
        live.arrAccum += dt;
        const arrInterval = Math.max(1, ARR_MS);
        while (live.arrAccum >= arrInterval) {
          live.arrAccum -= arrInterval;
          const moved = tryMove(live.gs.board, live.gs.current, live.dasDir);
          if (moved) {
            live.gs = { ...live.gs, current: moved };
            // Reset lock timer on move (if resets remain)
            if (live.lockStart !== null && live.gs.lockResets < MAX_LOCK_RESETS) {
              live.lockStart = now;
              live.gs = { ...live.gs, lockResets: live.gs.lockResets + 1 };
            }
            live.lastAction = 'other';
          }
          if (arrInterval <= 1) break; // instant mode: move once per DAS frame
        }
      }
    }

    drawFrame(now);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [drawFrame, lockAndAdvance]);

  // ── Input: single move/rotate action ─────────────────────────────────────
  const doMove = useCallback((dcol: number) => {
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing' || !live.gs.current) return;
    const moved = tryMove(live.gs.board, live.gs.current, dcol);
    if (moved) {
      live.gs = { ...live.gs, current: moved };
      if (live.lockStart !== null && live.gs.lockResets < MAX_LOCK_RESETS) {
        live.lockStart = Date.now();
        live.gs = { ...live.gs, lockResets: live.gs.lockResets + 1 };
      }
      live.lastAction = 'other';
    }
  }, []);

  const doRotate = useCallback((dir: 1 | -1) => {
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing' || !live.gs.current) return;
    const rotated = trySRS(live.gs.board, live.gs.current, dir);
    if (rotated) {
      live.gs = { ...live.gs, current: rotated };
      if (live.lockStart !== null && live.gs.lockResets < MAX_LOCK_RESETS) {
        live.lockStart = Date.now();
        live.gs = { ...live.gs, lockResets: live.gs.lockResets + 1 };
      }
      live.lastAction = 'rotate';
    }
  }, []);

  const doHardDrop = useCallback(() => {
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing' || !live.gs.current) return;
    const { piece, distance } = hardDrop(live.gs.board, live.gs.current);
    live.gs = { ...live.gs, current: piece, score: live.gs.score + distance * 2 };
    live.lastAction = 'other';
    lockAndAdvance(live, Date.now());
  }, [lockAndAdvance]);

  const doHold = useCallback(() => {
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing') return;
    const update = activateHold(live.gs);
    if (update) {
      live.gs = { ...live.gs, ...update } as TetrisState;
      live.lockStart = null;
      live.gravAccum = 0;
      live.lastAction = 'other';
    }
  }, []);

  // ── Keyboard handling ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const live = liveRef.current;
      if (!live) return;

      if (e.key === 'Escape' || e.key === 'p') {
        if (live.gs.phase === 'playing') {
          live.gs = { ...live.gs, phase: 'paused' };
          setOverlay('paused');
          cancelAnimationFrame(rafRef.current);
        } else if (live.gs.phase === 'paused') {
          live.gs = { ...live.gs, phase: 'playing' };
          live.lastTime = performance.now();
          setOverlay('none');
          rafRef.current = requestAnimationFrame(gameLoop);
        }
        return;
      }

      if (live.gs.phase !== 'playing') return;

      switch (e.key) {
        case 'ArrowLeft':
          if (!live.leftHeld) {
            live.leftHeld = true;
            live.dasDir = -1;
            live.dasStart = performance.now();
            live.arrAccum = 0;
            doMove(-1);
          }
          break;
        case 'ArrowRight':
          if (!live.rightHeld) {
            live.rightHeld = true;
            live.dasDir = 1;
            live.dasStart = performance.now();
            live.arrAccum = 0;
            doMove(1);
          }
          break;
        case 'ArrowDown':
          live.softDrop = true;
          live.softAccum = 0;
          break;
        case ' ':
          e.preventDefault();
          doHardDrop();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          doRotate(1);
          break;
        case 'z':
        case 'Z':
          doRotate(-1);
          break;
        case 'c':
        case 'C':
        case 'Shift':
          doHold();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const live = liveRef.current;
      if (!live) return;
      if (e.key === 'ArrowLeft') {
        live.leftHeld = false;
        if (live.dasDir === -1) { live.dasDir = live.rightHeld ? 1 : 0; live.dasStart = performance.now(); live.arrAccum = 0; }
      }
      if (e.key === 'ArrowRight') {
        live.rightHeld = false;
        if (live.dasDir === 1) { live.dasDir = live.leftHeld ? -1 : 0; live.dasStart = performance.now(); live.arrAccum = 0; }
      }
      if (e.key === 'ArrowDown') live.softDrop = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [doMove, doRotate, doHardDrop, doHold, gameLoop]);

  // ── Start / Restart ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    liveRef.current = {
      gs: initialState(),
      lastTime: performance.now(),
      gravAccum: 0,
      lockStart: null,
      leftHeld: false,
      rightHeld: false,
      dasStart: null,
      dasDir: 0,
      arrAccum: 0,
      softDrop: false,
      softAccum: 0,
      lastAction: 'other',
      clearAnim: null,
      tspinAnim: null,
      flashAnim: null,
    };
    setOverlay('none');
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  useEffect(() => {
    startGame();
    return () => cancelAnimationFrame(rafRef.current);
  }, [startGame]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div className="mb-3 flex w-full max-w-lg items-center justify-between px-2">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <span className="text-sm font-bold text-[var(--hero-gold)]">🟦 Tetris</span>
        <div className="text-xs text-zinc-400">
          ↑/X=CW &nbsp; Z=CCW &nbsp; C=Hold &nbsp; Space=Drop
        </div>
      </div>

      {/* Canvas wrapper */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-xl"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Paused overlay */}
        {overlay === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/70 gap-4">
            <p className="text-3xl font-black text-[var(--hero-gold)]">PAUSED</p>
            <button
              onClick={() => {
                const live = liveRef.current;
                if (!live) return;
                live.gs = { ...live.gs, phase: 'playing' };
                live.lastTime = performance.now();
                setOverlay('none');
                rafRef.current = requestAnimationFrame(gameLoop);
              }}
              className="rounded-full bg-[var(--hero-gold)] px-6 py-2 text-sm font-bold text-zinc-900 hover:brightness-110"
            >
              Resume (Esc)
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {overlay === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/80 gap-4">
            <p className="text-3xl font-black text-red-400">GAME OVER</p>
            <p className="text-lg text-zinc-300">
              Score: <span className="font-bold text-white">{liveRef.current?.gs.score.toLocaleString()}</span>
            </p>
            {topScore > 0 && (
              <p className="text-sm text-zinc-400">
                Best: <span className="text-[var(--hero-gold)]">{topScore.toLocaleString()}</span>
              </p>
            )}
            <button
              onClick={startGame}
              className="rounded-full bg-[var(--hero-gold)] px-6 py-2 text-sm font-bold text-zinc-900 hover:brightness-110"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500">P / Esc = Pause</p>
    </div>
  );
}
