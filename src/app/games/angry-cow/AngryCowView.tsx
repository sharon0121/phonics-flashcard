'use client';

import { useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import EnglishMode from './EnglishMode';
import MathMode from './MathMode';

type GameMode = 'english' | 'math';

export default function AngryCowView() {
  const [mode, setMode] = useState<GameMode | null>(null);

  if (mode === 'english') return <EnglishMode onBack={() => setMode(null)} />;
  if (mode === 'math') return <MathMode onBack={() => setMode(null)} />;

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
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </Link>
          <Link
            href="/games/angry-cow/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🐮 射擊吧！憤怒牛！</h1>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Shoot! Angry Cow!</p>
        <p className="mt-3 text-sm font-medium text-zinc-300">選擇挑戰模式：</p>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('english')}
            className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
          >
            <span className="text-6xl transition-transform group-hover:scale-110">🔤</span>
            <span className="text-xl font-bold text-[var(--hero-gold)]">英文版</span>
            <span className="text-sm leading-relaxed text-zinc-300">
              看英文單字猜中文意思
              <br />
              按住蓄力射擊拿對答案的牛！
            </span>
            <span className="mt-1 rounded-full bg-[var(--hero-gold)] px-4 py-1.5 text-sm font-bold text-zinc-900">
              選這個！
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('math')}
            className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-sky-400 bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
          >
            <span className="text-6xl transition-transform group-hover:scale-110">🧮</span>
            <span className="text-xl font-bold text-sky-300">數學版</span>
            <span className="text-sm leading-relaxed text-zinc-300">
              算出加減算式的答案
              <br />
              按住蓄力射擊拿對答案的牛！
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
