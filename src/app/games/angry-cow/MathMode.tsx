'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SlingshotGame, { type SlingshotRound } from './SlingshotGame';
import AngryCowLeaderboardPanel from './AngryCowLeaderboardPanel';
import { useAngryCowMaxValue } from '@/lib/angryCowSettings';
import { makeMathRound } from '@/lib/angryCow';
import { recordAngryCowRun, renameAngryCowRecord, useLastAngryCowPlayerName } from '@/lib/angryCowHistory';

export default function MathMode({ onBack }: { onBack: () => void }) {
  const maxValue = useAngryCowMaxValue();
  const lastPlayerName = useLastAngryCowPlayerName();

  const maxValueRef = useRef(maxValue);
  useEffect(() => {
    maxValueRef.current = maxValue;
  });

  const gamePanelRef = useRef<HTMLDivElement>(null);
  const [gamePanelHeight, setGamePanelHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = gamePanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setGamePanelHeight(Math.round(height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const makeRound = useCallback((): SlingshotRound => {
    const round = makeMathRound(maxValueRef.current);
    const opSymbol = round.problem.op === '+' ? '+' : '−';
    return {
      prompt: (
        <span>
          {round.problem.a} {opSymbol} {round.problem.b} = ?
        </span>
      ),
      targets: round.targets.map((t) => ({
        id: t.id,
        isCorrect: t.isCorrect,
        board: <span className="px-1 text-xl font-extrabold text-zinc-900">{t.value}</span>,
      })),
    };
  }, []);

  return (
    <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-2 sm:py-8">
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
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
          </button>
          <Link
            href="/games/angry-cow/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl">🧮</span>
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">射擊吧！憤怒牛！數學版</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-300">算出正確答案，射擊拿著答案牌子的牛，射錯會扣一顆心！</p>

        <div className="mt-2 flex flex-col gap-2 sm:mt-6 sm:gap-6 sm:flex-row">
          <AngryCowLeaderboardPanel mode="math" matchHeight={gamePanelHeight} />
          <div ref={gamePanelRef} className="min-w-0 flex-1">
            <SlingshotGame
              makeRound={makeRound}
              onSave={(name, score) => recordAngryCowRun('math', name, score, Date.now())}
              onRename={renameAngryCowRecord}
              lastPlayerName={lastPlayerName}
              animalEmoji="🐮"
              projectileEmoji="🐦"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
