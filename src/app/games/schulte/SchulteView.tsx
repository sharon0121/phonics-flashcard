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
type ViewMode = SchulteCategory | ExtraCategory;

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

const EXTRA_CATEGORY_DISPLAY_ORDER: ExtraCategory[] = ['hanzi', 'wordGrid'];
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

function isExtraCategory(v: ViewMode): v is ExtraCategory {
  return v === 'hanzi' || v === 'wordGrid';
}

export default function SchulteView() {
  const [category, setCategory] = useState<ViewMode | null>(null);
  const [numberPattern, setNumberPattern] = useState<NumberPattern | null>(null);

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
                className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
              >
                <span className="text-xl font-bold text-[var(--hero-gold)]">{NUMBER_PATTERN_LABELS[p]}</span>
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

  if (category) {
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
          {CATEGORY_DISPLAY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
            >
              <span className="text-5xl transition-transform group-hover:scale-110">{CATEGORY_EMOJI[key]}</span>
              <span className="text-xl font-bold text-[var(--hero-gold)]">{CATEGORY_LABELS[key]}</span>
              <span className="text-sm leading-relaxed text-zinc-300">{CATEGORY_DESC[key]}</span>
            </button>
          ))}
          {EXTRA_CATEGORY_DISPLAY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className="group flex flex-col items-center gap-2 rounded-2xl border-2 border-sky-400 bg-white/10 p-6 text-center shadow-lg transition-all hover:bg-white/20 hover:shadow-xl"
            >
              <span className="text-5xl transition-transform group-hover:scale-110">{EXTRA_CATEGORY_EMOJI[key]}</span>
              <span className="text-xl font-bold text-sky-300">{EXTRA_CATEGORY_LABELS[key]}</span>
              <span className="text-sm leading-relaxed text-zinc-300">{EXTRA_CATEGORY_DESC[key]}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
