'use client';

import Link from 'next/link';
import { phases, getWordsByPhase } from '@/data/words';
import { sightWords } from '@/data/sightWords';
import { useProgress } from '@/lib/progress';
import type { ProgressMap, Word } from '@/lib/types';
import EnglishSubNav from '@/components/EnglishSubNav';
import HeroMascot from '@/components/HeroMascot';

const ACCENTS = ['var(--hero-red)', 'var(--hero-blue)', 'var(--hero-gold)'];

function completionOf(wordsInGroup: Word[], progress: ProgressMap) {
  if (wordsInGroup.length === 0) return { percent: 0, total: 0 };
  let points = 0;
  for (const w of wordsInGroup) {
    const entry = progress[w.id];
    if (entry?.canPronounce) points += 1;
    if (entry?.canUnderstand) points += 1;
  }
  const percent = Math.round((points / (wordsInGroup.length * 2)) * 100);
  return { percent, total: wordsInGroup.length };
}

function phaseCompletion(phase: number, progress: ProgressMap) {
  return completionOf(getWordsByPhase(phase), progress);
}

export default function EnglishHome() {
  const progress = useProgress();
  const sightWordsCompletion = completionOf(sightWords, progress);

  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-english.png" alt="" />
      <div className="relative z-10">
      <EnglishSubNav />

      <h1 className="text-3xl font-bold text-[var(--hero-gold)]">英文學習</h1>
      <p className="mt-2 text-sm text-zinc-300">選一個階段開始瀏覽、朗讀、練習吧！</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {phases.map((p, i) => {
          const { percent, total } = phaseCompletion(p.phase, progress);
          const disabled = total === 0;
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <Link
              key={p.phase}
              href={disabled ? '#' : `/browse?phase=${p.phase}`}
              aria-disabled={disabled}
              style={{ borderColor: accent }}
              className={`rounded-2xl border-[3px] bg-white p-5 shadow-md transition-transform ${
                disabled ? 'pointer-events-none opacity-50' : 'hover:-translate-y-0.5 hover:rotate-[0.5deg] hover:shadow-xl'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900">{p.phaseLabel}</h2>
                <span className="text-xs text-zinc-400">
                  {disabled ? '尚未建立' : `${total} 字`}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percent}%`, backgroundColor: accent }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-zinc-400">{percent}%</div>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 text-2xl font-bold text-[var(--hero-gold)]">重要單字卡</h2>
      <p className="mt-1 text-sm text-zinc-300">
        從拼音跨越到流利閱讀的關鍵一步：看到就直接認出來的高頻字。
      </p>
      <Link
        href="/sight-words"
        style={{ borderColor: 'var(--hero-blue)' }}
        className="mt-4 block rounded-2xl border-[3px] bg-white p-5 shadow-md transition-transform hover:-translate-y-0.5 hover:rotate-[0.5deg] hover:shadow-xl sm:max-w-sm"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">重要單字卡</h3>
          <span className="text-xs text-zinc-400">{sightWordsCompletion.total} 字</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${sightWordsCompletion.percent}%`, backgroundColor: 'var(--hero-blue)' }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-zinc-400">{sightWordsCompletion.percent}%</div>
      </Link>
      </div>
    </main>
  );
}
