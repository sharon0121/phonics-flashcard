'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  GRID_SIZE,
  createEmptyBoard,
  canPlace,
  placeShape,
  findAndClearLines,
  placementScore,
  clearScore,
  generatePiece,
  isGameOver,
  shapeSize,
  type Board,
  type Piece,
  type Shape,
} from '@/lib/blockpuzzle';
import {
  useBlockPuzzleBestScore,
  reportBlockPuzzleScore,
  useBlockPuzzleQuizWords,
  useLifetimeCollected,
  addLifetimeCollected,
  useBlockPuzzleTheme,
  setBlockPuzzleTheme,
} from '@/lib/blockPuzzleSettings';
import { BLOCK_THEMES, getTheme, isThemeUnlocked, type BlockTheme } from '@/lib/blockPuzzleThemes';
import { useSpeechRate, SPEECH_RATE_VALUES } from '@/lib/heroClimbSettings';
import {
  playCollectSound,
  playErrorSound,
  playChainPopSound,
  playCelebrationChime,
  playDingSound,
} from '@/lib/sound';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';

const GOAL = 25;
const BOARD_MAX_PX = 420;
// "Normal" size used only while a piece is actively being dragged — idle
// tray pieces are shrunk to fit their slot instead (see trayFitCellPx),
// which is what actually keeps big shapes from overlapping their neighbors.
const TRAY_CELL_PX = 30;
const TRAY_SLOT_PX = 76; // usable interior of one tray slot, in px
const QUIZ_INTERVAL_MS = 120000;
const QUIZ_STREAK_TARGET = 5;

// Scale each piece's own cell size down so its full bounding box always fits
// inside one tray slot, regardless of shape — a 1x5 line or 3x3 square no
// longer spills into the neighboring slot the way a fixed cell size did.
function trayFitCellPx(shape: Shape): number {
  const { rows, cols } = shapeSize(shape);
  const maxDim = Math.max(rows, cols);
  return Math.min(TRAY_CELL_PX, Math.floor(TRAY_SLOT_PX / maxDim));
}

// ── Theme-aware cell rendering ──────────────────────────────────────────────
function shadeHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r0 = (num >> 16) & 0xff;
  const g0 = (num >> 8) & 0xff;
  const b0 = num & 0xff;
  const r = percent >= 0 ? r0 + (255 - r0) * percent : r0 * (1 + percent);
  const g = percent >= 0 ? g0 + (255 - g0) * percent : g0 * (1 + percent);
  const b = percent >= 0 ? b0 + (255 - b0) * percent : b0 * (1 + percent);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function cellVisualStyle(theme: BlockTheme, colorIndex: number): { background: string; boxShadow: string } {
  const hex = theme.colors[colorIndex] ?? '#888888';
  if (theme.style === 'glossy') {
    return {
      background: `linear-gradient(135deg, ${shadeHex(hex, 0.4)}, ${hex} 55%, ${shadeHex(hex, -0.25)})`,
      boxShadow: 'inset 2px 2px 3px rgba(255,255,255,0.55), inset -2px -2px 4px rgba(0,0,0,0.35)',
    };
  }
  return {
    background: hex,
    boxShadow: 'inset 2px 2px 3px rgba(255,255,255,0.35), inset -2px -2px 3px rgba(0,0,0,0.3)',
  };
}

// Paw prints always render as 🐾 regardless of theme (it's the universal
// "collect me" marker) — theme emojis only decorate ordinary cells.
function cellEmoji(theme: BlockTheme, colorIndex: number, special: boolean): string | null {
  if (special) return '🐾';
  if (theme.style === 'emoji' && theme.emojis) return theme.emojis[colorIndex] ?? null;
  return null;
}

interface ClearParticle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

interface CollectFloat {
  id: number;
  x: number;
  y: number;
}

interface ClearCallout {
  id: number;
  text: string;
}

