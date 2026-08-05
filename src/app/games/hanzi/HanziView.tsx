'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import { useHanziWords, type HanziWord } from '@/lib/hanziWords';
import { playCollectSound, playErrorSound } from '@/lib/sound';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

interface Round {
  correct: HanziWord;
  choices: HanziWord[];
}

function makeRound(pool: HanziWord[], allWords: HanziWord[], numChoices = 9): Round | null {
  if (pool.length === 0) return null;
  const correct = pool[Math.floor(Math.random() * pool.length)];
  const distractorSrc = allWords.filter((w) => w.id !== correct.id);
  const n = Math.min(numChoices, distractorSrc.length + 1);
  const distractors = shuffle(distractorSrc).slice(0, n - 1);
  return { correct, choices: shuffle([correct, ...distractors]) };
}

export default function HanziView() {
  const words = useHanziWords();
  const pool = words.filter((w) => w.needsPractice);

  const [gridSize, setGridSize] = useState<3 | 4 | 5>(3);
  const [round, setRound] = useState<Round | null>(() => makeRound(pool, words, 9));
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState(false);

  const nextRound = useCallback(() => {
    const r = makeRound(pool, words, gridSize * gridSize);
    setRound(r);
    setJustSolved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.map((w) => w.id).join(','), words.map((w) => w.id).join(','), gridSize]);

  useEffect(() => {
    setRound(makeRound(pool, words, gridSize * gridSize));
    setJustSolved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]);

  // Speak the target character whenever a fresh round is ready to answer.
  useEffect(() => {
    if (round && !justSolved) {
      const t = setTimeout(() => speak(round.correct.char), 200);
      return () => clearTimeout(t);
    }
  }, [round, justSolved]);

  function handleTap(choice: HanziWord) {
    if (!round || justSolved) return;
    if (choice.id === round.correct.id) {
      playCollectSound();
      setCorrectCount((c) => c + 1);
      setJustSolved(true);
      setTimeout(nextRound, 900);
    } else {
      playErrorSound();
      setWrongId(choice.id);
      setTimeout(() => setWrongId(null), 400);
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/games"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back
          </Link>
          <Link
            href="/games/hanzi/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🈶 國字複習</h1>
        <p className="mt-1 text-sm text-zinc-300">聽發音，點出正確的國字！</p>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">格子大小：</span>
          {([3, 4, 5] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setGridSize(s)}
              className={`rounded-lg px-3 py-1 text-sm font-bold transition-colors ${
                gridSize === s
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-white/10 text-zinc-300 hover:bg-white/20'
              }`}
            >
              {s}×{s}
            </button>
          ))}
        </div>

        {pool.length < 2 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-6 text-center">
            <span className="text-5xl">📝</span>
            <p className="text-zinc-900">
              {words.length === 0
                ? '還沒有新增任何字，請先到設定新增小朋友學過的國字。'
                : '需要至少 2 個「還在練習中」的字才能出題，請到設定新增或勾選更多字。'}
            </p>
            <Link
              href="/games/hanzi/settings"
              className="mt-2 rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              前往設定
            </Link>
          </div>
        ) : !round ? null : (
          <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
            <div className="flex items-center justify-between text-sm font-bold text-white">
              <button
                type="button"
                onClick={() => speak(round.correct.char)}
                className="rounded-full bg-white/10 p-2 text-lg hover:bg-white/20"
                aria-label="再聽一次"
              >
                🔊
              </button>
              <span>✅ 答對 {correctCount} 題</span>
            </div>

            <div
              className={`mt-4 grid gap-2 ${
                gridSize === 3 ? 'grid-cols-3' : gridSize === 4 ? 'grid-cols-4' : 'grid-cols-5'
              }`}
            >
              {round.choices.map((choice) => {
                const wrong = wrongId === choice.id;
                const solvedCorrect = justSolved && choice.id === round.correct.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleTap(choice)}
                    disabled={justSolved}
                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 font-bold shadow transition-colors ${
                      gridSize === 3 ? 'text-4xl' : gridSize === 4 ? 'text-3xl' : 'text-2xl'
                    } ${
                      solvedCorrect
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-600'
                        : wrong
                          ? 'animate-pulse border-red-400 bg-red-100 text-red-500'
                          : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100'
                    }`}
                  >
                    {choice.char}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
