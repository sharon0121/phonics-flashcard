'use client';

import { useEffect, useRef, useState } from 'react';
import {
  generateProblemSet,
  ROWS_OPTIONS,
  NUMBER_RANGE_OPTIONS,
  type AbacusProblem,
  type AbacusRows,
  type AbacusNumberRange,
} from '@/lib/abacus';
import { useAbacusHistory, addHistoryEntry, removeHistoryEntry } from '@/lib/abacusHistory';
import { confirmHistoryDeletePassword } from '@/lib/historyDelete';
import CountdownRing from '@/components/CountdownRing';
import NumberKeypad from '@/components/NumberKeypad';
import MathSubNav from '@/components/MathSubNav';
import ScoreCelebration from '@/components/ScoreCelebration';

const PROBLEM_COUNT = 10;
const TIME_LIMIT_SECONDS = 10 * 60;
const MAX_ANSWER_DIGITS = 3;

type Phase = 'idle' | 'running' | 'submitted';

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

// Older history entries were saved before 數字大小 existed, so this falls
// back to the original single-digit behavior when the field is missing.
function formatNumberRangeLabel(maxValue: number | undefined): string {
  const match = NUMBER_RANGE_OPTIONS.find((opt) => opt.value === (maxValue ?? 9));
  return match?.label ?? '個位數';
}

export default function AbacusPracticeView() {
  const [rows, setRows] = useState<AbacusRows>(7);
  const [numberRange, setNumberRange] = useState<AbacusNumberRange>(9);
  const [problems, setProblems] = useState<AbacusProblem[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState(TIME_LIMIT_SECONDS);
  const [score, setScore] = useState<number | null>(null);
  const history = useAbacusHistory();

  // Always-fresh snapshot for the timer's auto-submit path, so a keystroke
  // right before time runs out is still included without re-scheduling the
  // 1-second tick on every keystroke (which would stall the countdown).
  const latestRef = useRef({ problems, answers, rows, numberRange });
  useEffect(() => {
    latestRef.current = { problems, answers, rows, numberRange };
  });

  function finishRound() {
    const { problems: p, answers: a, rows: r, numberRange: nr } = latestRef.current;
    const finalScore = p.reduce(
      (count, prob, i) => (a[i]?.trim() !== '' && Number(a[i]) === prob.answer ? count + 1 : count),
      0
    );
    setScore(finalScore);
    setPhase('submitted');
    setActiveIndex(null);
    addHistoryEntry({ timestamp: Date.now(), rows: r, maxValue: nr, score: finalScore, total: PROBLEM_COUNT });
  }

  useEffect(() => {
    if (phase !== 'running' || remainingSeconds <= 0) return;
    const timer = setTimeout(() => {
      setRemainingSeconds((s) => {
        const next = s - 1;
        if (next <= 0) finishRound();
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, remainingSeconds]);

  function startNewRound() {
    setProblems(generateProblemSet(PROBLEM_COUNT, rows, numberRange));
    setAnswers(Array.from({ length: PROBLEM_COUNT }, () => ''));
    setActiveIndex(0);
    setRemainingSeconds(TIME_LIMIT_SECONDS);
    setScore(null);
    setPhase('running');
  }

  // Abandons the round without grading it or recording history — distinct
  // from 交卷, which submits whatever's been answered so far for scoring.
  function cancelRound() {
    setPhase('idle');
    setProblems([]);
    setAnswers([]);
    setActiveIndex(null);
    setScore(null);
  }

  function appendDigit(digit: string) {
    if (activeIndex === null) return;
    setAnswers((prev) => {
      const next = [...prev];
      if (next[activeIndex].length < MAX_ANSWER_DIGITS) next[activeIndex] += digit;
      return next;
    });
  }

  function backspace() {
    if (activeIndex === null) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[activeIndex] = next[activeIndex].slice(0, -1);
      return next;
    });
  }

  function clearActive() {
    if (activeIndex === null) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[activeIndex] = '';
      return next;
    });
  }

  function handleDeleteHistory(timestamp: number) {
    if (!confirmHistoryDeletePassword()) return;
    removeHistoryEntry(timestamp);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <MathSubNav />
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">珠算練習</h1>
      <p className="mt-1 text-sm text-zinc-300">用實體算盤計算，再用數字鍵盤把答案輸入下方對答案。</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">行數（口數）</span>
        {ROWS_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={phase === 'running'}
            onClick={() => setRows(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              rows === r
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {r} 行
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">數字大小</span>
        {NUMBER_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={phase === 'running'}
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

      {phase === 'idle' ? (
        <button
          type="button"
          onClick={startNewRound}
          className="mt-6 rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
        >
          開始新的一回（10 題．10 分鐘）
        </button>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <CountdownRing totalSeconds={TIME_LIMIT_SECONDS} remainingSeconds={remainingSeconds} />
            {phase === 'running' && (
              <>
                <button
                  type="button"
                  onClick={finishRound}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  <span aria-hidden>✅</span>交卷
                </button>
                <button
                  type="button"
                  onClick={cancelRound}
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/20"
                >
                  <span aria-hidden>❌</span>取消
                </button>
              </>
            )}
            {phase === 'submitted' && score !== null && (
              <div className="text-lg font-bold text-[var(--hero-gold)]">
                答對 {score} / {PROBLEM_COUNT} 題
              </div>
            )}
          </div>

          {phase === 'submitted' && score !== null && (
            <ScoreCelebration score={score} total={PROBLEM_COUNT} />
          )}

          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {problems.map((p, i) => {
              const isCorrect =
                phase === 'submitted' && answers[i].trim() !== '' && Number(answers[i]) === p.answer;
              const isWrong = phase === 'submitted' && !isCorrect;
              const isActive = phase === 'running' && activeIndex === i;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center rounded-xl border-[3px] bg-white p-4 text-zinc-900 ${
                    isCorrect
                      ? 'border-emerald-400'
                      : isWrong
                        ? 'border-red-400'
                        : isActive
                          ? 'border-[var(--hero-gold)]'
                          : 'border-zinc-900'
                  }`}
                >
                  <span className="mb-1 text-xs font-bold text-zinc-400">No.{i + 1}</span>
                  <div className="flex flex-col items-end gap-0.5 font-mono text-2xl leading-relaxed">
                    {p.terms.map((t, j) => (
                      <span key={j}>{t}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={phase !== 'running'}
                    onClick={() => setActiveIndex(i)}
                    className={`mt-3 flex h-12 w-full items-center justify-center rounded-md border-2 text-xl font-bold transition-colors disabled:cursor-not-allowed ${
                      isActive ? 'border-[var(--hero-gold)] bg-yellow-50' : 'border-zinc-300 bg-zinc-50'
                    }`}
                  >
                    {answers[i] ? answers[i] : <span className="text-zinc-300">－</span>}
                  </button>
                  {isWrong && <span className="mt-1 text-xs text-red-500">正解：{p.answer}</span>}
                  {isActive && (
                    <div className="mt-3">
                      <NumberKeypad onDigit={appendDigit} onBackspace={backspace} onClear={clearActive} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'submitted' && (
            <button
              type="button"
              onClick={startNewRound}
              className="mt-6 rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              再一回
            </button>
          )}
        </>
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
                  {h.rows} 行．{formatNumberRangeLabel(h.maxValue)}
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
