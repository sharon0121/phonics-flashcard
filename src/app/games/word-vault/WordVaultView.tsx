'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { MazeWord } from '@/data/wordMazeWords';
import { useAllMazeWords, useGhostCount, useGhostTickMs } from '@/lib/wordVaultSettings';
import HeroMascot from '@/components/HeroMascot';
import MazePhase from './MazePhase';
import PuzzlePhase from './PuzzlePhase';
import AchievementSidebar from './AchievementSidebar';

type Stage = 'maze' | 'puzzle';

function pickRandomWord(pool: MazeWord[]): MazeWord {
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function WordVaultView() {
  const allWords = useAllMazeWords();
  const ghostCount = useGhostCount();
  const ghostTickMs = useGhostTickMs();
  const [word, setWord] = useState<MazeWord>(() => pickRandomWord(allWords));
  const [stage, setStage] = useState<Stage>('maze');

  function replaySame() {
    setStage('maze');
  }

  function nextWord() {
    setWord(pickRandomWord(allWords));
    setStage('maze');
  }

  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link href="/games" className="text-sm font-medium text-[var(--hero-gold)] hover:underline">
            ← 回小遊戲列表
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
          <img src="/sprites/pacman.png" alt="" className="h-8 w-8" style={{ imageRendering: 'pixelated' }} />
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">小精靈大探險</h1>
        </div>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Pac Word Adventure</p>
        <p className="mt-1 text-sm text-zinc-300">
          {stage === 'maze' ? '吃光迷宮裡的字母，躲開幽靈，找到傳送門！' : '把找到的字母拼成正確的單字！'}
        </p>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row">
          <AchievementSidebar />
          <div className="flex-1">
            {stage === 'maze' ? (
              <MazePhase
                key={word.word}
                word={word}
                ghostCount={ghostCount}
                ghostTickMs={ghostTickMs}
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
