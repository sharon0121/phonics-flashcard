'use client';

import { useState } from 'react';
import { generateProblemSet, NUMBER_RANGE_OPTIONS, type AbacusProblem, type AbacusNumberRange } from '@/lib/abacus';
import { useMentalMathDayInfo } from '@/lib/mentalMath';
import {
  useMentalMathHistory,
  addMentalMathHistoryEntry,
  removeMentalMathHistoryEntry,
} from '@/lib/mentalMathHistory';
import { confirmHistoryDeletePassword } from '@/lib/historyDelete';
import MathSubNav from '@/components/MathSubNav';
import FullLineRound from './FullLineRound';
import FlashRound from './FlashRound';

const PROBLEM_COUNT = 10;
const TIME_LIMIT_SECONDS = 3 * 60;
const TERM_COUNT_OPTIONS = [3, 4] as const;

type DisplayMode = 'flash' | 'full';

const MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: 'flash', label: '逐口閃示' },
  { value: 'full', label: '整行列出' },
];

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

function formatNumberRangeLabel(maxValue: number | undefined): string {
  const match = NUMBER_RANGE_OPTIONS.find((opt) => opt.value === (maxValue ?? 9));
  return match?.label ?? '個位數';
}

export default function MentalMathView() {
  const { day: dayNumber, termCount: recommendedTermCount } = useMentalMathDayInfo();
  const [mode, setMode] = useState<DisplayMode>('flash');
  const [termCount, setTermCount] = useState<(typeof TERM_COUNT_OPTIONS)[number]>(3);
  const [numberRange, setNumberRange] = useState<AbacusNumberRange>(9);
  const [roundActive, setRoundActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [problems, setProblems] = useState<AbacusProblem[]>([]);
  const history = useMentalMathHistory();

  function startNewRound() {
    setProblems(generateProblemSet(PROBLEM_COUNT, termCount, numberRange));
    setRoundKey((k) => k + 1);
    setRoundActive(true);
    setFinished(false);
  }

  function handleRoundFinish(score: number) {
    addMentalMathHistoryEntry({
      timestamp: Date.now(),
      terms: termCount,
      maxValue: numberRange,
      mode,
      score,
      total: PROBLEM_COUNT,
    });
    setFinished(true);
  }

  function handleRoundCancel() {
    setRoundActive(false);
    setFinished(false);
  }

  function handleDeleteHistory(timestamp: number) {
    if (!confirmHistoryDeletePassword()) return;
    removeMentalMathHistoryEntry(timestamp);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <MathSubNav />
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">心算練習</h1>
      <p className="mt-1 text-sm text-zinc-300">
        第 {dayNumber} 天．課程建議 {recommendedTermCount} 口（可自行調整下方設定）
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">出題方式</span>
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={roundActive}
            onClick={() => setMode(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === opt.value
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">行數（口數）</span>
        {TERM_COUNT_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={roundActive}
            onClick={() => setTermCount(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              termCount === t
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {t} 口
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">數字大小</span>
        {NUMBER_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={roundActive}
            onClick={() => setNumberRange(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              numberRange === opt.value
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!roundActive && (
        <button
          type="button"
          onClick={startNewRound}
          className="mt-6 rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
        >
          開始新的一回（10 題．3 分鐘）
        </button>
      )}

      {roundActive &&
        (mode === 'full' ? (
          <FullLineRound
            key={roundKey}
            problems={problems}
            timeLimitSeconds={TIME_LIMIT_SECONDS}
            onFinish={handleRoundFinish}
            onCancel={handleRoundCancel}
          />
        ) : (
          <FlashRound
            key={roundKey}
            problems={problems}
            timeLimitSeconds={TIME_LIMIT_SECONDS}
            onFinish={handleRoundFinish}
            onCancel={handleRoundCancel}
          />
        ))}

      {finished && (
        <button
          type="button"
          onClick={startNewRound}
          className="mt-6 rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
        >
          再一回
        </button>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">歷史成績</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">尚無測驗紀錄。</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {[...history].reverse().map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-200"
              >
                <span>{formatTimestamp(h.timestamp)}</span>
                <span>
                  {h.terms} 口．{formatNumberRangeLabel(h.maxValue)}．
                  {h.mode === 'flash' ? '逐口閃示' : '整行列出'}
                </span>
                <span className="font-bold text-[var(--hero-gold)]">
                  答對 {h.score} / {h.total}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(h.timestamp)}
                  aria-label="刪除這筆紀錄"
                  className="ml-2 rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-red-400"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
