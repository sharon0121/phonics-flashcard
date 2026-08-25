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
import { playCollectSound, playErrorSound, playChainPopSound, playCelebrationChime, playGarbageWarningSound } from '@/lib/sound';
import { useTetrisQuizWords } from '@/lib/tetrisSettings';
import { useSpeechRate, SPEECH_RATE_VALUES } from '@/lib/heroClimbSettings';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';

// Every this many milliseconds of actual play, a vocabulary quiz interrupts
// the game — 3 correct answers in a row (out of 3 choices) resumes it.
// Mirrors the same mechanic in the Puyo game (src/app/games/puyo/PuyoView.tsx).
const QUIZ_INTERVAL_MS = 120000;
const QUIZ_STREAK_TARGET = 3;

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
  playTimeMs: number; // accumulated actual play time, drives the vocabulary quiz
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
  // Clear-pop particles and the garbage-landing screen shake (mirrors the
  // same effects in the Puyo game).
  const particlesRef = useRef<ClearParticle[]>([]);
  const shakeRef = useRef<{ start: number; duration: number; magnitude: number } | null>(null);
  const [overlay, setOverlay] = useState<'none' | 'over' | 'paused'>('none');
  const [topScore, setTopScore] = useState(0);

  // ── Vocabulary quiz ──────────────────────────────────────────────────────
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  // Set synchronously (not via the `quiz` state, which updates a render
  // later) so the game loop never double-triggers a quiz right as one
  // begins/ends.
  const quizActiveRef = useRef(false);
  const quizWords = useTetrisQuizWords();
  const quizWordsRef = useRef<Word[]>(quizWords);
  useEffect(() => {
    quizWordsRef.current = quizWords;
  }, [quizWords]);
  const speechRate = SPEECH_RATE_VALUES[useSpeechRate()];

  // Declared before gameLoop (which calls it) — only pauses/opens the quiz,
  // doesn't need to reference gameLoop itself (resuming does, see below).
  const triggerQuiz = useCallback(() => {
    const question = buildQuizQuestion(quizWordsRef.current);
    if (!question) return;
    quizActiveRef.current = true;
    const live = liveRef.current;
    if (live) live.gs = { ...live.gs, phase: 'paused' };
    setQuiz({ question, streak: 0, feedback: null, selectedId: null });
  }, []);

  // ── drawFrame ────────────────────────────────────────────────────────────────
  const drawFrame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const live = liveRef.current;
    if (!canvas || !live) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { gs } = live;
    const { board, current, hold, nextQueue } = gs;

    // Garbage-landing shake decay — must reset (via restore) at the end of
    // this function so the translate never accumulates frame over frame.
    let shakeX = 0;
    let shakeY = 0;
    if (shakeRef.current) {
      const elapsed = now - shakeRef.current.start;
      if (elapsed >= shakeRef.current.duration) {
        shakeRef.current = null;
      } else {
        const t = 1 - elapsed / shakeRef.current.duration;
        const mag = shakeRef.current.magnitude * t;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      }
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear-pop particle physics
    if (particlesRef.current.length > 0) {
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life -= 16;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        return p.life > 0;
      });
    }

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

    // Clear-pop particles
    for (const p of particlesRef.current) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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

    ctx.restore();
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

    // Trigger clear animation + sound + particle burst (colored from the
    // pre-clear board, since clearedBoard has already removed those cells)
    if (linesCleared > 0) {
      live.clearAnim = { rows: clearedRows, start: now };
      for (const r of clearedRows) {
        for (let c = 0; c < COLS; c++) {
          const cellColor = board[r][c];
          if (!cellColor) continue;
          const [cx, cy] = boardToCanvas(r, c);
          const px = cx + CELL / 2;
          const py = cy + CELL / 2;
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2.5;
            particlesRef.current.push({
              x: px,
              y: py,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1.5,
              color: cellColor,
              life: 400 + Math.random() * 200,
              maxLife: 600,
              size: 2 + Math.random() * 2,
            });
          }
        }
      }
      if (particlesRef.current.length > 300) {
        particlesRef.current = particlesRef.current.slice(-300);
      }
    }

    // Calculate score
    const result = calcClearScore(linesCleared, tSpin, gs.b2b, linesCleared > 0 ? gs.combo + 1 : 0, gs.level);
    const newCombo = linesCleared > 0 ? gs.combo + 1 : 0;
    const newLines = gs.lines + linesCleared;
    const newLevel = calcLevel(newLines);

    // Show T-spin / clear announcement + sound — a Tetris (4 lines) or any
    // scoring T-spin gets the bigger celebration chime, everything else pops
    // with a pitch that rises with lines cleared.
    if (result.description) {
      live.tspinAnim = { text: result.description.toUpperCase(), start: now };
    }
    if (linesCleared > 0) {
      if (linesCleared >= 4 || tSpin !== null) {
        playCelebrationChime();
      } else {
        playChainPopSound(linesCleared);
      }
    }

    // Add incoming garbage (if no cancellation)
    let finalBoard = clearedBoard;
    const netGarbage = Math.max(0, gs.garbagePending - result.linesSent);
    if (netGarbage > 0) {
      finalBoard = addGarbage(finalBoard, netGarbage);
      live.flashAnim = { start: now };
      shakeRef.current = { start: now, duration: 350, magnitude: 6 };
      playGarbageWarningSound();
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

    // Vocabulary quiz timer — only ticks during actual gameplay
    if (!quizActiveRef.current) {
      live.playTimeMs += dt;
      if (live.playTimeMs >= QUIZ_INTERVAL_MS) {
        live.playTimeMs = 0;
        triggerQuiz();
        drawFrame(now);
        return; // resuming after 3 correct explicitly restarts the RAF chain
      }
    }

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
  }, [drawFrame, lockAndAdvance, triggerQuiz]);

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
          const live = liveRef.current;
          if (live) {
            live.gs = { ...live.gs, phase: 'playing' };
            live.lastTime = performance.now();
            rafRef.current = requestAnimationFrame(gameLoop);
          }
          return null;
        }
        return { question: nextQuestion, streak: nextStreak, feedback: null, selectedId: null };
      });
    }, 1100);
    return () => clearTimeout(t);
  }, [quiz?.feedback, gameLoop]);

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

  // On-screen touch buttons for move-left/move-right — mirrors the
  // ArrowLeft/ArrowRight keydown/keyup DAS bookkeeping exactly, so holding a
  // button repeats the same way holding the arrow key does.
  const pressMoveLeft = useCallback(() => {
    if (quizActiveRef.current) return;
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing') return;
    if (!live.leftHeld) {
      live.leftHeld = true;
      live.dasDir = -1;
      live.dasStart = performance.now();
      live.arrAccum = 0;
      doMove(-1);
    }
  }, [doMove]);

  const releaseMoveLeft = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    live.leftHeld = false;
    if (live.dasDir === -1) {
      live.dasDir = live.rightHeld ? 1 : 0;
      live.dasStart = performance.now();
      live.arrAccum = 0;
    }
  }, []);

  const pressMoveRight = useCallback(() => {
    if (quizActiveRef.current) return;
    const live = liveRef.current;
    if (!live || live.gs.phase !== 'playing') return;
    if (!live.rightHeld) {
      live.rightHeld = true;
      live.dasDir = 1;
      live.dasStart = performance.now();
      live.arrAccum = 0;
      doMove(1);
    }
  }, [doMove]);

  const releaseMoveRight = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    live.rightHeld = false;
    if (live.dasDir === 1) {
      live.dasDir = live.leftHeld ? -1 : 0;
      live.dasStart = performance.now();
      live.arrAccum = 0;
    }
  }, []);

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
      if (quizActiveRef.current) return;
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

  // ── Touch / mobile controls (same gesture scheme as the Puyo game) ───────
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
      if (quizActiveRef.current || liveRef.current?.gs.phase !== 'playing') return;
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
        doHardDrop();
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
      clearLongPressTimer();
      if (longPressFired) return;
      if (quizActiveRef.current || liveRef.current?.gs.phase !== 'playing') return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe = move
        doMove(dx > 0 ? 1 : -1);
        return;
      }

      // Tap = rotate (left half of board = CCW, right half = CW)
      if (elapsed < TAP_THRESHOLD && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        const rect = _canvas.getBoundingClientRect();
        const tapX = t.clientX - rect.left;
        const boardMid = BX + BOARD_W / 2;
        const scaleX = _canvas.width / rect.width;
        const scaledTapX = tapX * scaleX;
        doRotate(scaledTapX < boardMid ? -1 : 1);
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
  }, [doMove, doRotate, doHardDrop]);

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
      playTimeMs: 0,
    };
    setOverlay('none');
    quizActiveRef.current = false;
    setQuiz(null);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  useEffect(() => {
    startGame();
    return () => cancelAnimationFrame(rafRef.current);
  }, [startGame]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-2"
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
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="hidden sm:inline">↑/X=CW &nbsp; Z=CCW &nbsp; C=Hold &nbsp; Space=Drop</span>
          <Link
            href="/games/tetris/settings"
            aria-label="遊戲設定"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>
      </div>

      {/* Board + on-screen touch controls: left buttons — board — right buttons */}
      <div className="flex w-full items-center justify-center gap-1 sm:gap-3 md:gap-4">
        {/* Left side: hard drop (top) + move left (bottom) — move-left and
            move-right sit at the same height as each other. */}
        <div className="flex shrink-0 flex-col items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            aria-label="快速下降"
            onClick={doHardDrop}
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
              pressMoveLeft();
            }}
            onPointerUp={releaseMoveLeft}
            onPointerLeave={releaseMoveLeft}
            onPointerCancel={releaseMoveLeft}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">⬅️</span>
            <span className="hidden text-xs font-bold sm:block">左</span>
          </button>
        </div>

      {/* Canvas wrapper */}
      <div className="relative min-w-0 flex-1" style={{ maxWidth: CANVAS_W }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block h-auto w-full rounded-xl"
          style={{ imageRendering: 'pixelated', touchAction: 'none' }}
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

        {/* Vocabulary quiz overlay */}
        {quiz && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/90 p-4">
            <div className="text-xs font-bold text-zinc-400">📚 單字小測驗</div>
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
            <div className="text-xs text-zinc-400">集滿 {QUIZ_STREAK_TARGET} 顆寶石才能繼續遊戲</div>
            <div className="mt-1 text-3xl font-black text-[var(--hero-gold)]">
              {quiz.question.word.emoji} {quiz.question.word.word}
            </div>
            {quiz.question.word.kk && <div className="text-sm text-zinc-400">{quiz.question.word.kk}</div>}
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
            onClick={() => doRotate(1)}
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
              pressMoveRight();
            }}
            onPointerUp={releaseMoveRight}
            onPointerLeave={releaseMoveRight}
            onPointerCancel={releaseMoveRight}
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-16 sm:w-16 md:h-20 md:w-20"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg sm:text-3xl md:text-4xl">➡️</span>
            <span className="hidden text-xs font-bold sm:block">右</span>
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">P / Esc = Pause</p>
    </div>
  );
}
