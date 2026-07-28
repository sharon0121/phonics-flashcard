'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getWordById } from '@/data/words';
import { getSightWordById } from '@/data/sightWords';
import {
  useCurriculum,
  getCurrentWeekKey,
  getTaughtWordIds,
  getWordIdsInWeekRange,
  shiftWeekKey,
} from '@/lib/curriculum';
import type { Word } from '@/lib/types';
import WordHighlight from '@/components/WordHighlight';
import ZhuyinText from '@/components/ZhuyinText';
import EnglishSubNav from '@/components/EnglishSubNav';

type QuizMode = 'emoji-to-word' | 'word-to-emoji';
type Question = { answer: Word; options: Word[] };
type TimeScope = 'week' | 'recent4' | 'all';
type Difficulty = 'all' | 'easy' | 'medium' | 'hard';

const TOTAL_QUESTIONS = 10;
const POINTS_PER_QUESTION = 100 / TOTAL_QUESTIONS;

const TIME_SCOPE_OPTIONS: { value: TimeScope; label: string }[] = [
  { value: 'week', label: '當週' },
  { value: 'recent4', label: '最近 4 週' },
  { value: 'all', label: '所有已學過' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'easy', label: '初階' },
  { value: 'medium', label: '中階' },
  { value: 'hard', label: '高階' },
];

// Phonics phase / sight-word stage both run 1-6 in increasing difficulty,
// so the same tiering works for either word bank.
const DIFFICULTY_PHASES: Record<Exclude<Difficulty, 'all'>, number[]> = {
  easy: [1, 2],
  medium: [3, 4],
  hard: [5, 6],
};

