'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import KlotskiBoard from './KlotskiBoard';
import { KLOTSKI_LEVELS } from '@/data/klotskiLevels';
import type { Difficulty } from '@/lib/klotski';
import {
  LEVELS_PER_ITEM,
  consumeKlotskiSolutionItem,
  countCompletedLevels,
  recordKlotskiCompletion,
  useKlotskiProgress,
  useKlotskiSolutionItemsUsed,
} from '@/lib/klotskiProgress';

type Stage = 'difficulty' | 'playing';

const DIFFICULTY_INFO: Record<Difficulty, { label: string; emoji: string; desc: string; color: string }> = {
  easy: { label: '一顆星', emoji: '⭐', desc: '8~25 步，適合剛開始練習', color: 'border-emerald-400 bg-emerald-500/10 text-emerald-300' },
  medium: { label: '兩顆星', emoji: '⭐⭐', desc: '26~45 步，需要多想幾步', color: 'border-amber-400 bg-amber-500/10 text-amber-300' },
  hard: { label: '三顆星', emoji: '⭐⭐⭐', desc: '46 步以上，高手挑戰', color: 'border-rose-400 bg-rose-500/10 text-rose-300' },
};

export default function KlotskiView() {
  const [stage, setStage] = useState<Stage>('difficulty');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const progress = useKlotskiProgress();
  const itemsUsed = useKlotskiSolutionItemsUsed();

  const levels = useMemo(() => KLOTSKI_LEVELS.filter((l) => l.difficulty === difficulty), [difficulty]);
  const starsEarned = useMemo(() => levels.filter((l) => progress[l.id]?.completed).length, [levels, progress]);
  const totalCompleted = useMemo(() => countCompletedLevels(progress), [progress]);
  const itemsEarned = Math.floor(totalCompleted / LEVELS_PER_ITEM);
  const solutionItemsAvailable = Math.max(0, itemsEarned - itemsUsed);

  function startDifficulty(d: Difficulty) {
    const ls = KLOTSKI_LEVELS.filter((l) => l.difficulty === d);
    const firstIncomplete = ls.findIndex((l) => !progress[l.id]?.completed);
    setDifficulty(d);
    setLevelIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
    setStage('playing');
  }

  function handleNext() {
    if (levelIndex + 1 < levels.length) {
      setLevelIndex((i) => i + 1);
    } else {
      setStage('difficulty');
      setDifficulty(null);
    }
  }

  if (stage === 'playing' && difficulty && levels[levelIndex]) {
    const info = DIFFICULTY_INFO[difficulty];
    const currentLevel = levels[levelIndex];
    const bestMoves = progress[currentLevel.id]?.bestMoves ?? null;
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <div className="mb-3 flex items-center justify-between text-sm font-bold text-zinc-300">
            <span>
              {info.emoji} {info.label} · 第 {levelIndex + 1}/{levels.length} 關
            </span>
            <span className="flex items-center gap-3">
              <span className="text-[var(--hero-gold)]">
                ⭐ {starsEarned}/{levels.length}
              </span>
              <span className="text-purple-300">📖 {solutionItemsAvailable}</span>
            </span>
          </div>
          <KlotskiBoard
            level={currentLevel}
            isLastLevel={levelIndex === levels.length - 1}
            starsEarned={starsEarned}
            totalLevels={levels.length}
            bestMoves={bestMoves}
            solutionItemsAvailable={solutionItemsAvailable}
            onExit={() => {
              setStage('difficulty');
              setDifficulty(null);
            }}
            onComplete={(moves, usedSolution) => {
              recordKlotskiCompletion(currentLevel.id, moves, usedSolution);
            }}
            onNext={handleNext}
            onUseSolutionItem={consumeKlotskiSolutionItem}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <Link
            href="/games/klotski/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔀 動物華容道</h1>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Animal Klotski</p>
        <p className="mt-3 text-sm font-medium text-zinc-300">滑動可愛小動物，幫英雄從發光的出口逃出去！選一個難度：</p>
        <p className="mt-1 text-xs text-zinc-400">
          📖 看解答是道具，每破 {LEVELS_PER_ITEM} 關獲得 1 個，目前擁有 {solutionItemsAvailable} 個
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => {
            const info = DIFFICULTY_INFO[d];
            const ls = KLOTSKI_LEVELS.filter((l) => l.difficulty === d);
            const stars = ls.filter((l) => progress[l.id]?.completed).length;
            return (
              <button
                key={d}
                type="button"
                onClick={() => startDifficulty(d)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border-2 ${info.color} p-6 text-center shadow-lg transition-all hover:shadow-xl`}
              >
                <span className="text-4xl transition-transform group-hover:scale-110">{info.emoji}</span>
                <span className="text-xl font-bold">{info.label}</span>
                <span className="text-sm leading-relaxed text-zinc-300">{info.desc}</span>
                <span className="text-xs font-bold text-[var(--hero-gold)]">
                  {stars}/{ls.length} 關完成
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
