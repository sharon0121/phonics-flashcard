'use client';

import { useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import SchulteGame from './SchulteGame';
import HanziSchulteQuiz from './HanziSchulteQuiz';
import WordGridSchulteQuiz from './WordGridSchulteQuiz';
import {
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  NUMBER_PATTERN_DISPLAY_ORDER,
  NUMBER_PATTERN_LABELS,
  type SchulteCategory,
  type NumberPattern,
} from '@/data/schulteContent';

type ExtraCategory = 'hanzi' | 'wordGrid';
type RealCategory = SchulteCategory | ExtraCategory;
type ViewMode = RealCategory | 'random';

const CATEGORY_DESC: Record<SchulteCategory, string> = {
  zhuyin: 'ㄅ 到 ㄦ，練習注音符號的視覺搜尋',
  upper: 'A 到 Z，練習大寫字母順序',
  lower: 'a 到 z，練習小寫字母順序',
  numbers: '順序、奇數、偶數、5 的倍數，多種數字變化',
};

const NUMBER_PATTERN_DESC: Record<NumberPattern, string> = {
  sequential: '1、2、3⋯⋯照順序數到 25',
  odd: '1、3、5⋯⋯奇數數到 49',
  even: '2、4、6⋯⋯偶數數到 50',
  multiplesOf5: '5、10、15⋯⋯數到 125',
};

const EXTRA_CATEGORY_LABELS: Record<ExtraCategory, string> = {
  hanzi: '國字複習',
  wordGrid: '單字複習',
};
const EXTRA_CATEGORY_EMOJI: Record<ExtraCategory, string> = {
  hanzi: '🈶',
  wordGrid: '🔤',
};
const EXTRA_CATEGORY_DESC: Record<ExtraCategory, string> = {
  hanzi: '自己新增學過的國字，聽發音選出正確答案',
  wordGrid: '聽發音選英文單字，來源可自訂，答錯 3 次或超時就失敗',
};

// Each category gets its own accent colour so the cards are told apart at
// a glance instead of all looking like the same gold-bordered tile.
const CARD_COLORS: Record<RealCategory, { border: string; text: string; bg: string }> = {
  zhuyin: { border: 'border-red-400', text: 'text-red-300', bg: 'bg-red-500/10' },
  upper: { border: 'border-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/10' },
  lower: { border: 'border-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  numbers: { border: 'border-purple-400', text: 'text-purple-300', bg: 'bg-purple-500/10' },
  hanzi: { border: 'border-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  wordGrid: { border: 'border-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10' },
};

const ALL_REAL_CATEGORIES: RealCategory[] = [...CATEGORY_DISPLAY_ORDER, 'hanzi', 'wordGrid'];

function isExtraCategory(v: ViewMode): v is ExtraCategory {
  return v === 'hanzi' || v === 'wordGrid';
}

interface CardConfig {
  key: ViewMode;
  emoji: string;
  label: string;
  desc: string;
}

export default function SchulteView() {
  const [category, setCategory] = useState<ViewMode | null>(null);
  const [numberPattern, setNumberPattern] = useState<NumberPattern | null>(null);

  function pickRandomCategory() {
    const pick = ALL_REAL_CATEGORIES[Math.floor(Math.random() * ALL_REAL_CATEGORIES.length)];
    setCategory(pick);
    if (pick === 'numbers') {
      const patterns = NUMBER_PATTERN_DISPLAY_ORDER;
      setNumberPattern(patterns[Math.floor(Math.random() * patterns.length)]);
    } else {
      setNumberPattern(null);
    }
  }

  if (category === 'numbers' && !numberPattern) {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              Back
            </button>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔢 數字挑戰</h1>
          <p className="mt-3 text-sm font-medium text-zinc-300">選一種數字變化：</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {NUMBER_PATTERN_DISPLAY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNumberPattern(p)}
                className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-purple-400 bg-purple-500/10 p-6 text-center shadow-lg transition-all hover:bg-purple-500/20 hover:shadow-xl"
              >
                <span className="text-xl font-bold text-purple-300">{NUMBER_PATTERN_LABELS[p]}</span>
                <span className="text-sm leading-relaxed text-zinc-300">{NUMBER_PATTERN_DESC[p]}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (category && isExtraCategory(category)) {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          {category === 'hanzi' ? (
            <HanziSchulteQuiz onBack={() => setCategory(null)} />
          ) : (
            <WordGridSchulteQuiz onBack={() => setCategory(null)} />
          )}
        </div>
      </main>
    );
  }

  if (category && category !== 'random') {
    return (
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <HeroMascot src="/heroes/cutout-game.png" alt="" />
        <div className="relative z-10">
          <SchulteGame
            category={category}
            numberPattern={numberPattern ?? undefined}
            onBack={() => {
              if (category === 'numbers') setNumberPattern(null);
              else setCategory(null);
            }}
          />
        </div>
      </main>
    );
  }

  const cards: CardConfig[] = [
    ...CATEGORY_DISPLAY_ORDER.map((key) => ({
      key,
      emoji: CATEGORY_EMOJI[key],
      label: CATEGORY_LABELS[key],
      desc: CATEGORY_DESC[key],
    })),
    ...(['hanzi', 'wordGrid'] as ExtraCategory[]).map((key) => ({
      key,
      emoji: EXTRA_CATEGORY_EMOJI[key],
      label: EXTRA_CATEGORY_LABELS[key],
      desc: EXTRA_CATEGORY_DESC[key],
    })),
  ];

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
            href="/games/schulte/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔍 舒爾特訓練</h1>
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Schulte Table</p>
        <p className="mt-3 text-sm font-medium text-zinc-300">選一個項目開始練習：</p>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 隨機挑戰 — rainbow gradient border marks it as the wildcard option */}
          <button
            type="button"
            onClick={pickRandomCategory}
            className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-fuchsia-500/15 via-amber-400/15 to-sky-500/15 p-6 text-center shadow-lg transition-all hover:shadow-xl"
          >
            <span className="text-5xl transition-transform group-hover:scale-110">🎲</span>
            <span className="text-xl font-bold text-[var(--hero-gold)]">隨機挑戰</span>
            <span className="text-sm leading-relaxed text-zinc-300">每次隨機挑一種項目，一下英文一下注音！</span>
          </button>

          {cards.map((c) => {
            const colors = CARD_COLORS[c.key as RealCategory];
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 text-center shadow-lg transition-all hover:shadow-xl`}
              >
                <span className={`text-xl font-bold ${colors.text}`}>{c.label}</span>
                <span className="text-sm leading-relaxed text-zinc-300">{c.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
