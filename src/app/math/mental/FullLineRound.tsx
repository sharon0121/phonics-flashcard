'use client';

import { useEffect, useRef, useState } from 'react';
import type { AbacusProblem } from '@/lib/abacus';
import CountdownRing from '@/components/CountdownRing';
import NumberKeypad from '@/components/NumberKeypad';
import ScoreCelebration from '@/components/ScoreCelebration';

const MAX_ANSWER_DIGITS = 3;

interface FullLineRoundProps {
  problems: AbacusProblem[];
  timeLimitSeconds: number;
  onFinish: (score: number) => void;
  onCancel: () => void;
}

// The "整行列出" mental-math mode: all 10 problems are shown at once, same
// interaction pattern as the abacus practice view (tap a box to target it,
// then use the shared keypad), just with fewer terms per problem.
export default function FullLineRound({ problems, timeLimitSeconds, onFinish, onCancel }: FullLineRoundProps) {
  const [answers, setAnswers] = useState<string[]>(() => Array.from({ length: problems.length }, () => ''));
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  });

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const a = answersRef.current;
    const finalScore = problems.reduce(
      (count, p, i) => (a[i]?.trim() !== '' && Number(a[i]) === p.answer ? count + 1 : count),
      0
    );
    setScore(finalScore);
    setSubmitted(true);
    setActiveIndex(null);
    onFinish(finalScore);
  }

  useEffect(() => {
    if (submitted || remainingSeconds <= 0) return;
    const timer = setTimeout(() => {
      setRemainingSeconds((s) => {
        const next = s - 1;
        if (next <= 0) finish();
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, remainingSeconds]);

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

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <CountdownRing totalSeconds={timeLimitSeconds} remainingSeconds={remainingSeconds} />
        {!submitted && (
          <>
            <button
              type="button"
              onClick={finish}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              <span aria-hidden>✅</span>交卷
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/20"
            >
              <span aria-hidden>❌</span>取消
            </button>
          </>
        )}
        {submitted && score !== null && (
          <div className="text-lg font-bold text-[var(--hero-gold)]">
            答對 {score} / {problems.length} 題
          </div>
        )}
      </div>

      {submitted && score !== null && <ScoreCelebration score={score} total={problems.length} />}

      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {problems.map((p, i) => {
          const isCorrect = submitted && answers[i].trim() !== '' && Number(answers[i]) === p.answer;
          const isWrong = submitted && !isCorrect;
          const isActive = !submitted && activeIndex === i;
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
                disabled={submitted}
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
    </>
  );
}
