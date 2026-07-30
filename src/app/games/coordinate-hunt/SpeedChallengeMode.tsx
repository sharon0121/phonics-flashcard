'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GRID_COLS,
  GRID_ROWS,
  samePosition,
  shuffle,
  type GridPosition,
} from '@/lib/coordinateHunt';
import {
  useCoordTermCount,
  useCoordMaxValue,
  useCoordTimeLimit,
  TERM_COUNT_OPTIONS,
  TIME_LIMIT_OPTIONS,
} from '@/lib/coordinateHuntSettings';
import { generateProblemSet, type AbacusProblem } from '@/lib/abacus';
import { playDingSound, playErrorSound } from '@/lib/sound';
import {
  getLeaderboard,
  qualifiesForLeaderboard,
  addToLeaderboard,
  type LeaderboardEntry,
} from '@/lib/coordinateHuntHistory';
import DPad from '@/components/DPad';

const START_POSITION: GridPosition = { col: 0, row: 0 };
const MEDAL = ['🥇', '🥈', '🥉'];

type Stage = 'idle' | 'playing' | 'roundSuccess' | 'finished';

interface MathRound {
  problem: AbacusProblem;
  gridNumbers: number[];
  answerPos: GridPosition;
}

function buildMathGrid(answer: number): { gridNumbers: number[]; answerPos: GridPosition } {
  const total = GRID_COLS * GRID_ROWS;
  const used = new Set([answer]);
  const pool: number[] = [];
  let offset = 1;
  while (pool.length < total - 1 && offset < 500) {
    const below = answer - offset;
    const above = answer + offset;
    if (below >= 1 && !used.has(below)) { used.add(below); pool.push(below); }
    if (pool.length < total - 1 && !used.has(above)) { used.add(above); pool.push(above); }
    offset++;
  }
  const all = shuffle([answer, ...pool.slice(0, total - 1)]);
  const idx = all.indexOf(answer);
  return { gridNumbers: all, answerPos: { col: idx % GRID_COLS, row: Math.floor(idx / GRID_COLS) } };
}

function makeRound(termCount: number, maxValue: number): MathRound {
  const problem = generateProblemSet(1, termCount, maxValue)[0];
  const { gridNumbers, answerPos } = buildMathGrid(problem.answer);
  return { problem, gridNumbers, answerPos };
}

function formatProblem(terms: number[]): string {
  return terms.map((t, i) => (i === 0 ? String(t) : t < 0 ? ` − ${-t}` : ` + ${t}`)).join('') + ' = ?';
}

function difficultyLabel(termCount: number, timeLimit: number): string {
  const terms = TERM_COUNT_OPTIONS.find((n) => n === termCount) ?? termCount;
  const time = TIME_LIMIT_OPTIONS.find((o) => o.value === timeLimit);
  return `${terms} 個數字 × ${time?.label ?? `${timeLimit}s`}`;
}

interface Props {
  onBack: () => void;
}

