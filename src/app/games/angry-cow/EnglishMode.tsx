'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SpeakButton from '@/components/SpeakButton';
import ZhuyinText from '@/components/ZhuyinText';
import { words as PHONICS_WORDS } from '@/data/words';
import SlingshotGame, { type SlingshotRound } from './SlingshotGame';
import AngryCowLeaderboardPanel from './AngryCowLeaderboardPanel';
import { useAngryCowWordPools, useAngryCowSpeechRate, SPEECH_RATE_VALUES } from '@/lib/angryCowSettings';
import { makeEnglishRound } from '@/lib/angryCow';
import { recordAngryCowRun, renameAngryCowRecord, useLastAngryCowPlayerName } from '@/lib/angryCowHistory';

export default function EnglishMode({ onBack }: { onBack: () => void }) {
  const wordPools = useAngryCowWordPools();
  const speechRate = useAngryCowSpeechRate();
  const lastPlayerName = useLastAngryCowPlayerName();

  // Read via refs inside makeRound so it never needs to change identity
  // (SlingshotGame only calls it, doesn't need to react to it changing).
  const wordPoolsRef = useRef(wordPools);
  const speechRateRef = useRef(speechRate);
  useEffect(() => {
    wordPoolsRef.current = wordPools;
    speechRateRef.current = speechRate;
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

  const makeRound = useCallback((): SlingshotRound | null => {
    // Always fall back to the full phonics bank so there's always enough
    // distinct words for 3 targets, even if the chosen sources are tiny.
    const round = makeEnglishRound(wordPoolsRef.current) ?? makeEnglishRound([...wordPoolsRef.current, PHONICS_WORDS]);
    if (!round) return null;
    const rate = SPEECH_RATE_VALUES[speechRateRef.current];
    return {
      prompt: <span className="uppercase tracking-widest">{round.word.word}</span>,
      spokenText: `What is ${round.word.word}?`,
      targets: round.targets.map((t) => ({
        id: t.id,
        isCorrect: t.isCorrect,
        board: (
          <div className="flex flex-col items-center gap-0.5 sm:gap-1">
            <div className="rounded-lg bg-white/80 px-[0.8vw] py-[0.4vw] text-zinc-900 text-[clamp(0.7rem,2.4vw,1.4rem)]">
              <ZhuyinText zh={t.word.zh} zhuyin={t.word.zhuyin} className="font-black" />
            </div>
            <span onPointerDown={(e) => e.stopPropagation()}>
              <SpeakButton text={t.word.zh} lang="zh-TW" rate={rate} className="!p-0.5 sm:!p-1" />
            </span>
          </div>
        ),
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
          <span className="text-2xl">🔤</span>
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">射擊吧！憤怒牛！英文版</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-300">看清楚上方的英文單字，射擊拿著正確中文意思牌子的牛，射錯會扣一顆心！</p>

        <div className="mt-2 flex flex-col gap-2 sm:mt-6 sm:gap-6 sm:flex-row">
          <AngryCowLeaderboardPanel mode="english" matchHeight={gamePanelHeight} />
          <div ref={gamePanelRef} className="min-w-0 flex-1">
            <SlingshotGame
              makeRound={makeRound}
              onSave={(name, score) => recordAngryCowRun('english', name, score, Date.now())}
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
