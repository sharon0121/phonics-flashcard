'use client';

import { useEffect, useRef, useState } from 'react';
import type { AbacusProblem } from '@/lib/abacus';
import CountdownRing from '@/components/CountdownRing';
import NumberKeypad from '@/components/NumberKeypad';
import ScoreCelebration from '@/components/ScoreCelebration';

const FLASH_MS = 900;
const FEEDBACK_MS = 700;
const MAX_ANSWER_DIGITS = 3;

interface FlashRoundProps {
  problems: AbacusProblem[];
  timeLimitSeconds: number;
  onFinish: (score: number) => void;
  onCancel: () => void;
}

type Stage = 'flashing' | 'answering' | 'feedback';
type Result = { answer: string; correct: boolean };

// The "逐口閃示" mental-math mode: one problem at a time, each term flashes
// briefly then disappears (mimicking "看一眼記心裡" mental-abacus training),
// then the child types the final answer before moving to the next problem.
export default function FlashRound({ problems, timeLimitSeconds, onFinish, onCancel }: FlashRoundProps) {
  const [index, setIndex] = useState(0);
  const [termIndex, setTermIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('flashing');
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const [submitted, setSubmitted] = useState(false);
  const finishedRef = useRef(false);
  const resultsRef = useRef(results);

  useEffect(() => {
    resultsRef.current = results;
  });

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSubmitted(true);
    onFinish(resultsRef.current.filter((r) => r.correct).length);
  }

  // Abandons the round without grading it or recording history. No need to
  // touch local state here — the parent unmounts this component once
  // roundActive flips back to false in response to onCancel().
  function cancel() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCancel();
  }

  // Overall time budget, ticking regardless of which stage we're in.
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

  const problem = problems[index];

  // Cycles the flash sequence: show the current term, then either advance to
  // the next term or (once the last term has shown) move to answering.
  useEffect(() => {
    if (submitted || stage !== 'flashing') return;
    const isLastTerm = termIndex + 1 >= problem.terms.length;
    const t = setTimeout(() => {
      if (isLastTerm) {
        setStage('answering');
      } else {
        setTermIndex((i) => i + 1);
      }
    }, FLASH_MS);
    return () => clearTimeout(t);
  }, [submitted, stage, termIndex, problem]);

  // After showing correct/wrong feedback, advance to the next problem or finish.
  useEffect(() => {
    if (submitted || stage !== 'feedback') return;
    const t = setTimeout(() => {
      if (index + 1 < problems.length) {
        setIndex((i) => i + 1);
        setTermIndex(0);
        setAnswer('');
        setStage('flashing');
      } else {
        finish();
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, stage, index, problems.length]);

  function confirmAnswer() {
    if (stage !== 'answering') return;
    const correct = answer.trim() !== '' && Number(answer) === problem.answer;
    setResults((prev) => [...prev, { answer, correct }]);
    setStage('feedback');
  }

  function appendDigit(digit: string) {
    if (stage !== 'answering') return;
    setAnswer((prev) => (prev.length < MAX_ANSWER_DIGITS ? prev + digit : prev));
  }

  function backspace() {
    if (stage !== 'answering') return;
    setAnswer((prev) => prev.slice(0, -1));
  }

  function clearAnswer() {
    if (stage !== 'answering') return;
    setAnswer('');
  }

  const lastResult = stage === 'feedback' ? results[results.length - 1] : null;
  const correctSoFar = results.filter((r) => r.correct).length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <CountdownRing totalSeconds={timeLimitSeconds} remainingSeconds={remainingSeconds} />
        {!submitted && (
          <>
            <div className="text-sm text-zinc-300">
              第 {index + 1} / {problems.length} 題．答對 {correctSoFar} 題
            </div>
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/20"
            >
              <span aria-hidden>❌</span>取消
            </button>
          </>
        )}
        {submitted && (
          <div className="text-lg font-bold text-[var(--hero-gold)]">
            答對 {correctSoFar} / {problems.length} 題
          </div>
        )}
      </div>

      {!submitted && (
        <div className="mt-8 flex flex-col items-center gap-6">
          <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-2xl border-[3px] border-zinc-900 bg-white text-6xl font-bold text-zinc-900">
            {stage === 'flashing' && <span>{problem.terms[termIndex]}</span>}
            {stage === 'answering' && <span className="text-2xl text-zinc-300">請輸入答案</span>}
            {stage === 'feedback' && (
              <span className={`text-3xl ${lastResult?.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                {lastResult?.correct ? '答對了！' : `正解：${problem.answer}`}
              </span>
            )}
          </div>

          {stage === 'answering' && (
            <>
              <div className="flex h-14 w-32 items-center justify-center rounded-md border-2 border-[var(--hero-gold)] bg-yellow-50 text-2xl font-bold text-zinc-900">
                {answer || <span className="text-zinc-300">－</span>}
              </div>
              <NumberKeypad onDigit={appendDigit} onBackspace={backspace} onClear={clearAnswer} />
              <button
                type="button"
                onClick={confirmAnswer}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--hero-red)] px-6 py-2 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
              >
                <span aria-hidden>✅</span>確認
              </button>
            </>
          )}
        </div>
      )}

      {submitted && <ScoreCelebration score={correctSoFar} total={problems.length} />}

      {submitted && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {problems.map((p, i) => {
            const r = results[i];
            const isCorrect = !!r?.correct;
            return (
              <div
                key={i}
                className={`flex flex-col items-center rounded-xl border-[3px] bg-white p-3 text-zinc-900 ${
                  isCorrect ? 'border-emerald-400' : 'border-red-400'
                }`}
              >
                <span className="text-xs font-bold text-zinc-400">No.{i + 1}</span>
                <span className="mt-1 font-mono text-sm">{p.terms.join('  ')}</span>
                <span className="mt-1 text-sm font-bold">你的答案：{r?.answer || '（未作答）'}</span>
                {!isCorrect && <span className="text-xs text-red-500">正解：{p.answer}</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
