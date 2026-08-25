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
import { playChainPopSound, playGarbageWarningSound, playCollectSound, playErrorSound } from '@/lib/sound';
import { usePuyoQuizWords } from '@/lib/puyoSettings';
import { useSpeechRate, SPEECH_RATE_VALUES } from '@/lib/heroClimbSettings';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';

function speak(text: string, rate: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

function speakZh(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

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

const DROP_INTERVAL_MS = 500;
const LOCK_DELAY_MS = 300;

// Stall penalty: place this many pieces in a row with no actual clear and a
// line of garbage queues up — rewards staying active, doesn't punish big chains.
const PIECES_BEFORE_GARBAGE = 4;

// Every this many milliseconds of actual play (paused/quiz time doesn't
// count), a vocabulary quiz interrupts the game.
const QUIZ_INTERVAL_MS = 120000;
const QUIZ_STREAK_TARGET = 3;

interface ClearParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface QuizQuestion {
  word: Word;
  choices: Word[];
}

interface QuizState {
  question: QuizQuestion;
  streak: number;
  feedback: 'correct' | 'wrong' | null;
  selectedId: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuizQuestion(pool: Word[]): QuizQuestion | null {
  if (pool.length === 0) return null;
  const word = pool[Math.floor(Math.random() * pool.length)];
  const distractorSrc = pool.filter((w) => w.id !== word.id);
  const distractors = shuffleArray(distractorSrc).slice(0, 2);
  const choices = shuffleArray([word, ...distractors]);
  return { word, choices };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rowToScreenY(row: number): number {
  // row 0 = bottom = screen bottom of board
  return BOARD_Y + (VISIBLE_ROWS - 1 - row) * CELL_SIZE;
}

function colToScreenX(col: number): number {
  return BOARD_X + col * CELL_SIZE;
}

function shadeHexColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r0 = (num >> 16) & 0xff;
  const g0 = (num >> 8) & 0xff;
  const b0 = num & 0xff;
  const r = percent >= 0 ? r0 + (255 - r0) * percent : r0 * (1 + percent);
  const g = percent >= 0 ? g0 + (255 - g0) * percent : g0 * (1 + percent);
  const b = percent >= 0 ? b0 + (255 - b0) * percent : b0 * (1 + percent);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Round, glossy sphere-style puyo — the light source sits top-left for every bubble.
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
  const d = size - pad * 2;
  const cx = x + pad + d / 2;
  const cy = y + pad + d / 2;
  const radius = d / 2;
  const color = type === PuyoType.GARBAGE ? PUYO_COLORS[PuyoType.GARBAGE] : PUYO_COLORS[type];

  ctx.globalAlpha = alpha;

  // Sphere body via radial gradient (bright top-left, darker rim)
  const grad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.4,
    radius * 0.1,
    cx,
    cy,
    radius
  );
  grad.addColorStop(0, shadeHexColor(color, 0.45));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shadeHexColor(color, -0.25));

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Big glossy highlight — a bold rounded shine, not a thin streak
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - radius * 0.32, cy - radius * 0.36, radius * 0.34, radius * 0.24, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Soft secondary sheen lower-right
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx + radius * 0.22, cy + radius * 0.34, radius * 0.34, radius * 0.18, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Rim outline
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.75, 0, Math.PI * 2);
  ctx.stroke();

  if (type === PuyoType.GARBAGE) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    const m = radius * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - m, cy - m);
    ctx.lineTo(cx + m, cy + m);
    ctx.moveTo(cx + m, cy - m);
    ctx.lineTo(cx - m, cy + m);
    ctx.stroke();
  } else {
    drawPuyoFace(ctx, cx, cy, radius, type);
  }

  ctx.globalAlpha = 1;
}

