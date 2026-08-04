'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { words as allPhonicsWords } from '@/data/words';
import { sightWords } from '@/data/sightWords';
import { useProgress } from '@/lib/progress';
import { useCurriculum, getCurrentWeekKey, getWeekRangeLabel, getActiveWordIds } from '@/lib/curriculum';
import EnglishSubNav from '@/components/EnglishSubNav';
import HeroMascot from '@/components/HeroMascot';

export default function EnglishHome() {
  const progress = useProgress();
  const curriculum = useCurriculum();

  const weekKey = getCurrentWeekKey();
  const weekRange = getWeekRangeLabel(weekKey);
  const thisWeekIds = useMemo(
    () => getActiveWordIds(curriculum, progress, weekKey),
    [curriculum, progress, weekKey],
  );
  const phonicsThisWeek = useMemo(
    () => allPhonicsWords.filter((w) => thisWeekIds.includes(w.id)).length,
    [thisWeekIds],
  );
  const sightThisWeek = useMemo(
    () => sightWords.filter((w) => thisWeekIds.includes(w.id)).length,
    [thisWeekIds],
  );
  const totalThisWeek = thisWeekIds.length;

  const reinforceCount = useMemo(
    () => [...allPhonicsWords, ...sightWords].filter((w) => progress[w.id]?.needsReinforcement && !progress[w.id]?.canUnderstand).length,
    [progress],
  );

  const subCards = [
    {
      href: '/browse',
      emoji: '🔤',
      title: '自然發音字卡',
      description: '六階段自然發音，約 467 字',
      accent: 'var(--hero-red)',
    },
    {
      href: '/sight-words',
      emoji: '👁️',
      title: '重要單字卡',
      description: 'Dolch 高頻視覺單字，314 字',
      accent: 'var(--hero-blue)',
    },
    {
      href: '/progress',
      emoji: '📊',
      title: '學習進度',
      description: '追蹤進度，設定每週課程',
      accent: '#10b981',
    },
    {
      href: '/quiz',
      emoji: '✏️',
      title: '學習測驗',
      description: '看圖選字，看字選圖小測驗',
      accent: '#a855f7',
    },
  ];

  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-english.png" alt="" />
      <div className="relative z-10">
        <EnglishSubNav />
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">英文學習</h1>
        <p className="mt-1 text-sm text-zinc-300">選一個模式開始練習吧！</p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">

          {/* 當週字卡 */}
          <Link
            href="/browse?filter=thisWeek"
            style={{ borderColor: 'var(--hero-gold)' }}
            className="relative flex flex-col items-center rounded-2xl border-[3px] bg-white p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl"
          >
            {totalThisWeek > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-zinc-900">
                {totalThisWeek}
              </span>
            )}
            <span className="text-5xl">📅</span>
            <h2 className="mt-3 text-base font-bold text-zinc-900">當週字卡</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {totalThisWeek > 0 ? weekRange : '本週尚未設定'}
            </p>
          </Link>

          {/* 加強單字 */}
          <Link
            href="/browse?filter=reinforce"
            style={{ borderColor: '#f97316' }}
            className="relative flex flex-col items-center rounded-2xl border-[3px] bg-white p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl"
          >
            {reinforceCount > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-orange-400 px-2 py-0.5 text-xs font-bold text-white">
                {reinforceCount}
              </span>
            )}
            <span className="text-5xl">🔥</span>
            <h2 className="mt-3 text-base font-bold text-zinc-900">加強單字</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {reinforceCount > 0 ? `${reinforceCount} 個待加強` : '在字卡上標記'}
            </p>
          </Link>

          {/* 其餘 4 張卡 */}
          {subCards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              style={{ borderColor: c.accent }}
              className="flex flex-col items-center rounded-2xl border-[3px] bg-white p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl"
            >
              <span className="text-5xl">{c.emoji}</span>
              <h2 className="mt-3 text-base font-bold text-zinc-900">{c.title}</h2>
              <p className="mt-1 text-xs text-zinc-500">{c.description}</p>
            </Link>
          ))}

        </div>
      </div>
    </main>
  );
}
