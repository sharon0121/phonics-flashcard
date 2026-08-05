'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SpeakButton from '@/components/SpeakButton';
import ZhuyinText from '@/components/ZhuyinText';
import { words as PHONICS_WORDS } from '@/data/words';
import SlingshotGame, { type SlingshotRound, type AnimalType } from './SlingshotGame';
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

// Session-only animal unlock milestones — every 5 consecutive correct answers.
const SESSION_ANIMAL_MILESTONES: Array<{
  threshold: number;
  animal: AnimalType;
  label: string;
  emoji: string;
}> = [
  { threshold: 5,  animal: 'pig',      label: '豬豬', emoji: '🐷' },
  { threshold: 10, animal: 'sheep',    label: '小羊', emoji: '🐑' },
  { threshold: 15, animal: 'horse',    label: '駿馬', emoji: '🐴' },
  { threshold: 20, animal: 'elephant', label: '大象', emoji: '🐘' },
  { threshold: 25, animal: 'bear',     label: '熊熊', emoji: '🐻' },
];

const ALL_ANIMALS: Array<{ type: AnimalType; label: string; emoji: string }> = [
  { type: 'cow',      label: '乳牛', emoji: '🐮' },
  { type: 'pig',      label: '豬豬', emoji: '🐷' },
  { type: 'sheep',    label: '小羊', emoji: '🐑' },
  { type: 'horse',    label: '駿馬', emoji: '🐴' },
  { type: 'elephant', label: '大象', emoji: '🐘' },
  { type: 'bear',     label: '熊熊', emoji: '🐻' },
];

const STREAK_TIER_SPIKY     = 5;
const STREAK_TIER_AXE       = 10;
const STREAK_TIER_BOMB      = 15;
const STREAK_TIER_LIGHTNING = 20;
const STREAK_TIER_STAR      = 25;

function getWeaponInfo(streak: number): { emoji: string; label: string } {
  if (streak >= STREAK_TIER_STAR)      return { emoji: '⭐', label: '星星' };
  if (streak >= STREAK_TIER_LIGHTNING) return { emoji: '⚡', label: '閃電' };
  if (streak >= STREAK_TIER_BOMB)      return { emoji: '💣', label: '炸彈' };
  if (streak >= STREAK_TIER_AXE)       return { emoji: '🪓', label: '斧頭' };
  if (streak >= STREAK_TIER_SPIKY)     return { emoji: '🔴', label: '長刺球' };
  return { emoji: '🎯', label: '普通球' };
}

