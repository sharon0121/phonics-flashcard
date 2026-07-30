'use client';

import { useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import EnglishMathMode from './EnglishMathMode';
import SpeedChallengeMode from './SpeedChallengeMode';

type GameMode = 'english-math' | 'speed';

export default function CoordinateHuntView() {
  const [mode, setMode] = useState<GameMode | null>(null);

  if (mode === 'english-math') {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <EnglishMathMode onBack={() => setMode(null)} />
        </div>
      </main>
    );
  }

  if (mode === 'speed') {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <SpeedChallengeMode onBack={() => setMode(null)} />
        </div>
      </main>
    );
  }

  // Mode selection screen
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
            href="/games/coordinate-hunt/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🗺️ 座標寶藏迷宮</h1>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Math Treasure Hunt</p>
        <p className="mt-3 text-sm font-medium text-zinc-300">選擇挑戰模式：</p>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* English + Math mode */}
          <button
            type="button"
            onClick={() => setMode('english-math')}
            className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
          >
            <span className="text-6xl transition-transform group-hover:scale-110">🧮</span>
            <span className="text-xl font-bold text-[var(--hero-gold)]">英數挑戰</span>
            <span className="text-sm leading-relaxed text-zinc-300">
              解心算題收集單字<br />再排出完整英文句子！
            </span>
            <span className="mt-1 rounded-full bg-[var(--hero-gold)] px-4 py-1.5 text-sm font-bold text-zinc-900">
              選這個！
            </span>
          </button>

          {/* Speed mode */}
          <button
            type="button"
            onClick={() => setMode('speed')}
            className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-sky-400 bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
          >
            <span className="text-6xl transition-transform group-hover:scale-110">⚡</span>
            <span className="text-xl font-bold text-sky-300">速度挑戰</span>
            <span className="text-sm leading-relaxed text-zinc-300">
              計時 3 分鐘<br />答越多題越好！
            </span>
            <span className="mt-1 rounded-full bg-sky-400 px-4 py-1.5 text-sm font-bold text-zinc-900">
              英雄榜 🏆
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