// Resolves once the browser actually finishes speaking (or errors) — lets
// callers wait for the real narration length instead of guessing with a
// fixed timeout, which was cutting the English word or the Chinese answer
// off mid-way whenever they ran longer than the guess. Deliberately does
// NOT call speechSynthesis.cancel(): the Web Speech API already queues a
// speak() call made while something else is talking rather than
// interrupting it, so as long as nothing else force-cancels mid-question,
// the word and the answer both play out fully in order.
function speakAsync(text: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve();
    };
    // Safety net: a browser can silently stall speech synthesis (e.g. a
    // backgrounded tab) and never fire onend/onerror at all, or speak()
    // itself can throw synchronously (unsupported voice/lang) — either way
    // the promise would hang forever without this, permanently freezing the
    // quiz on that one question. 8s comfortably covers even a long phrase
    // at a slow rate.
    const safetyTimer = setTimeout(finish, 8000);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = finish;
    utterance.onerror = finish;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  });
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

// Module-level (not nested in the component) so the Math.random() calls
// inside don't trip the "impure call during render" lint rule — same
// reasoning as shuffleArray/buildQuizQuestion just below.
function randomParticleOffset(distMin: number, distMax: number): { tx: number; ty: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = distMin + Math.random() * (distMax - distMin);
  return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist };
}

