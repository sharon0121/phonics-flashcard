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
import { useBlockPuzzleBestScore, reportBlockPuzzleScore, useBlockPuzzleQuizWords } from '@/lib/blockPuzzleSettings';
import { useSpeechRate, SPEECH_RATE_VALUES } from '@/lib/heroClimbSettings';
import { playCollectSound, playErrorSound, playChainPopSound, playCelebrationChime } from '@/lib/sound';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';

const GOAL = 25;
const BOARD_MAX_PX = 420;
const TRAY_CELL_PX = 30;
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
  color,
  specialCellIndex,
  cellPx,
}: {
  shape: Shape;
  color: string;
  specialCellIndex: number | null;
  cellPx: number;
}) {
  const { rows, cols } = shapeSize(shape);
  return (
    <div style={{ position: 'relative', width: cols * cellPx, height: rows * cellPx }}>
      {shape.map(([r, c], i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-[5px]"
          style={{
            position: 'absolute',
            left: c * cellPx,
            top: r * cellPx,
            width: cellPx - 3,
            height: cellPx - 3,
            background: color,
            boxShadow: 'inset 2px 2px 3px rgba(255,255,255,0.4), inset -2px -2px 3px rgba(0,0,0,0.35)',
          }}
        >
          {i === specialCellIndex && <span style={{ fontSize: cellPx * 0.55 }}>🐾</span>}
        </div>
      ))}
    </div>
  );
}

export default function BlockPuzzleView() {
  const boardRef = useRef<HTMLDivElement>(null);
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
    setTimeout(() => speakZh(quiz.question.word.zh), 350);
    setQuiz({ ...quiz, feedback: correct ? 'correct' : 'wrong', selectedId: choice.id });
  }

  useEffect(() => {
    if (!quiz || quiz.feedback) return;
    const t = setTimeout(() => speak(quiz.question.word.word, speechRate), 200);
    return () => clearTimeout(t);
  }, [quiz, speechRate]);

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
          return null;
        }
        return { question: nextQuestion, streak: nextStreak, feedback: null, selectedId: null };
      });
    }, 1100);
    return () => clearTimeout(t);
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

  function commitPlacement(piece: Piece, trayIndex: number, originRow: number, originCol: number) {
    const placedBoard = placeShape(board, piece.shape, originRow, originCol, piece.color, piece.specialCellIndex);
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
      if (linesCleared >= 2) playCelebrationChime();
      else playChainPopSound(linesCleared);

      setTimeout(() => {
        const bonus = clearScore(linesCleared, newCombo);
        setBoard(clearInfo.board);
        setScore((s) => s + bonus);
        setFlashCells(new Set());
        if (clearInfo.specialCollected > 0) {
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
      <div className="relative flex w-full flex-col items-center gap-3" style={{ maxWidth: BOARD_MAX_PX }}>
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
          className="grid w-full rounded-lg"
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
              return (
                <div
                  key={key}
                  className="relative rounded-[5px] transition-transform duration-200"
                  style={{
                    background: cell.filled ? cell.color : 'rgba(255,255,255,0.05)',
                    boxShadow: cell.filled
                      ? 'inset 2px 2px 3px rgba(255,255,255,0.35), inset -2px -2px 3px rgba(0,0,0,0.3)'
                      : undefined,
                    transform: flashing ? 'scale(1.15)' : 'scale(1)',
                    opacity: flashing ? 0.4 : 1,
                  }}
                >
                  {cell.special && (
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ fontSize: '60%' }}
                    >
                      🐾
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

        {/* Tray */}
        <div className="flex w-full items-center justify-center gap-4 py-2">
          {tray.map((piece, i) => (
            <div
              key={piece ? piece.id : `empty-${i}`}
              className="flex h-24 w-24 items-center justify-center rounded-xl"
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
                  color={piece.color}
                  specialCellIndex={piece.specialCellIndex}
                  cellPx={TRAY_CELL_PX}
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
            color={dragging.piece.color}
            specialCellIndex={dragging.piece.specialCellIndex}
            cellPx={TRAY_CELL_PX * 1.3}
          />
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">拖曳積木到棋盤上，填滿一整行或一整列就會消除！</p>
    </div>
  );
}