export default function SpeedChallengeMode({ onBack }: Props) {
  const termCount = useCoordTermCount();
  const maxValue = useCoordMaxValue();
  const timeLimit = useCoordTimeLimit();

  const [stage, setStage] = useState<Stage>('idle');
  const [round, setRound] = useState<MathRound | null>(null);
  const [player, setPlayer] = useState<GridPosition>(START_POSITION);
  const [dugCells, setDugCells] = useState<GridPosition[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit);
  const [digFeedback, setDigFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gameActive, setGameActive] = useState(false);

  // Record entry
  const [recordName, setRecordName] = useState('');
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Reload leaderboard whenever idle (settings may have changed difficulty)
  useEffect(() => {
    if (stage === 'idle') {
      setLeaderboard(getLeaderboard(termCount, timeLimit));
      setTimeLeft(timeLimit);
    }
  }, [stage, termCount, timeLimit]);

  // Single continuous interval — never restarts between rounds
  useEffect(() => {
    if (!gameActive) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [gameActive]);

  // Detect timer hitting 0
  useEffect(() => {
    if (gameActive && timeLeft === 0) {
      setGameActive(false);
      setStage('finished');
    }
  }, [gameActive, timeLeft]);

  // Check record when finished
  useEffect(() => {
    if (stage !== 'finished') return;
    const board = getLeaderboard(termCount, timeLimit);
    setLeaderboard(board);
    setIsNewRecord(qualifiesForLeaderboard(score, termCount, timeLimit));
    setRecordName('');
  }, [stage, score, termCount, timeLimit]);

  // Auto-advance roundSuccess → next round
  useEffect(() => {
    if (stage !== 'roundSuccess') return;
    const t = setTimeout(() => {
      setRound(makeRound(termCount, maxValue));
      setPlayer(START_POSITION);
      setDugCells([]);
      setDigFeedback(null);
      setStage('playing');
    }, 600);
    return () => clearTimeout(t);
  }, [stage, termCount, maxValue]);

  function startGame() {
    setRound(makeRound(termCount, maxValue));
    setPlayer(START_POSITION);
    setDugCells([]);
    setScore(0);
    setTimeLeft(timeLimit);
    setDigFeedback(null);
    setGameActive(true);
    setStage('playing');
  }

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (stage !== 'playing' || digFeedback) return;
    setPlayer((prev) => {
      let { col, row } = prev;
      if (dir === 'up') row = Math.max(0, row - 1);
      if (dir === 'down') row = Math.min(GRID_ROWS - 1, row + 1);
      if (dir === 'left') col = Math.max(0, col - 1);
      if (dir === 'right') col = Math.min(GRID_COLS - 1, col + 1);
      return { col, row };
    });
  }, [stage, digFeedback]);

  const handleDig = useCallback(() => {
    if (stage !== 'playing' || digFeedback || !round) return;
    if (dugCells.some((p) => samePosition(p, player))) return;
    setDugCells((prev) => [...prev, player]);
    if (samePosition(player, round.answerPos)) {
      playDingSound();
      setScore((s) => s + 1);
      setDigFeedback('correct');
      setStage('roundSuccess');
    } else {
      playErrorSound();
      setDigFeedback('wrong');
      setTimeout(() => setDigFeedback(null), 600);
    }
  }, [stage, digFeedback, round, dugCells, player]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (stage !== 'playing') return;
      if (e.key === 'ArrowUp') { e.preventDefault(); move('up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move('down'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move('right'); }
      else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); handleDig(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, handleDig, stage]);

  function submitRecord() {
    const updated = addToLeaderboard(recordName, score, termCount, timeLimit);
    setLeaderboard(updated);
    setIsNewRecord(false);
  }

  const timerColor = timeLeft <= 30 ? 'text-red-500' : timeLeft <= 60 ? 'text-yellow-400' : 'text-emerald-400';
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  const showMath = stage === 'playing' || stage === 'roundSuccess';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <Link
          href="/games/coordinate-hunt/settings"
          aria-label="遊戲設定"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
        >
          ⚙️
        </Link>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-2xl">⚡</span>
        <h2 className="text-xl font-bold text-[var(--hero-gold)]">速度挑戰</h2>
      </div>

      {/* IDLE */}
      {stage === 'idle' && (
        <>
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p className="text-zinc-300">在時間內解越多心算題越好！答錯不扣分，只是浪費時間。</p>
            <p className="text-xs text-zinc-400">當前難度：{difficultyLabel(termCount, timeLimit)}</p>
            <button type="button" onClick={startGame}
              className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
            >
              開始挑戰
            </button>
          </div>

          <Leaderboard entries={leaderboard} termCount={termCount} timeLimit={timeLimit} />
        </>
      )}

      {/* PLAYING / ROUND SUCCESS */}
      {showMath && round && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <span className={`text-2xl font-bold tabular-nums ${timerColor}`}>{mins}:{secs}</span>
            <span className="text-lg font-bold text-zinc-300">✅ {score} 題</span>
          </div>

          <div className={`mt-3 rounded-xl border-2 bg-white/95 p-4 text-center transition-colors ${
            digFeedback === 'correct' || stage === 'roundSuccess' ? 'border-emerald-400'
              : digFeedback === 'wrong' ? 'border-red-400' : 'border-[var(--hero-gold)]'
          }`}>
            <p className="text-3xl font-bold tabular-nums text-zinc-900">
              {formatProblem(round.problem.terms)}
            </p>
            {(digFeedback === 'correct' || stage === 'roundSuccess') && (
              <p className="mt-2 text-lg font-bold text-emerald-500">✨ Correct!</p>
            )}
            {digFeedback === 'wrong' && (
              <p className="mt-2 text-lg font-bold text-red-500">❌ Try again!</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-center gap-6">
            <div className="inline-block rounded-2xl border-[3px] border-zinc-900 bg-white p-3 shadow-md">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
                {round.gridNumbers.map((num, idx) => {
                  const pos: GridPosition = { col: idx % GRID_COLS, row: Math.floor(idx / GRID_COLS) };
                  const isPlayer = samePosition(player, pos);
                  const wasDug = dugCells.some((p) => samePosition(p, pos));
                  const wasCorrect = wasDug && samePosition(pos, round.answerPos);
                  return (
                    <div key={idx} className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 text-xl font-bold transition-colors sm:h-16 sm:w-16 sm:text-2xl ${
                      isPlayer ? 'border-[var(--hero-gold)] bg-yellow-100 ring-2 ring-[var(--hero-gold)]'
                        : wasCorrect ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                          : wasDug ? 'border-red-200 bg-red-50 text-red-300 line-through'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-800'
                    }`}>
                      {isPlayer ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/heroes/cutout-game.png" alt="player" className="h-full w-full animate-bounce object-contain drop-shadow-md" />
                      ) : num}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <DPad
                disabled={stage !== 'playing'}
                onUp={() => move('up')}
                onDown={() => move('down')}
                onLeft={() => move('left')}
                onRight={() => move('right')}
              />
              <button
                type="button"
                disabled={stage !== 'playing' || !!digFeedback}
                onClick={handleDig}
                className="w-full rounded-xl bg-[var(--hero-red)] py-3 text-lg font-bold text-white shadow hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⛏️ Dig!
              </button>
              <p className="text-center text-xs text-zinc-400">Space bar also digs</p>
            </div>
          </div>
        </>
      )}

      {/* FINISHED */}
      {stage === 'finished' && (
        <>
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <div className="animate-bounce text-6xl">⏰</div>
            <h2 className="text-2xl font-bold text-[var(--hero-gold)]">時間到！</h2>
            <p className="text-zinc-300">
              完成了{' '}
              <span className="text-3xl font-bold text-[var(--hero-gold)]">{score}</span> 題！
            </p>

            {isNewRecord ? (
              <div className="mt-2 w-full max-w-xs rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
                <p className="text-center text-lg font-bold text-[var(--hero-red)]">🎉 進入英雄榜！</p>
                <p className="mt-1 text-center text-sm text-zinc-500">請輸入挑戰者名稱：</p>
                <input
                  type="text"
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRecord(); }}
                  placeholder="名字"
                  maxLength={12}
                  className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-zinc-900"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={submitRecord}
                  className="mt-3 w-full rounded-lg bg-[var(--hero-red)] py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
                >
                  確認登錄
                </button>
              </div>
            ) : (
              <button type="button" onClick={startGame}
                className="rounded-xl bg-[var(--hero-red)] px-8 py-3 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
              >
                再挑戰
              </button>
            )}
          </div>

          <Leaderboard entries={leaderboard} termCount={termCount} timeLimit={timeLimit} />

          {!isNewRecord && (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => setStage('idle')}
                className="text-sm text-zinc-400 hover:underline"
              >
                回到主畫面
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Leaderboard sub-component ────────────────────────────────────────────────

function Leaderboard({
  entries,
  termCount,
  timeLimit,
}: {
  entries: LeaderboardEntry[];
  termCount: number;
  timeLimit: number;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-[var(--hero-gold)]">🏆 英雄榜</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400">
          {difficultyLabel(termCount, timeLimit)}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">還沒有紀錄，快來挑戰！</p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map((e, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              i === 0 ? 'bg-yellow-400/20 text-zinc-100' : 'bg-white/5 text-zinc-300'
            }`}>
              <span className="flex items-center gap-2">
                <span className="w-6 text-center text-base">{MEDAL[i] ?? `${i + 1}.`}</span>
                <span className="font-bold">{e.name}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-bold text-[var(--hero-gold)]">{e.score} 題</span>
                <span className="text-xs text-zinc-500">{e.date}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
