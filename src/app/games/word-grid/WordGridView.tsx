'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';
import { useWordGridPools, useWordGridSpeechRate, SPEECH_RATE_VALUES } from '@/lib/wordGridSettings';
import { playCollectSound, playErrorSound } from '@/lib/sound';

const MAX_CHOICES = 9;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Round {
  correct: Word;
  choices: Word[];
}

// Correct answer drawn from the narrowest non-empty selected source tier;
// distractors drawn from the combined pool of all selected tiers — same
// priority convention as the other games' word sources.
function makeRound(pools: Word[][]): Round | null {
  const nonEmpty = pools.find((p) => p.length > 0);
  if (!nonEmpty) return null;
  const combined = pools.flat();
  const correct = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
  const distractorSrc = combined.filter((w) => w.id !== correct.id);
  const numChoices = Math.min(MAX_CHOICES, distractorSrc.length + 1);
  const distractors = shuffle(distractorSrc).slice(0, numChoices - 1);
  return { correct, choices: shuffle([correct, ...distractors]) };
}

function speak(text: string, rate: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

export default function WordGridView() {
  const pools = useWordGridPools();
  const speechRate = useWordGridSpeechRate();
  const rate = SPEECH_RATE_VALUES[speechRate];

  const [round, setRound] = useState<Round | null>(() => makeRound(pools));
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState(false);

  const poolKey = pools.map((p) => p.map((w) => w.id).join(',')).join('|');

  const nextRound = useCallback(() => {
    setRound(makeRound(pools));
    setJustSolved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey]);

  // Speak the target word whenever a fresh round is ready to answer.
  useEffect(() => {
    if (round && !justSolved) {
      const t = setTimeout(() => speak(round.correct.word, rate), 200);
      return () => clearTimeout(t);
    }
  }, [round, justSolved, rate]);

  function handleTap(choice: Word) {
    if (!round || justSolved) return;
    if (choice.id === round.correct.id) {
      playCollectSound();
      setCorrectCount((c) => c + 1);
      setJustSolved(true);
      setTimeout(nextRound, 1000);
    } else {
      playErrorSound();
      setWrongId(choice.id);
      setTimeout(() => setWrongId(null), 400);
    }
  }

  const tooFewWords = !round || round.choices.length < 2;

  return (
    <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-8">
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
            href="/games/word-grid/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔤 單字複習</h1>
        <p className="mt-1 text-sm text-zinc-300">聽發音，點出正確的單字！</p>

        {tooFewWords ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-6 text-center">
            <span className="text-5xl">📚</span>
            <p className="text-zinc-900">目前選擇的題目來源單字太少，請到設定調整題目來源。</p>
            <Link
              href="/games/word-grid/settings"
              className="mt-2 rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              前往設定
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
            <div className="flex items-center justify-between text-sm font-bold text-white">
              <button
                type="button"
                onClick={() => speak(round.correct.word, rate)}
                className="rounded-full bg-white/10 p-2 text-lg hover:bg-white/20"
                aria-label="再聽一次"
              >
                🔊
              </button>
              <span>✅ 答對 {correctCount} 題</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {round.choices.map((choice) => {
                const wrong = wrongId === choice.id;
                const solvedCorrect = justSolved && choice.id === round.correct.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleTap(choice)}
                    disabled={justSolved}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 p-2 shadow transition-colors sm:p-3 ${
                      solvedCorrect
                        ? 'border-emerald-400 bg-emerald-100'
                        : wrong
                          ? 'animate-pulse border-red-400 bg-red-100'
                          : 'border-zinc-300 bg-white hover:bg-zinc-100'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">{choice.emoji}</span>
                    <span className="text-sm font-black tracking-wide text-zinc-900 uppercase sm:text-lg">
                      {choice.word}
                    </span>
                    <ZhuyinText zh={choice.zh} zhuyin={choice.zhuyin} className="text-[10px] font-bold text-zinc-600 sm:text-xs" />
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
