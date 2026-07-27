'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getWordById } from '@/data/words';
import { getSightWordById } from '@/data/sightWords';
import { useCurriculum, getCurrentWeekKey, getTaughtWordIds } from '@/lib/curriculum';
import type { Word } from '@/lib/types';
import WordHighlight from '@/components/WordHighlight';
import ZhuyinText from '@/components/ZhuyinText';

type QuizMode = 'emoji-to-word' | 'word-to-emoji';
type Question = { answer: Word; options: Word[] };

const TOTAL_QUESTIONS = 10;
const POINTS_PER_QUESTION = 100 / TOTAL_QUESTIONS;

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

  const pool = useMemo(() => {
    const currentWeekKey = getCurrentWeekKey();
    const ids = Array.from(getTaughtWordIds(curriculum, currentWeekKey));
    return ids.map(resolveWord).filter((w): w is Word => !!w);
  }, [curriculum]);

  const [questions, setQuestions] = useState<Question[]>(() => (pool.length >= 4 ? buildQuizSet(pool) : []));
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

  function handleModeChange(m: QuizMode) {
    setMode(m);
    setSelected(null);
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">小測驗</h1>
      <p className="mt-1 text-sm text-zinc-300">
        只考已經在「進度」頁面規劃過的單字（累積到本週）。
      </p>

      <div className="mt-3 flex gap-2">
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
          <p>目前規劃的單字還不足 4 個，無法出題。</p>
          <Link href="/progress" className="mt-2 inline-block font-medium text-[var(--hero-gold)] underline">
            前往「進度」頁面規劃本週單字
          </Link>
        </div>
      ) : finished ? (
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
      ) : (
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
      )}
    </main>
  );
}
