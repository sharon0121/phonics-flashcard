'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SpeakButton from '@/components/SpeakButton';
import ZhuyinText from '@/components/ZhuyinText';
import { words as PHONICS_WORDS } from '@/data/words';
import SlingshotGame, { type SlingshotRound } from './SlingshotGame';
import AngryCowLeaderboardPanel from './AngryCowLeaderboardPanel';
import {
  useAngryCowWordPools,
  useAngryCowSpeechRate,
  useAngryCowMathRanges,
  useAngryCowMathTerms,
  useAngryCowGameMode,
  ladderTierValue,
  SPEECH_RATE_VALUES,
} from '@/lib/angryCowSettings';
import { makeEnglishRound, makeMathRound } from '@/lib/angryCow';
import { recordAngryCowRun, renameAngryCowRecord, useLastAngryCowPlayerName } from '@/lib/angryCowHistory';

const MODE_META = {
  english: { emoji: '🔤', title: '射擊吧！憤怒牛！英文版',   desc: '看清楚上方的英文單字，射擊拿著正確中文意思牌子的牛，射錯會扣一顆心！' },
  math:    { emoji: '🧮', title: '射擊吧！憤怒牛！數學版',   desc: '算出正確答案，射擊拿著答案牌子的牛，射錯會扣一顆心！' },
  mixed:   { emoji: '🎯', title: '射擊吧！憤怒牛！混合版',   desc: '英文單字和數學算式隨機出題，射擊答案正確的牛！' },
} as const;

export default function AngryCowView() {
  const gameMode    = useAngryCowGameMode();
  const wordPools   = useAngryCowWordPools();
  const speechRate  = useAngryCowSpeechRate();
  const mathRanges  = useAngryCowMathRanges();
  const mathTerms   = useAngryCowMathTerms();
  const lastPlayerName = useLastAngryCowPlayerName();

  // Update refs inline (before effects) so makeRound always reads current values.
  const wordPoolsRef  = useRef(wordPools);
  const speechRateRef = useRef(speechRate);
  const mathRangesRef = useRef(mathRanges);
  const mathTermsRef  = useRef(mathTerms);
  const gameModeRef   = useRef(gameMode);
  wordPoolsRef.current  = wordPools;
  speechRateRef.current = speechRate;
  mathRangesRef.current = mathRanges;
  mathTermsRef.current  = mathTerms;
  gameModeRef.current   = gameMode;

  const gamePanelRef = useRef<HTMLDivElement>(null);
  const [gamePanelHeight, setGamePanelHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = gamePanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setGamePanelHeight(Math.round(h));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const makeEnglishSlingshotRound = useCallback((): SlingshotRound | null => {
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
            <div className="rounded-lg bg-white/80 px-1 py-0.5 text-zinc-900 sm:px-1.5 md:px-2 md:py-1 text-[clamp(0.7rem,2.4vw,1.4rem)]">
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

  const makeMathSlingshotRound = useCallback((streak: number): SlingshotRound => {
    // Multi-select difficulty ladder (same mechanic as 時空戰術隊): sort the
    // selected ranges/term-counts ascending and step up a tier for every
    // 10-streak of correct answers, capped at the hardest selected tier.
    const sortedRanges = [...mathRangesRef.current].sort((a, b) => a - b);
    const sortedTerms = [...mathTermsRef.current].sort((a, b) => a - b);
    const maxValue = ladderTierValue(sortedRanges, streak);
    const terms = ladderTierValue(sortedTerms, streak);
    const round = makeMathRound(maxValue, terms);
    const { nums, ops } = round.problem;
    const expr = nums
      .map((n, i) => (i === 0 ? String(n) : ` ${ops[i - 1] === '+' ? '+' : '−'} ${n}`))
      .join('');
    return {
      prompt: <span>{expr} = ?</span>,
      targets: round.targets.map((t) => ({
        id: t.id,
        isCorrect: t.isCorrect,
        board: <span className="px-1 font-extrabold text-zinc-900 text-[clamp(1rem,2.4vw,1.4rem)]">{t.value}</span>,
      })),
    };
  }, []);

  const makeRound = useCallback((streak: number): SlingshotRound | null => {
    const mode = gameModeRef.current;
    if (mode === 'math')    return makeMathSlingshotRound(streak);
    if (mode === 'english') return makeEnglishSlingshotRound();
    // mixed: 50/50 random
    return Math.random() < 0.5 ? makeEnglishSlingshotRound() : makeMathSlingshotRound(streak);
  }, [makeEnglishSlingshotRound, makeMathSlingshotRound]);

  const { emoji, title, desc } = MODE_META[gameMode];

  return (
    <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-2 sm:py-8">
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

        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">{title}</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-300">{desc}</p>

        <div className="mt-2 flex flex-col gap-2 sm:mt-6 sm:gap-6 sm:flex-row">
          <AngryCowLeaderboardPanel mode={gameMode} matchHeight={gamePanelHeight} />
          <div ref={gamePanelRef} className="min-w-0 flex-1">
            {/* key=gameMode forces a full remount when the mode changes in settings */}
            <SlingshotGame
              key={gameMode}
              makeRound={makeRound}
              onSave={(name, score) => recordAngryCowRun(gameMode, name, score, Date.now())}
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