function randomParticleSize(min: number, max: number): number {
  return min + Math.random() * (max - min);
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

interface DragState {
  piece: Piece;
  trayIndex: number;
  clientX: number;
  clientY: number;
  offsetY: number;
  originRow: number;
  originCol: number;
  valid: boolean;
}

function ShapePreview({
  shape,
  colorIndex,
  theme,
  specialCellIndex,
  cellPx,
}: {
  shape: Shape;
  colorIndex: number;
  theme: BlockTheme;
  specialCellIndex: number | null;
  cellPx: number;
}) {
  const { rows, cols } = shapeSize(shape);
  const visual = cellVisualStyle(theme, colorIndex);
  return (
    <div style={{ position: 'relative', width: cols * cellPx, height: rows * cellPx }}>
      {shape.map(([r, c], i) => {
        const special = i === specialCellIndex;
        const emoji = cellEmoji(theme, colorIndex, special);
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-[5px]"
            style={{
              position: 'absolute',
              left: c * cellPx,
              top: r * cellPx,
              width: cellPx - 3,
              height: cellPx - 3,
              ...visual,
            }}
          >
            {emoji && <span style={{ fontSize: cellPx * 0.55 }}>{emoji}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function BlockPuzzleView() {
  const boardRef = useRef<HTMLDivElement>(null);
  const playAreaRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [tray, setTray] = useState<(Piece | null)[]>(() => {
    const b = createEmptyBoard();
    return [generatePiece(b), generatePiece(b), generatePiece(b)];
  });
  const [score, setScore] = useState(0);
  const bestScore = useBlockPuzzleBestScore();
  const [combo, setCombo] = useState(0);
  const [collected, setCollected] = useState(0);
  const [flashCells, setFlashCells] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<DragState | null>(null);
  // Mirrors `dragging` for the pointerup handler, which must read the very
  // latest drag position synchronously — a setState(updater) that runs a
  // side effect (commitPlacement) can fire twice under StrictMode, which
  // would double the score.
  const draggingRef = useRef<DragState | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  // ── Themes (unlocked by lifetime paw-print collection) ────────────────────
  const lifetimeCollected = useLifetimeCollected();
  const themeId = useBlockPuzzleTheme();
  const theme = getTheme(themeId);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  // ── Clear effects: particle bursts, DOUBLE!/TRIPLE! callouts, collect floats
  const [particles, setParticles] = useState<ClearParticle[]>([]);
  const [collectFloats, setCollectFloats] = useState<CollectFloat[]>([]);
  const [callout, setCallout] = useState<ClearCallout | null>(null);
  const [shaking, setShaking] = useState(false);
  const effectIdRef = useRef(0);
  function nextEffectId() {
    effectIdRef.current += 1;
    return effectIdRef.current;
  }

  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
    reportBlockPuzzleScore(score);
  }, [score]);

  // ── Vocabulary quiz ──────────────────────────────────────────────────────
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const quizActiveRef = useRef(false);
  const quizWords = useBlockPuzzleQuizWords();
  const quizWordsRef = useRef<Word[]>(quizWords);
  useEffect(() => {
    quizWordsRef.current = quizWords;
  }, [quizWords]);
  const speechRate = SPEECH_RATE_VALUES[useSpeechRate()];

  function triggerQuiz() {
    const question = buildQuizQuestion(quizWordsRef.current);
    if (!question) return;
    // Clear any leftover gameplay speech before the quiz's own narration
    // starts — a genuine context switch, unlike the transitions between
    // quiz questions below which must NOT cancel each other.
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    quizActiveRef.current = true;
    setQuiz({ question, streak: 0, feedback: null, selectedId: null });
  }

  function answerQuiz(choice: Word) {
    if (!quiz || quiz.feedback) return;
    const correct = choice.id === quiz.question.word.id;
    if (correct) {
      playCollectSound();
    } else {
      playErrorSound();
    }
    setQuiz({ ...quiz, feedback: correct ? 'correct' : 'wrong', selectedId: choice.id });
  }

  // Speak the English word aloud whenever a fresh question is shown.
  useEffect(() => {
    if (!quiz || quiz.feedback) return;
    const t = setTimeout(() => {
      speakAsync(quiz.question.word.word, 'en-US', speechRate);
    }, 200);
    return () => clearTimeout(t);
  }, [quiz, speechRate]);

  // Waits for the Chinese answer to actually finish narrating (instead of a
  // fixed 1100ms guess) before advancing to the next question or (5 correct
  // in a row) resuming the game — a fixed delay was cutting the readout off
  // mid-word whenever it ran longer than the guess.
  useEffect(() => {
    if (!quiz?.feedback) return;
    let cancelled = false;
    const wasCorrect = quiz.feedback === 'correct';
    const zhText = quiz.question.word.zh;

    async function run() {
      await new Promise<void>((r) => setTimeout(r, 350));
      if (cancelled) return;
      await speakAsync(zhText, 'zh-TW', 0.9);
      if (cancelled) return;
      // Small buffer so the colored feedback stays visible a beat after the
      // voice finishes, rather than vanishing the instant it stops.
      await new Promise<void>((r) => setTimeout(r, 300));
      if (cancelled) return;
      setQuiz((prev) => {
        if (!prev) return prev;
        const nextStreak = wasCorrect ? prev.streak + 1 : 0;
        const nextQuestion = nextStreak >= QUIZ_STREAK_TARGET ? null : buildQuizQuestion(quizWordsRef.current);
        if (!nextQuestion) {
          quizActiveRef.current = false;
          return null;
        }
        return { question: nextQuestion, streak: nextStreak, feedback: null, selectedId: null };
      });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [quiz?.feedback]);

  const playTimeRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (quizActiveRef.current || gameOver || paused) return;
      playTimeRef.current += 1000;
      if (playTimeRef.current >= QUIZ_INTERVAL_MS) {
        playTimeRef.current = 0;
        triggerQuiz();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [gameOver, paused]);

  // ── Restart ──────────────────────────────────────────────────────────────
  function restart() {
    const b = createEmptyBoard();
    setBoard(b);
    setTray([generatePiece(b), generatePiece(b), generatePiece(b)]);
    setScore(0);
    setCombo(0);
    setCollected(0);
    setFlashCells(new Set());
    setDragging(null);
    setGameOver(false);
    setPaused(false);
    playTimeRef.current = 0;
    quizActiveRef.current = false;
    setQuiz(null);
  }

  // ── Placement + clear resolution ────────────────────────────────────────
  function finishTurn(currentTray: (Piece | null)[], currentBoard: Board) {
    if (currentTray.every((p) => p === null)) {
      const newTray = [generatePiece(currentBoard), generatePiece(currentBoard), generatePiece(currentBoard)];
      setTray(newTray);
      if (isGameOver(currentBoard, newTray)) setGameOver(true);
    } else if (isGameOver(currentBoard, currentTray)) {
      setGameOver(true);
    }
  }

  // Spawns particle bursts, DOUBLE!/TRIPLE!/MEGA CLEAR! callouts, board
  // shake, and paw-collection floats — purely cosmetic, reads DOM rects at
  // call time so it must run after the cleared cells are still on screen.
  function spawnClearEffects(
    clearedCells: { row: number; col: number; colorIndex: number }[],
    specialCollectedCells: { row: number; col: number }[],
    linesCleared: number
  ) {
    const boardEl = boardRef.current;
    const areaEl = playAreaRef.current;
    if (!boardEl || !areaEl) return;
    const boardRect = boardEl.getBoundingClientRect();
    const areaRect = areaEl.getBoundingClientRect();
    const cellW = boardRect.width / GRID_SIZE;
    const cellH = boardRect.height / GRID_SIZE;
    const originX = boardRect.left - areaRect.left;
    const originY = boardRect.top - areaRect.top;

    // Cap particle count for very large multi-line clears — sample evenly
    // instead of spawning one burst per cell.
    const sampled =
      clearedCells.length > 24
        ? clearedCells.filter((_, i) => i % Math.ceil(clearedCells.length / 24) === 0)
        : clearedCells;
    const newParticles: ClearParticle[] = [];
    for (const cell of sampled) {
      const cx = originX + (cell.col + 0.5) * cellW;
      const cy = originY + (cell.row + 0.5) * cellH;
      const hex = theme.colors[cell.colorIndex] ?? '#ffcc33';
      for (let i = 0; i < 2; i++) {
        const { tx, ty } = randomParticleOffset(24, 54);
        newParticles.push({
          id: nextEffectId(),
          x: cx,
          y: cy,
          tx,
          ty,
          color: hex,
          size: randomParticleSize(3, 6),
        });
      }
    }
    if (newParticles.length > 0) {
      setParticles((prev) => [...prev, ...newParticles]);
      const ids = new Set(newParticles.map((p) => p.id));
      setTimeout(() => setParticles((prev) => prev.filter((p) => !ids.has(p.id))), 600);
    }

    if (linesCleared >= 2) {
      const text = linesCleared >= 4 ? 'MEGA CLEAR!' : linesCleared === 3 ? 'TRIPLE!' : 'DOUBLE!';
      const id = nextEffectId();
      setCallout({ id, text });
      setTimeout(() => setCallout((cur) => (cur?.id === id ? null : cur)), 750);

      setShaking(true);
      setTimeout(() => setShaking(false), 420);
    }

    if (specialCollectedCells.length > 0) {
      playDingSound();
      const floats: CollectFloat[] = specialCollectedCells.map((cell) => ({
        id: nextEffectId(),
        x: originX + (cell.col + 0.5) * cellW,
        y: originY + (cell.row + 0.5) * cellH,
      }));
      setCollectFloats((prev) => [...prev, ...floats]);
      const ids = new Set(floats.map((f) => f.id));
      setTimeout(() => setCollectFloats((prev) => prev.filter((f) => !ids.has(f.id))), 850);
    }
  }

  function commitPlacement(piece: Piece, trayIndex: number, originRow: number, originCol: number) {
    const placedBoard = placeShape(board, piece.shape, originRow, originCol, piece.colorIndex, piece.specialCellIndex);
    const nextTray = tray.map((p, i) => (i === trayIndex ? null : p));
    const clearInfo = findAndClearLines(placedBoard);
    const linesCleared = clearInfo.rowsCleared.length + clearInfo.colsCleared.length;

    setBoard(placedBoard);
    setScore((s) => s + placementScore(piece.shape));
    setTray(nextTray);
    playCollectSound();

    if (linesCleared > 0) {
      const flashKeys = new Set<string>();
      for (const r of clearInfo.rowsCleared) for (let c = 0; c < GRID_SIZE; c++) flashKeys.add(`${r},${c}`);
      for (const c of clearInfo.colsCleared) for (let r = 0; r < GRID_SIZE; r++) flashKeys.add(`${r},${c}`);
      setFlashCells(flashKeys);
      const newCombo = combo + 1;
      setCombo(newCombo);
      spawnClearEffects(clearInfo.clearedCells, clearInfo.specialCollectedCells, linesCleared);
      if (linesCleared >= 2) playCelebrationChime();
      else playChainPopSound(linesCleared);

      setTimeout(() => {
        const bonus = clearScore(linesCleared, newCombo);
        setBoard(clearInfo.board);
        setScore((s) => s + bonus);
        setFlashCells(new Set());
        if (clearInfo.specialCollected > 0) {
          addLifetimeCollected(clearInfo.specialCollected);
          setCollected((prev) => {
            const next = prev + clearInfo.specialCollected;
            if (next >= GOAL) {
              playCelebrationChime();
              return 0;
            }
            return next;
          });
        }
        finishTurn(nextTray, clearInfo.board);
      }, 220);
    } else {
      setCombo(0);
      finishTurn(nextTray, placedBoard);
    }
  }

  // ── Drag handling ────────────────────────────────────────────────────────
  function pointerToCell(clientX: number, clientY: number, offsetY: number) {
    const rect = boardRef.current!.getBoundingClientRect();
    const cellSize = rect.width / GRID_SIZE;
    const col = Math.floor((clientX - rect.left) / cellSize);
    const row = Math.floor((clientY - offsetY - rect.top) / cellSize);
    return { row, col };
  }

  function handleTrayPointerDown(e: React.PointerEvent, trayIndex: number) {
    const piece = tray[trayIndex];
    if (!piece || gameOver || paused || quizActiveRef.current) return;
    e.preventDefault();
    const offsetY = e.pointerType === 'touch' ? 70 : 0;
    const { rows, cols } = shapeSize(piece.shape);

    const update = (clientX: number, clientY: number) => {
      const { row, col } = pointerToCell(clientX, clientY, offsetY);
      const originRow = row - Math.floor(rows / 2);
      const originCol = col - Math.floor(cols / 2);
      const valid = canPlace(board, piece.shape, originRow, originCol);
      const next: DragState = { piece, trayIndex, clientX, clientY, offsetY, originRow, originCol, valid };
      draggingRef.current = next;
      setDragging(next);
    };
    update(e.clientX, e.clientY);

    function onMove(ev: PointerEvent) {
      update(ev.clientX, ev.clientY);
    }
    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    }
    function onUp() {
      cleanup();
      const cur = draggingRef.current;
      draggingRef.current = null;
      setDragging(null);
      if (cur && cur.valid && !quizActiveRef.current) {
        commitPlacement(cur.piece, cur.trayIndex, cur.originRow, cur.originCol);
      }
    }
    function onCancel() {
      cleanup();
      draggingRef.current = null;
      setDragging(null);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  const previewCells = new Set<string>();
  if (dragging) {
    for (const [dr, dc] of dragging.piece.shape) {
      const r = dragging.originRow + dr;
      const c = dragging.originCol + dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) previewCells.add(`${r},${c}`);
    }
  }

  const progressPct = Math.min(100, Math.round((collected / GOAL) * 100));

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-2"
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
          🧱 積木消除
        </span>
        <div className="flex items-center gap-2">
          {!gameOver && quiz === null && (
            <button
              type="button"
              onClick={() => setThemePickerOpen(true)}
              title="積木主題"
              aria-label="積木主題"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
            >
              🎨
            </button>
          )}
          <Link
            href="/games/block-puzzle/settings"
            aria-label="遊戲設定"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
          >
            ⚙️
          </Link>
          {!gameOver && quiz === null && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              title={paused ? '繼續' : '暫停'}
              aria-label={paused ? '繼續' : '暫停'}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
            >
              {paused ? '▶' : '⏸'}
            </button>
          )}
        </div>
      </div>

      {/* Play area */}
      <div
        ref={playAreaRef}
        className="relative flex w-full flex-col items-center gap-3"
        style={{ maxWidth: BOARD_MAX_PX }}
      >
        {/* Score row */}
        <div className="flex w-full items-center justify-between gap-3">
          <div
            className="flex-1 rounded-xl px-3 py-1.5 text-center text-lg font-black"
            style={{ background: 'rgba(34,197,94,0.18)', color: '#4ade80', border: '2px solid rgba(34,197,94,0.4)' }}
          >
            👑 {bestScore.toLocaleString()}
          </div>
          <div
            className="flex-1 rounded-xl px-3 py-1.5 text-center text-lg font-black text-white"
            style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)' }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Progress + combo */}
        <div className="flex w-full items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressPct}%`, background: '#ffcc33' }}
            />
          </div>
          <span className="text-xs font-bold text-zinc-400">
            {collected}/{GOAL}
          </span>
          <span className="text-xs font-bold" style={{ color: '#ffcc33' }}>
            ×{Math.max(combo, 1)}
          </span>
        </div>

        {/* Board */}
        <div
          ref={boardRef}
          className={`grid w-full rounded-lg ${shaking ? 'stage-shake' : ''}`}
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gap: '3px',
            aspectRatio: '1 / 1',
            background: '#0f1a3d',
            border: '2px solid #2d3a6e',
            padding: '4px',
            touchAction: 'none',
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`;
              const flashing = flashCells.has(key);
              const inPreview = previewCells.has(key);
              const visual = cell.filled ? cellVisualStyle(theme, cell.colorIndex) : null;
              const emoji = cell.filled ? cellEmoji(theme, cell.colorIndex, cell.special) : null;
              return (
                <div
                  key={key}
                  className="relative rounded-[5px] transition-transform duration-200"
                  style={{
                    background: visual ? visual.background : 'rgba(255,255,255,0.05)',
                    boxShadow: visual ? visual.boxShadow : undefined,
                    transform: flashing ? 'scale(1.15)' : 'scale(1)',
                    opacity: flashing ? 0.4 : 1,
                  }}
                >
                  {emoji && (
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ fontSize: '60%' }}
                    >
                      {emoji}
                    </span>
                  )}
                  {inPreview && (
                    <div
                      className="absolute inset-0 rounded-[5px]"
                      style={{
                        background: dragging?.valid ? 'rgba(74,222,128,0.55)' : 'rgba(239,68,68,0.55)',
                        border: `2px solid ${dragging?.valid ? '#4ade80' : '#ef4444'}`,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Tray — each slot shrinks its own piece to fit (trayFitCellPx), so
            large shapes never spill into the next slot; the dragged piece
            is rendered at full TRAY_CELL_PX size instead (see the floating
            ghost below), i.e. it "grows back" the moment you pick it up. */}
        <div className="flex w-full items-center justify-center gap-2 py-2 sm:gap-4">
          {tray.map((piece, i) => (
            <div
              key={piece ? piece.id : `empty-${i}`}
              className="flex aspect-square max-w-24 flex-1 items-center justify-center overflow-hidden rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                touchAction: 'none',
                opacity: dragging?.trayIndex === i ? 0.2 : 1,
              }}
              onPointerDown={piece ? (e) => handleTrayPointerDown(e, i) : undefined}
            >
              {piece && (
                <ShapePreview
                  shape={piece.shape}
                  colorIndex={piece.colorIndex}
                  theme={theme}
                  specialCellIndex={piece.specialCellIndex}
                  cellPx={trayFitCellPx(piece.shape)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Paused overlay */}
        {paused && !gameOver && quiz === null && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/80">
            <p className="text-3xl font-black" style={{ color: '#ffcc33' }}>
              PAUSED
            </p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="rounded-full px-6 py-2 text-sm font-bold text-zinc-900"
              style={{ background: '#ffcc33' }}
            >
              ▶ 繼續
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-lg bg-black/85">
            <p className="text-3xl font-black text-red-400">GAME OVER</p>
            <p className="text-lg text-zinc-300">
              Score: <span className="font-bold text-white">{score.toLocaleString()}</span>
            </p>
            {bestScore > 0 && (
              <p className="text-sm text-zinc-400">
                Best: <span style={{ color: '#ffcc33' }}>{bestScore.toLocaleString()}</span>
              </p>
            )}
            <button
              type="button"
              onClick={restart}
              className="rounded-full px-6 py-2 text-sm font-bold text-zinc-900"
              style={{ background: '#ffcc33' }}
            >
              🔄 Play Again
            </button>
          </div>
        )}

        {/* Vocabulary quiz overlay */}
        {quiz && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg p-4"
            style={{ background: 'rgba(11,17,48,0.96)' }}
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

        {/* Theme picker overlay */}
        {themePickerOpen && !quiz && !gameOver && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg p-4"
            style={{ background: 'rgba(11,17,48,0.96)' }}
          >
            <div className="text-lg font-black" style={{ color: '#ffcc33' }}>
              🎨 積木主題
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>
              收集貓爪印記可以解鎖新主題（目前累積 {lifetimeCollected} 個）
            </div>
            <div className="grid w-full max-w-xs grid-cols-2 gap-2">
              {BLOCK_THEMES.map((t) => {
                const unlocked = isThemeUnlocked(t, lifetimeCollected);
                const selected = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setBlockPuzzleTheme(t.id)}
                    className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center"
                    style={{
                      background: selected ? 'rgba(255,204,51,0.2)' : 'rgba(255,255,255,0.06)',
                      border: selected ? '2px solid #ffcc33' : '2px solid rgba(255,255,255,0.12)',
                      opacity: unlocked ? 1 : 0.45,
                    }}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-xs font-bold text-white">{t.name}</span>
                    <span className="text-[10px]" style={{ color: '#94a3b8' }}>
                      {unlocked ? (selected ? '使用中' : '點擊使用') : `集滿 ${t.unlockAt} 個解鎖`}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setThemePickerOpen(false)}
              className="mt-1 rounded-full px-6 py-2 text-sm font-bold text-zinc-900"
              style={{ background: '#ffcc33' }}
            >
              關閉
            </button>
          </div>
        )}

        {/* Clear-pop particles */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="bp-particle"
            style={
              {
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                background: p.color,
                '--bp-tx': `${p.tx}px`,
                '--bp-ty': `${p.ty}px`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* DOUBLE! / TRIPLE! / MEGA CLEAR! callout */}
        {callout && (
          <div
            key={callout.id}
            className="bp-callout text-2xl font-black sm:text-3xl"
            style={{ left: '50%', top: '45%', color: '#ffcc33', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}
          >
            {callout.text}
          </div>
        )}

        {/* Paw-collect "+1" floats */}
        {collectFloats.map((f) => (
          <div
            key={f.id}
            className="bp-collect-float text-sm font-black"
            style={{ left: f.x, top: f.y, color: '#4ade80' }}
          >
            🐾 +1
          </div>
        ))}
      </div>

      {/* Floating drag ghost */}
      {dragging && (
        <div
          style={{
            position: 'fixed',
            left: dragging.clientX,
            top: dragging.clientY - dragging.offsetY,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 50,
            opacity: 0.9,
          }}
        >
          <ShapePreview
            shape={dragging.piece.shape}
            colorIndex={dragging.piece.colorIndex}
            theme={theme}
            specialCellIndex={dragging.piece.specialCellIndex}
            cellPx={TRAY_CELL_PX * 1.3}
          />
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">拖曳積木到棋盤上，填滿一整行或一整列就會消除！</p>
    </div>
  );
}