export default function AngryCowView() {
  const gameMode    = useAngryCowGameMode();
  const wordPools   = useAngryCowWordPools();
  const speechRate  = useAngryCowSpeechRate();
  const mathRanges  = useAngryCowMathRanges();
  const mathTerms   = useAngryCowMathTerms();
  const lastPlayerName = useLastAngryCowPlayerName();

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

  // ── Session-scoped unlock state ────────────────────────────────────────────
  const [sessionMaxStreak, setSessionMaxStreak] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sessionUnlocked, setSessionUnlocked] = useState<AnimalType[]>(['cow']);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>('cow');
  const [unlockPopup, setUnlockPopup] = useState<(typeof SESSION_ANIMAL_MILESTONES)[0] | null>(null);

  // Auto-dismiss unlock popup after 3 s.
  useEffect(() => {
    if (!unlockPopup) return;
    const id = setTimeout(() => setUnlockPopup(null), 3000);
    return () => clearTimeout(id);
  }, [unlockPopup]);

  function handleStreakChange(streak: number) {
    setCurrentStreak(streak);
    setSessionMaxStreak((prev) => {
      if (streak <= prev) return prev;
      // Check if we crossed a new milestone
      const newMilestone = SESSION_ANIMAL_MILESTONES.find(
        (m) => m.threshold > prev && m.threshold <= streak,
      );
      if (newMilestone) {
        setSessionUnlocked((u) => (u.includes(newMilestone.animal) ? u : [...u, newMilestone.animal]));
        setUnlockPopup(newMilestone);
      }
      return streak;
    });
  }

  function handleGameStart() {
    // Reset session unlocks when a new game starts.
    setSessionMaxStreak(0);
    setCurrentStreak(0);
    setSessionUnlocked(['cow']);
    setSelectedAnimal('cow');
    setUnlockPopup(null);
  }

  // ── Round generation ────────────────────────────────────────────────────────
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
    return Math.random() < 0.5 ? makeEnglishSlingshotRound() : makeMathSlingshotRound(streak);
  }, [makeEnglishSlingshotRound, makeMathSlingshotRound]);

  const { emoji, title, desc } = MODE_META[gameMode];
  const weaponInfo = getWeaponInfo(currentStreak);

  return (
    <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-2 sm:py-8">
      {/* ── Unlock popup ─────────────────────────────────────────────────────── */}
      {unlockPopup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setUnlockPopup(null)}
        >
          <div className="mx-4 flex flex-col items-center rounded-3xl border-4 border-[var(--hero-gold)] bg-gradient-to-br from-fuchsia-950 via-indigo-950 to-black p-8 text-center shadow-2xl">
            <div className="animate-bounce text-7xl">{unlockPopup.emoji}</div>
            <h2 className="mt-3 text-2xl font-extrabold text-[var(--hero-gold)]">🎉 解鎖新角色！</h2>
            <p className="mt-1 text-xl font-bold text-white">{unlockPopup.label}登場！</p>
            <p className="mt-2 text-sm text-zinc-400">連續答對 {unlockPopup.threshold} 題達成</p>
            <p className="mt-4 text-xs text-zinc-500">點任意處繼續</p>
          </div>
        </div>
      )}

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

        {/* ── Animal + weapon selector strip ─────────────────────────────────── */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          {/* Animal selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-400">目標動物：</span>
            {ALL_ANIMALS.map((a) => {
              const isUnlocked = sessionUnlocked.includes(a.type);
              const isSelected = selectedAnimal === a.type;
              const milestone = SESSION_ANIMAL_MILESTONES.find((m) => m.animal === a.type);
              return (
                <button
                  key={a.type}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => setSelectedAnimal(a.type)}
                  title={isUnlocked ? a.label : `連續答對 ${milestone?.threshold} 題解鎖`}
                  className={`shrink-0 rounded-lg px-2 py-1 text-xl leading-none transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSelected
                      ? 'bg-[var(--hero-gold)] shadow ring-2 ring-yellow-300'
                      : isUnlocked
                        ? 'bg-white/10 hover:bg-white/20'
                        : 'bg-white/5'
                  }`}
                >
                  {isUnlocked ? a.emoji : '🔒'}
                </button>
              );
            })}
          </div>

          {/* Weapon display (streak-based, informational) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-400">目前武器：</span>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-lg leading-none" title={weaponInfo.label}>
              {weaponInfo.emoji}
            </span>
            <span className="text-xs text-zinc-500">{weaponInfo.label}</span>
          </div>

          {/* Streak progress */}
          <div className="ml-auto text-xs text-zinc-500">
            連續 <span className="font-bold text-white">{currentStreak}</span>
            {(() => {
              const next = SESSION_ANIMAL_MILESTONES.find(
                (m) => !sessionUnlocked.includes(m.animal),
              );
              return next ? (
                <span> → 再 <span className="text-amber-400">{next.threshold - currentStreak}</span> 題解鎖{next.emoji}</span>
              ) : null;
            })()}
          </div>
        </div>

        {/* ── Game panel ─────────────────────────────────────────────────────── */}
        <div className="mt-3">
          <SlingshotGame
            key={gameMode}
            makeRound={makeRound}
            onSave={(name, score) => recordAngryCowRun(gameMode, name, score, Date.now())}
            onRename={renameAngryCowRecord}
            lastPlayerName={lastPlayerName}
            animalType={selectedAnimal}
            animalEmoji="🐮"
            projectileEmoji="🐦"
            onStreakChange={handleStreakChange}
            onGameStart={handleGameStart}
          />
        </div>

        {/* ── Leaderboard — compact strip below the game ─────────────────────── */}
        <div className="mt-3">
          <AngryCowLeaderboardPanel mode={gameMode} compact />
        </div>
      </div>
    </main>
  );
}
