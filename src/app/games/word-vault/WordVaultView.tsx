'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { MazeWord } from '@/data/wordMazeWords';
import { useAllMazeWords, useGhostCount, useGhostTickMs, useTunnelMode } from '@/lib/wordVaultSettings';
import HeroMascot from '@/components/HeroMascot';
import MazePhase from './MazePhase';
import PuzzlePhase from './PuzzlePhase';
import AchievementSidebar from './AchievementSidebar';

type Stage = 'maze' | 'puzzle';

export default function WordVaultView() {
  const allWords = useAllMazeWords();
  const ghostCount = useGhostCount();
  const ghostTickMs = useGhostTickMs();
  const tunnelMode = useTunnelMode();

  // Track which words have been shown so no word repeats until the whole pool
  // has been exhausted. When the pool changes (settings edit), reset the tracker.
  const usedWordsRef = useRef(new Set<string>());
  const lastPoolRef = useRef(allWords);

  function pickNext(currentWordStr?: string): MazeWord {
    const pool = allWords;
    if (pool !== lastPoolRef.current) {
      lastPoolRef.current = pool;
      usedWordsRef.current = new Set();
    }
    let available = pool.filter((w) => !usedWordsRef.current.has(w.word));
    if (available.length === 0) {
      // Full rotation done — start fresh, just skip the word we just played
      usedWordsRef.current = new Set();
      available = currentWordStr ? pool.filter((w) => w.word !== currentWordStr) : pool;
      if (available.length === 0) available = pool;
    } else if (currentWordStr && available.length > 1) {
      const noRepeat = available.filter((w) => w.word !== currentWordStr);
      if (noRepeat.length > 0) available = noRepeat;
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    usedWordsRef.current.add(picked.word);
    return picked;
  }

  const [word, setWord] = useState<MazeWord>(() => {
    const initial = allWords[Math.floor(Math.random() * allWords.length)];
    usedWordsRef.current.add(initial.word);
    return initial;
  });
  const [stage, setStage] = useState<Stage>('maze');

  function replaySame() {
    setStage('maze');
  }

  function nextWord() {
    setWord(pickNext(word.word));
    setStage('maze');
  }

  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-2 sm:py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back
          </Link>
          <Link
            href="/games/word-vault/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sprites/pacman.png" alt="" className="h-6 w-6 sm:h-8 sm:w-8" style={{ imageRendering: 'pixelated' }} />
          <h1 className="text-xl font-bold text-[var(--hero-gold)] sm:text-2xl">小精靈大探險</h1>
        </div>
        <p className="hidden text-xs font-semibold tracking-wide text-zinc-400 uppercase sm:block">
          Pac Word Adventure
        </p>
        <p className="mt-1 hidden text-sm text-zinc-300 sm:block">
          {stage === 'maze' ? '吃光迷宮裡的字母，躲開幽靈，找到傳送門！' : '把找到的字母拼成正確的單字！'}
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:mt-6 sm:gap-6 sm:flex-row">
          <AchievementSidebar />
          <div className="flex-1">
            {stage === 'maze' ? (
              <MazePhase
                key={word.word}
                word={word}
                ghostCount={ghostCount}
                ghostTickMs={ghostTickMs}
                tunnelMode={tunnelMode}
                onComplete={() => setStage('puzzle')}
              />
            ) : (
              <PuzzlePhase
                word={word}
                collectedLetters={word.word.toUpperCase().split('')}
                onReplaySame={replaySame}
                onNext={nextWord}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