function resolveWord(id: string): Word | undefined {
  return getWordById(id) ?? getSightWordById(id);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestion(pool: Word[]): Question {
  const shuffled = shuffle(pool);
  const options = shuffled.slice(0, 4);
  const answer = options[Math.floor(Math.random() * 4)];
  return { answer, options: shuffle(options) };
}

function buildQuizSet(pool: Word[]): Question[] {
  return Array.from({ length: TOTAL_QUESTIONS }, () => buildQuestion(pool));
}

export default function QuizView() {
  const curriculum = useCurriculum();
  const [mode, setMode] = useState<QuizMode>('emoji-to-word');
  const [timeScope, setTimeScope] = useState<TimeScope>('all');
  const [difficulty, setDifficulty] = useState<Difficulty>('all');

  const pool = useMemo(() => {
    const currentWeekKey = getCurrentWeekKey();
    let ids: Set<string>;
    if (timeScope === 'week') {
      ids = new Set(curriculum[currentWeekKey] ?? []);
    } else if (timeScope === 'recent4') {
      ids = getWordIdsInWeekRange(curriculum, shiftWeekKey(currentWeekKey, -3), currentWeekKey);
    } else {
      ids = getTaughtWordIds(curriculum, currentWeekKey);
    }

    let resolved = Array.from(ids)
      .map(resolveWord)
      .filter((w): w is Word => !!w);

    if (difficulty !== 'all') {
      const allowedPhases = DIFFICULTY_PHASES[difficulty];
      resolved = resolved.filter((w) => allowedPhases.includes(w.phase));
    }

    return resolved;
  }, [curriculum, timeScope, difficulty]);

  // Keys the quiz session by which words are actually in play, so changing
  // scope/difficulty (or the curriculum itself) starts a fresh session
  // instead of carrying over stale questions from the previous pool.
  const poolKey = useMemo(
    () =>
      pool
        .map((w) => w.id)
        .sort()
        .join(','),
    [pool]
  );

  function handleModeChange(m: QuizMode) {
    setMode(m);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <EnglishSubNav />
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">小測驗</h1>
      <p className="mt-1 text-sm text-zinc-300">
        只考已經在「進度」頁面規劃過的單字，可依範圍與難度篩選。
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">出題範圍</p>
          <div className="flex flex-wrap gap-2">
            {TIME_SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeScope(opt.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeScope === opt.value
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-400">難度</p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  difficulty === opt.value
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('emoji-to-word')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'emoji-to-word'
              ? 'bg-[var(--hero-gold)] text-zinc-900'
              : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          看圖選字
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('word-to-emoji')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'word-to-emoji'
              ? 'bg-[var(--hero-gold)] text-zinc-900'
              : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          看字選圖
        </button>
      </div>

      {pool.length < 4 ? (
        <div className="mt-8 text-sm text-zinc-300">
          <p>所選範圍與難度內的單字不足 4 個，無法出題。試試放寬篩選條件，或前往「進度」頁面規劃更多單字。</p>
          <Link href="/progress" className="mt-2 inline-block font-medium text-[var(--hero-gold)] underline">
            前往「進度」頁面規劃單字
          </Link>
        </div>
      ) : (
        <QuizSession key={poolKey} pool={pool} mode={mode} />
      )}
    </main>
  );
}

function QuizSession({ pool, mode }: { pool: Word[]; mode: QuizMode }) {
  const [questions, setQuestions] = useState<Question[]>(() => buildQuizSet(pool));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  function startNewQuiz() {
    setQuestions(buildQuizSet(pool));
    setQuestionIndex(0);
    setCorrectCount(0);
    setSelected(null);
    setFinished(false);
  }

  const question = questions[questionIndex];

  function handleAnswer(choice: Word) {
    if (selected || !question) return;
    setSelected(choice.id);
    const isCorrect = choice.id === question.answer.id;
    if (isCorrect) setCorrectCount((c) => c + 1);

    setTimeout(() => {
      if (questionIndex + 1 >= TOTAL_QUESTIONS) {
        setFinished(true);
      } else {
        setQuestionIndex((i) => i + 1);
        setSelected(null);
      }
    }, 900);
  }

  const score = Math.round(correctCount * POINTS_PER_QUESTION);

  if (finished) {
    return (
      <div className="mt-10 flex flex-col items-center gap-4">
        <div className="text-lg text-zinc-300">測驗結束！</div>
        <div className="text-5xl font-bold text-[var(--hero-gold)]">{score} 分</div>
        <div className="text-sm text-zinc-300">
          答對 {correctCount} / {TOTAL_QUESTIONS} 題
        </div>
        <button
          type="button"
          onClick={startNewQuiz}
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          再測一次
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="mt-4 text-sm text-zinc-300">
        第 {questionIndex + 1} / {TOTAL_QUESTIONS} 題・答對 {correctCount} 題
      </p>

      <div className="mt-6 flex flex-col items-center gap-8">
        {mode === 'emoji-to-word' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-7xl">{question.answer.emoji}</div>
            <div className="text-xl font-bold">
              <ZhuyinText zh={question.answer.zh} zhuyin={question.answer.zhuyin} />
            </div>
          </div>
        ) : (
          <span className="text-4xl font-bold">
            <WordHighlight word={question.answer.word} highlight={question.answer.highlight} />
          </span>
        )}

        <div className="grid w-full grid-cols-2 gap-4">
          {question.options.map((opt) => {
            const isSelected = selected === opt.id;
            const isCorrectChoice = selected && opt.id === question.answer.id;
            const isWrongChoice = isSelected && opt.id !== question.answer.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleAnswer(opt)}
                disabled={!!selected}
                className={`flex items-center justify-center rounded-xl border p-3 text-center text-zinc-900 transition-colors ${
                  mode === 'word-to-emoji' ? 'h-32' : 'h-24'
                } ${
                  isCorrectChoice
                    ? 'border-emerald-400 bg-emerald-50'
                    : isWrongChoice
                      ? 'border-red-400 bg-red-50'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                {mode === 'emoji-to-word' ? (
                  <span className="text-lg font-semibold">{opt.word}</span>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-4xl">{opt.emoji}</span>
                    <span className="text-sm font-bold">
                      <ZhuyinText zh={opt.zh} zhuyin={opt.zhuyin} />
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
