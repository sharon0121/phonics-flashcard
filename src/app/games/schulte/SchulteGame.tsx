'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  itemsForCategory,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  type SchulteCategory,
} from '@/data/schulteContent';
import {
  useSchulteGridDim,
  useSchulteMode,
  useSchulteTimeLimit,
  useSchulteNumberCount,
} from '@/lib/schulteSettings';
import {
  useSchulteLeaderboard,
  useLastSchultePlayerName,
  setLastSchultePlayerName,
  qualifiesForSchulteLeaderboard,
  addToSchulteLeaderboard,
} from '@/lib/schulteHistory';
import { playCollectSound, playErrorSound, playCelebrationChime } from '@/lib/sound';

interface Cell {
  label: string;
  seqIndex: number;
}

type Stage = 'idle' | 'playing' | 'success' | 'failed';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

interface Props {
  category: SchulteCategory;
  onBack: () => void;
}

export default function SchulteGame({ category, onBack }: Props) {
  const gridDim = useSchulteGridDim();
  const mode = useSchulteMode();
  const timeLimitSec = useSchulteTimeLimit();
  const numberCount = useSchulteNumberCount();
  const leaderboard = useSchulteLeaderboard(category, gridDim);
  const lastPlayerName = useLastSchultePlayerName();

  const sequence = itemsForCategory(category, numberCount);
  const cellsPerBatch = gridDim * gridDim;

  const [stage, setStage] = useState<Stage>('idle');
  const [batchIndex, setBatchIndex] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [wrongId, setWrongId] = useState<number | null>(null);
  const [displayMs, setDisplayMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [nameInput, setNameInput] = useState(lastPlayerName);
  const [saved, setSaved] = useState(false);

  const nextIndexRef = useRef(0);
  const startTimeRef = useRef(0);
  const stageRef = useRef<Stage>('idle');
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const buildBatch = useCallback((idx: number) => {
    const start = idx * cellsPerBatch;
    const items = sequence.slice(start, start + cellsPerBatch).map((label, i) => ({ label, seqIndex: start + i }));
    setCells(shuffle(items));
  }, [sequence, cellsPerBatch]);

  useEffect(() => {
    buildBatch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, gridDim, numberCount]);

  // Timer tick — 100ms for a reasonably smooth stopwatch/countdown display.
  useEffect(() => {
    if (stage !== 'playing') return;
    const id = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      if (mode === 'timedLimit') {
        const remaining = timeLimitSec * 1000 - elapsed;
        setDisplayMs(Math.max(0, remaining));
        if (remaining <= 0) {
          setStage('failed');
        }
      } else {
        setDisplayMs(elapsed);
      }
    }, 100);
    return () => clearInterval(id);
  }, [stage, mode, timeLimitSec]);

  function startGame() {
    nextIndexRef.current = 0;
    setNextIndex(0);
    setCompleted(new Set());
    setBatchIndex(0);
    buildBatch(0);
    setSaved(false);
    startTimeRef.current = performance.now();
    setDisplayMs(mode === 'timedLimit' ? timeLimitSec * 1000 : 0);
    setStage('playing');
  }

  function finishSuccess() {
    const elapsed = performance.now() - startTimeRef.current;
    setFinalMs(elapsed);
    playCelebrationChime();
    setStage('success');
  }

  function handleTap(cell: Cell) {
    if (stageRef.current !== 'playing') return;
    if (cell.seqIndex === nextIndexRef.current) {
      playCollectSound();
      setCompleted((prev) => new Set(prev).add(cell.seqIndex));
      const next = nextIndexRef.current + 1;
      nextIndexRef.current = next;
      setNextIndex(next);
      if (next >= sequence.length) {
        finishSuccess();
      } else if (next >= (batchIndex + 1) * cellsPerBatch) {
        const nextBatch = batchIndex + 1;
        setBatchIndex(nextBatch);
        setCompleted(new Set());
        buildBatch(nextBatch);
      }
    } else {
      playErrorSound();
      setWrongId(cell.seqIndex);
      setTimeout(() => setWrongId(null), 300);
    }
  }

  function handleSaveRecord() {
    setLastSchultePlayerName(nameInput);
    addToSchulteLeaderboard(nameInput, finalMs, category, gridDim, Date.now());
    setSaved(true);
  }

  const qualifies = stage === 'success' && qualifiesForSchulteLeaderboard(finalMs, category, gridDim);
  const cols = gridDim;
  const nextLabel = sequence[nextIndex];

  return (
    <div className="relative flex-1 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
      <div className="flex w-full items-center justify-between">
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
        <span className="text-sm font-bold text-[var(--hero-gold)]">
          {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}
        </span>
      </div>

      {stage === 'idle' && (
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-300">
            照順序依序點選（{sequence[0]} → {sequence[sequence.length - 1]}），
            {mode === 'timedLimit' ? `請在 ${timeLimitSec} 秒內按完！` : '看看多快能按完，挑戰你的最佳紀錄！'}
          </p>
          <button
            type="button"
            onClick={startGame}
            className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            開始挑戰
          </button>

          {leaderboard.length > 0 && (
            <div className="mt-2 w-full max-w-xs rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3">
              <p className="text-center text-sm font-bold text-zinc-900">🏆 最佳紀錄</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {leaderboard.slice(0, 5).map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between text-xs text-zinc-700">
                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {r.name}</span>
                    <span className="font-bold tabular-nums">{formatTime(r.timeMs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'playing' && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex w-full max-w-sm items-center justify-between text-sm font-bold text-white">
            <span>下一個：<span className="text-lg text-[var(--hero-gold)]">{nextLabel}</span></span>
            <span className={mode === 'timedLimit' && displayMs <= 10000 ? 'animate-pulse text-[var(--hero-red)]' : ''}>
              ⏱️ {formatTime(displayMs)}
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: 'min(92vw, 26rem)' }}
          >
            {cells.map((cell) => {
              const done = completed.has(cell.seqIndex);
              const wrong = wrongId === cell.seqIndex;
              return (
                <button
                  key={cell.seqIndex}
                  type="button"
                  disabled={done}
                  onClick={() => handleTap(cell)}
                  className={`flex aspect-square items-center justify-center rounded-xl border-2 text-2xl font-extrabold shadow transition-colors sm:text-3xl ${
                    done
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-400'
                      : wrong
                        ? 'animate-pulse border-red-400 bg-red-100 text-red-500'
                        : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {done ? '✓' : cell.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'success' && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="animate-bounce text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-[var(--hero-gold)]">全部按完了！</h2>
          <p className="text-lg font-bold text-white">花費時間：{formatTime(finalMs)}</p>
          {qualifies && !saved && (
            <div className="mt-2 w-full max-w-xs rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
              <p className="text-center text-lg font-bold text-[var(--hero-red)]">🎉 進入最佳紀錄！</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={10}
                placeholder="輸入名字上榜"
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
              <button
                type="button"
                onClick={handleSaveRecord}
                className="mt-2 w-full rounded-md bg-[var(--hero-gold)] px-3 py-2 text-sm font-bold text-zinc-900"
              >
                儲存紀錄
              </button>
            </div>
          )}
          {saved && <p className="text-sm font-bold text-emerald-400">✔️ 已上榜！</p>}
          <button
            type="button"
            onClick={startGame}
            className="mt-2 rounded-xl bg-[var(--hero-red)] px-6 py-3 text-base font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            再玩一次
          </button>
        </div>
      )}

      {stage === 'failed' && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="text-6xl">⏰</div>
          <h2 className="text-2xl font-bold text-[var(--hero-red)]">時間到！</h2>
          <p className="text-sm text-zinc-300">還差一點，再試一次看看！</p>
          <button
            type="button"
            onClick={startGame}
            className="mt-2 rounded-xl bg-[var(--hero-red)] px-6 py-3 text-base font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            再試一次
          </button>
        </div>
      )}
    </div>
  );
}