// Classic Puyo Puyo-style googly eyes: big white sclera + black pupil, plus a
// per-color eyebrow/mouth accent for personality. Eyes sit low enough to
// clear the specular highlight, and the sclera stays white/pupil stays black
// regardless of body color, so the puyo's own color is never in doubt.
function drawGoggleEye(
  ctx: CanvasRenderingContext2D,
  ex: number,
  ey: number,
  eyeR: number,
  pupilR: number,
  pupilOffX: number,
  pupilOffY: number
) {
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(25,20,20,0.95)';
  ctx.arc(ex + pupilOffX, ey + pupilOffY, pupilR, 0, Math.PI * 2);
  ctx.fill();
}

function drawPuyoFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  type: PuyoType
) {
  const ex = radius * 0.3; // eye horizontal offset from center
  const ey = cy - radius * 0.02; // eye vertical position
  const eyeR = radius * 0.22;
  const pupilR = radius * 0.115;
  const ink = 'rgba(30,20,20,0.9)';

  switch (type) {
    case PuyoType.RED: {
      // Fierce: pupils glare inward, angled eyebrows, small determined mouth
      drawGoggleEye(ctx, cx - ex, ey, eyeR, pupilR, pupilR * 0.5, pupilR * 0.2);
      drawGoggleEye(ctx, cx + ex, ey, eyeR, pupilR, -pupilR * 0.5, pupilR * 0.2);
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = Math.max(1.5, radius * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - ex - eyeR * 0.9, ey - eyeR * 1.5);
      ctx.lineTo(cx - ex + eyeR * 0.7, ey - eyeR * 1.9);
      ctx.moveTo(cx + ex - eyeR * 0.7, ey - eyeR * 1.9);
      ctx.lineTo(cx + ex + eyeR * 0.9, ey - eyeR * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, ey + radius * 0.38, radius * 0.11, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      break;
    }
    case PuyoType.BLUE: {
      // Cheerful: forward-looking eyes, big open smile
      drawGoggleEye(ctx, cx - ex, ey, eyeR, pupilR, 0, pupilR * 0.3);
      drawGoggleEye(ctx, cx + ex, ey, eyeR, pupilR, 0, pupilR * 0.3);
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, radius * 0.1);
      ctx.beginPath();
      ctx.arc(cx, ey + radius * 0.24, radius * 0.26, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      break;
    }
    case PuyoType.GREEN: {
      // Content: closed happy-arc eyes, gentle smile
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, radius * 0.11);
      ctx.beginPath();
      ctx.arc(cx - ex, ey, eyeR * 0.85, Math.PI, 0);
      ctx.moveTo(cx + ex + eyeR * 0.85, ey);
      ctx.arc(cx + ex, ey, eyeR * 0.85, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, ey + radius * 0.2, radius * 0.17, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      break;
    }
    case PuyoType.YELLOW: {
      // Playful wink: one googly eye, one closed, small open mouth
      drawGoggleEye(ctx, cx - ex, ey, eyeR, pupilR, 0, pupilR * 0.3);
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.5, radius * 0.11);
      ctx.beginPath();
      ctx.arc(cx + ex, ey, eyeR * 0.85, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, ey + radius * 0.32, radius * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
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
  const d = size - pad * 2;
  const cx = x + pad + d / 2;
  const cy = y + pad + d / 2;
  const radius = d / 2;
  const color = PUYO_COLORS[type];

  const grad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.4,
    radius * 0.1,
    cx,
    cy,
    radius
  );
  grad.addColorStop(0, shadeHexColor(color, 0.45));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shadeHexColor(color, -0.25));

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(cx - radius * 0.3, cy - radius * 0.32, radius * 0.16, radius * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();

  drawPuyoFace(ctx, cx, cy, radius, type);
}

// ─── Main draw function ───────────────────────────────────────────────────────
function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: PuyoGameState,
  chainAnim: { chain: number; alpha: number } | null,
  allClearAnim: boolean,
  particles: ClearParticle[],
  warningFlashAlpha: number
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

  // ── Clear particles ──
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Garbage-warning flash ──
  if (warningFlashAlpha > 0) {
    ctx.fillStyle = `rgba(220,40,40,${warningFlashAlpha * 0.35})`;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
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

// Stall-penalty garbage is queued a line at a time (see PIECES_BEFORE_GARBAGE),
// so only a couple of lines should ever land on a single spawn.
const GARBAGE_DROP_PER_SPAWN = 2;

// ─── Spawn helper ─────────────────────────────────────────────────────────────
function spawnPair(state: PuyoGameState): PuyoGameState {
  const [centerType, subType] = state.nextPairs[0];
  const next = state.nextPairs.slice(1) as [PuyoType, PuyoType][];
  while (next.length < 3) next.push(newPair());

  // Drop pending garbage before spawning
  let grid = state.grid;
  const dropCount = Math.min(state.garbagePending, GARBAGE_DROP_PER_SPAWN);
  if (dropCount > 0) {
    grid = addGarbageLines(grid, dropCount);
  }
  const newGarbagePending = state.garbagePending - dropCount;

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
  // Pieces locked in a row without landing an actual clear.
  const piecesSinceClearRef = useRef<number>(0);

  // Chain animation state (kept in ref to avoid triggering re-renders mid-loop)
  const chainAnimRef = useRef<{ chain: number; alpha: number; startTime: number } | null>(null);
  const allClearAnimRef = useRef<boolean>(false);
  const allClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear-pop particles and the garbage-landing screen shake/flash
  const particlesRef = useRef<ClearParticle[]>([]);
  const shakeRef = useRef<{ start: number; duration: number; magnitude: number } | null>(null);

  // Accumulated actual play time since the last vocabulary quiz (paused/quiz
  // time doesn't count) — drives the every-2-minutes quiz interruption.
  const playTimeRef = useRef<number>(0);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  // True the instant a quiz starts/ends — set synchronously so the game loop
  // never double-triggers a quiz on the frame right after one begins/ends,
  // which reading React state (updated a render later) can't guarantee.
  const quizActiveRef = useRef<boolean>(false);
  const quizWords = usePuyoQuizWords();
  const quizWordsRef = useRef<Word[]>(quizWords);
  useEffect(() => {
    quizWordsRef.current = quizWords;
  }, [quizWords]);
  const speechRate = SPEECH_RATE_VALUES[useSpeechRate()];

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
  // Mirrors gameRef.current.phase for JSX that needs it during render (e.g.
  // the pause button icon) — refs can't be read directly during render.
  const [phase, setPhase] = useState<PuyoGameState['phase']>('spawning');
  const bump = useCallback(() => {
    setTick((t) => t + 1);
    setPhase(gameRef.current.phase);
  }, []);

  // ── Restart ──────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    gameRef.current = initialPuyoState();
    chainAnimRef.current = null;
    allClearAnimRef.current = false;
    lastDropRef.current = 0;
    lockTimerRef.current = null;
    piecesSinceClearRef.current = 0;
    particlesRef.current = [];
    shakeRef.current = null;
    playTimeRef.current = 0;
    quizActiveRef.current = false;
    setQuiz(null);
    bump();
  }, [bump]);

  // ── Pause toggle ─────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    if (quizActiveRef.current) return;
    const state = gameRef.current;
    if (state.phase === 'paused') {
      gameRef.current = { ...state, phase: 'falling' };
      bump();
    } else if (state.phase === 'falling' || state.phase === 'locking') {
      gameRef.current = { ...state, phase: 'paused' };
      bump();
    }
  }, [bump]);

  // ── Vocabulary quiz ───────────────────────────────────────────────────────
  const triggerQuiz = useCallback(() => {
    const question = buildQuizQuestion(quizWordsRef.current);
    if (!question) return;
    quizActiveRef.current = true;
    gameRef.current = { ...gameRef.current, phase: 'paused' };
    setQuiz({ question, streak: 0, feedback: null, selectedId: null });
    bump();
  }, [bump]);

  // Not wrapped in useCallback — reads `quiz` straight from the closure so
  // it's always current, and the sound/speech side effects run exactly once
  // per click (a setQuiz updater function can run twice under StrictMode).
  function answerQuiz(choice: Word) {
    if (!quiz || quiz.feedback) return;
    const correct = choice.id === quiz.question.word.id;
    if (correct) {
      playCollectSound();
    } else {
      playErrorSound();
    }
    setTimeout(() => speakZh(quiz.question.word.zh), 350);
    setQuiz({ ...quiz, feedback: correct ? 'correct' : 'wrong', selectedId: choice.id });
  }

  // Speak the English word aloud whenever a fresh question is shown.
  useEffect(() => {
    if (!quiz || quiz.feedback) return;
    const t = setTimeout(() => speak(quiz.question.word.word, speechRate), 200);
    return () => clearTimeout(t);
  }, [quiz, speechRate]);

  // After a brief moment showing right/wrong feedback, either advance to the
  // next question or (3 correct in a row) resume the game.
  useEffect(() => {
    if (!quiz?.feedback) return;
    const wasCorrect = quiz.feedback === 'correct';
    const t = setTimeout(() => {
      setQuiz((prev) => {
        if (!prev) return prev;
        const nextStreak = wasCorrect ? prev.streak + 1 : 0;
        const nextQuestion = nextStreak >= QUIZ_STREAK_TARGET ? null : buildQuizQuestion(quizWordsRef.current);
        if (!nextQuestion) {
          quizActiveRef.current = false;
          gameRef.current = { ...gameRef.current, phase: 'falling' };
          bump();
          return null;
        }
        return { question: nextQuestion, streak: nextStreak, feedback: null, selectedId: null };
      });
    }, 1100);
    return () => clearTimeout(t);
  }, [quiz?.feedback, bump]);

  // ── Process chain resolution ──────────────────────────────────────────────
  const processChain = useCallback(() => {
    const state = gameRef.current;
    const withGravity = applyGravity(state.grid);
    const step = performClearStep(withGravity);

    if (step === null) {
      // Chain done. A real clear resets the stall counter; landing a piece
      // with nothing to clear pushes it toward the garbage threshold.
      let garbageAdd = 0;
      if (state.chain > 0) {
        piecesSinceClearRef.current = 0;
      } else if (piecesSinceClearRef.current >= PIECES_BEFORE_GARBAGE) {
        piecesSinceClearRef.current = 0;
        garbageAdd = 1;
      }

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
        garbagePending: state.garbagePending + garbageAdd,
        phase: 'spawning',
      };
      bump();
      return;
    }

    const newChain = state.chain + 1;
    const { score: delta } = calcChainScore(
      newChain,
      step.puyosCleared,
      step.colorCount,
      step.groupBonus
    );

    const newScore = state.score + delta;
    const newMaxChain = Math.max(state.maxChain, newChain);

    // Pop particles at every cleared cell, colored to match what was there
    for (const group of step.clearedGroups) {
      for (const [r, c] of group) {
        const cellType = withGravity[r][c];
        const color = PUYO_COLORS[cellType] ?? '#ffffff';
        const px = colToScreenX(c) + CELL_SIZE / 2;
        const py = rowToScreenY(r) + CELL_SIZE / 2;
        for (let i = 0; i < 4; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2.5;
          particlesRef.current.push({
            x: px,
            y: py,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            color,
            life: 400 + Math.random() * 200,
            maxLife: 600,
            size: 2 + Math.random() * 2,
          });
        }
      }
    }
    if (particlesRef.current.length > 400) {
      particlesRef.current = particlesRef.current.slice(-400);
    }
    playChainPopSound(newChain);

    // Chain anim
    chainAnimRef.current = { chain: newChain, alpha: 1, startTime: performance.now() };

    gameRef.current = {
      ...state,
      grid: step.newGrid,
      score: newScore,
      chain: newChain,
      maxChain: newMaxChain,
      phase: 'chain',
    };

    // Continue chain after brief pause
    setTimeout(() => {
      processChain();
    }, 300);
  }, [bump]);

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
    piecesSinceClearRef.current += 1;
    bump();

    // Start chain resolution
    setTimeout(() => processChain(), 100);
  }, [processChain, bump]);

  // Shared by keyboard, swipe/tap, and the on-screen touch buttons so all
  // three input methods drive the exact same piece logic.
  function canAcceptInput(): boolean {
    if (quizActiveRef.current) return false;
    const p = gameRef.current.phase;
    return p !== 'paused' && p !== 'over' && p !== 'chain';
  }

  const hardDrop = useCallback(() => {
    if (!canAcceptInput()) return;
    const state = gameRef.current;
    if (!state.current) return;
    const { pair: dropped } = hardDropPair(state.grid, state.current);
    gameRef.current = { ...state, current: dropped, phase: 'locking' };
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = null;
    setTimeout(() => lockCurrent(), 50);
  }, [lockCurrent]);

  const rotate = useCallback(
    (dir: 1 | -1) => {
      if (!canAcceptInput()) return;
      const state = gameRef.current;
      if (!state.current) return;
      const rotated = rotatePair(state.grid, state.current, dir);
      if (!rotated) return;
      gameRef.current = { ...gameRef.current, current: rotated };
      if (lockTimerRef.current !== null) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
        gameRef.current = { ...gameRef.current, phase: 'locking' };
        lockTimerRef.current = window.setTimeout(() => lockCurrent(), LOCK_DELAY_MS);
      }
    },
    [lockCurrent]
  );

  // Move-left/move-right buttons just hold the same virtual key the DAS/ARR
  // logic in the game loop already reads for the real arrow keys.
  function pressMoveKey(key: 'ArrowLeft' | 'ArrowRight') {
    if (!canAcceptInput()) return;
    keysRef.current.add(key);
  }
  function releaseMoveKey(key: 'ArrowLeft' | 'ArrowRight') {
    keysRef.current.delete(key);
    dasRef.current.dir = 0;
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const _ctx = ctx as CanvasRenderingContext2D;

    let prevTime: number | null = null;

    function loop(time: number) {
      animRef.current = requestAnimationFrame(loop);
      // `time` is a DOMHighResTimeStamp since page-navigation start, not since
      // this loop started — on the very first frame that could already be a
      // few hundred/thousand ms, and treating it as a frame delta would dump
      // a false head start into playTimeRef (and every other dt-driven timer
      // below). Zero it out for that first frame instead.
      if (prevTime === null) prevTime = time;
      const dt = time - prevTime;
      prevTime = time;

      const state = gameRef.current;

      // Vocabulary quiz timer — only ticks during actual gameplay
      if (!quizActiveRef.current && state.phase !== 'paused' && state.phase !== 'over') {
        playTimeRef.current += dt;
        if (playTimeRef.current >= QUIZ_INTERVAL_MS) {
          playTimeRef.current = 0;
          triggerQuiz();
          // The quiz just froze the game via gameRef.current — bail out of
          // this tick so the phase logic below (still holding `state`, a
          // snapshot from before the freeze) can't spawn/move/lock a piece
          // using stale data and stomp the pause. Next rAF frame reads fresh.
          return;
        }
      }

      // Clear-pop particle physics
      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current.filter((p) => {
          p.life -= dt;
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          p.vy += 0.05 * (dt / 16);
          return p.life > 0;
        });
      }

      // Garbage-landing shake/flash decay
      let shakeX = 0;
      let shakeY = 0;
      let warningFlashAlpha = 0;
      if (shakeRef.current) {
        const elapsed = time - shakeRef.current.start;
        if (elapsed >= shakeRef.current.duration) {
          shakeRef.current = null;
        } else {
          const t = 1 - elapsed / shakeRef.current.duration;
          const mag = shakeRef.current.magnitude * t;
          shakeX = (Math.random() * 2 - 1) * mag;
          shakeY = (Math.random() * 2 - 1) * mag;
          warningFlashAlpha = t;
        }
      }

      // Chain anim fade
      if (chainAnimRef.current) {
        const elapsed = time - chainAnimRef.current.startTime;
        chainAnimRef.current.alpha = Math.max(0, 1 - elapsed / 1200);
        if (chainAnimRef.current.alpha <= 0) chainAnimRef.current = null;
      }

      // Spawning phase
      if (state.phase === 'spawning') {
        const droppedGarbage = Math.min(state.garbagePending, GARBAGE_DROP_PER_SPAWN);
        const next = spawnPair(state);
        gameRef.current = next;
        lastDropRef.current = time;
        prevPhaseRef.current = 'falling';
        if (droppedGarbage > 0) {
          shakeRef.current = { start: time, duration: 350, magnitude: 6 };
          playGarbageWarningSound();
        }
        bump();
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
        const dropInterval = softDropRef.current ? 80 : DROP_INTERVAL_MS;
        if (time - lastDropRef.current >= dropInterval) {
          lastDropRef.current = time;
          const dropped = dropPair(gameRef.current.grid, gameRef.current.current!);
          if (dropped === null) {
            // Hit bottom: start lock timer
            if (lockTimerRef.current === null) {
              gameRef.current = { ...gameRef.current, phase: 'locking' };
              lockTimerRef.current = window.setTimeout(() => lockCurrent(), LOCK_DELAY_MS);
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
      _ctx.save();
      _ctx.translate(shakeX, shakeY);
      drawFrame(
        _ctx,
        gameRef.current,
        chainAnimRef.current,
        allClearAnimRef.current,
        particlesRef.current,
        warningFlashAlpha
      );
      _ctx.restore();
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [lockCurrent, bump, triggerQuiz]);

  // ── Keyboard input ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (quizActiveRef.current) return;
      const state = gameRef.current;

      if (e.key === 'Enter' && state.phase === 'over') {
        restart();
        return;
      }

      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        togglePause();
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
        hardDrop();
        return;
      }

      if (e.key === 'z' || e.key === 'Z' || e.key === 'ArrowUp') {
        e.preventDefault();
        rotate(-1);
      }

      if (e.key === 'x' || e.key === 'X') {
        rotate(1);
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
  }, [restart, lockCurrent, togglePause, hardDrop, rotate]);

  // ── Touch / mobile controls ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const _canvas = canvas;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressFired = false;
    const SWIPE_THRESHOLD = 30;
    const TAP_THRESHOLD = 250;
    const LONG_PRESS_MS = 450;
    const LONG_PRESS_MOVE_TOLERANCE = 12;

    function clearLongPressTimer() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
      longPressFired = false;
      clearLongPressTimer();
      // Holding still (not swiping) for a moment = hard drop, so an
      // accidental swipe-down (easy to mis-trigger) is never needed.
      longPressTimer = setTimeout(() => {
        longPressFired = true;
        hardDrop();
      }, LONG_PRESS_MS);
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE) {
        clearLongPressTimer();
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      clearLongPressTimer();
      if (longPressFired) return;
      if (quizActiveRef.current) return;
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
        togglePause();
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

      // Tap
      if (elapsed < TAP_THRESHOLD && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        const rect = _canvas.getBoundingClientRect();
        const tapX = t.clientX - rect.left;
        const boardMid = BOARD_X + BOARD_W / 2;
        const scaleX = _canvas.width / rect.width;
        const scaledTapX = tapX * scaleX;

        const dir: 1 | -1 = scaledTapX < boardMid ? -1 : 1;
        rotate(dir);
      }
    }

    function onTouchCancel() {
      clearLongPressTimer();
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel);
    return () => {
      clearLongPressTimer();
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [restart, lockCurrent, togglePause, hardDrop, rotate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-1"
      style={{ backgroundColor: '#0b1130' }}
    >
      {/* Header */}
      <div className="mb-3 flex w-full max-w-3xl items-center justify-between px-2">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
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
        <span style={{ color: '#ffcc33' }} className="text-sm font-bold sm:text-lg">
          魔法氣泡 Puyo Puyo
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/games/puyo/settings"
            aria-label="遊戲設定"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
          >
            ⚙️
          </Link>
          <div className="flex h-8 w-8 items-center justify-center">
            {phase !== 'over' && quiz === null && (
              <button
                type="button"
                onClick={togglePause}
                title={phase === 'paused' ? '繼續' : '暫停'}
                aria-label={phase === 'paused' ? '繼續' : '暫停'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
              >
                {phase === 'paused' ? '▶' : '⏸'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Board + on-screen touch controls: left buttons — board — right buttons */}
      <div className="flex w-full max-w-3xl items-center justify-center gap-1 sm:gap-3 md:gap-4">
        {/* Left side: hard drop (top) + move left (bottom) — move-left and
            move-right sit at the same height as each other for intuitive
            left/right symmetry. */}
        <div className="flex shrink-0 flex-col items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            aria-label="快速下降"
            onClick={hardDrop}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">⏬</span>
            <span className="hidden text-xs font-bold sm:block">下降</span>
          </button>
          <button
            type="button"
            aria-label="往左移動"
            onPointerDown={(e) => {
              e.preventDefault();
              pressMoveKey('ArrowLeft');
            }}
            onPointerUp={() => releaseMoveKey('ArrowLeft')}
            onPointerLeave={() => releaseMoveKey('ArrowLeft')}
            onPointerCancel={() => releaseMoveKey('ArrowLeft')}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">⬅️</span>
            <span className="hidden text-xs font-bold sm:block">左</span>
          </button>
        </div>

        <div className="relative min-w-0 flex-1" style={{ maxWidth: CANVAS_W }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-auto w-full"
          style={{
            border: '2px solid #2d3a6e',
            borderRadius: '8px',
            touchAction: 'none',
          }}
        />

        {quiz && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg p-4"
            style={{ background: 'rgba(11,17,48,0.95)' }}
          >
            <div className="text-xs font-bold" style={{ color: '#94a3b8' }}>
              📚 單字小測驗
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: QUIZ_STREAK_TARGET }, (_, i) => (
                <span
                  key={i}
                  className="text-3xl transition-all duration-300"
                  style={{
                    opacity: i < quiz.streak ? 1 : 0.25,
                    filter: i < quiz.streak ? 'none' : 'grayscale(1)',
                    transform: i < quiz.streak ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  💎
                </span>
              ))}
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>
              集滿 {QUIZ_STREAK_TARGET} 顆寶石才能繼續遊戲
            </div>
            <div className="mt-1 text-3xl font-black" style={{ color: '#ffcc33' }}>
              {quiz.question.word.emoji} {quiz.question.word.word}
            </div>
            {quiz.question.word.kk && (
              <div className="text-sm" style={{ color: '#94a3b8' }}>
                {quiz.question.word.kk}
              </div>
            )}
            <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
              {quiz.question.choices.map((choice) => {
                const isSelected = quiz.selectedId === choice.id;
                const isCorrectChoice = choice.id === quiz.question.word.id;
                const showFeedback = quiz.feedback !== null;
                let bg = 'rgba(255,255,255,0.08)';
                if (showFeedback && isSelected) {
                  bg = quiz.feedback === 'correct' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                } else if (showFeedback && isCorrectChoice) {
                  bg = 'rgba(34,197,94,0.2)';
                }
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={showFeedback}
                    onClick={() => answerQuiz(choice)}
                    className="flex min-h-[68px] items-center justify-center rounded-lg px-4 py-2 text-xl text-white"
                    style={{ background: bg, border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <ZhuyinText zh={choice.zh} zhuyin={choice.zhuyin} className="zhuyin-word-wrap" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Right side: rotate (top) + move right (bottom) */}
        <div className="flex shrink-0 flex-col items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            aria-label="旋轉方塊"
            onClick={() => rotate(1)}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">🔄</span>
            <span className="hidden text-xs font-bold sm:block">旋轉</span>
          </button>
          <button
            type="button"
            aria-label="往右移動"
            onPointerDown={(e) => {
              e.preventDefault();
              pressMoveKey('ArrowRight');
            }}
            onPointerUp={() => releaseMoveKey('ArrowRight')}
            onPointerLeave={() => releaseMoveKey('ArrowRight')}
            onPointerCancel={() => releaseMoveKey('ArrowRight')}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">➡️</span>
            <span className="hidden text-xs font-bold sm:block">右</span>
          </button>
        </div>
      </div>

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
