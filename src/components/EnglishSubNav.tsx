'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useCurriculum, getCurrentWeekKey, getActiveWordIds } from '@/lib/curriculum';
import { useProgress } from '@/lib/progress';
import { words as allPhonicsWords } from '@/data/words';
import { sightWords as allSightWords } from '@/data/sightWords';

const sectionItems = [
  { href: '/english', label: '總覽' },
  { href: '/browse', label: '自然發音字卡' },
  { href: '/sight-words', label: '重要單字卡' },
  { href: '/custom-words', label: '自訂單字' },
  { href: '/progress', label: '學習進度' },
  { href: '/quiz', label: '學習測驗' },
];

export default function EnglishSubNav() {
  const pathname = usePathname();
  const curriculum = useCurriculum();
  const progress = useProgress();
  const thisWeekCount = useMemo(
    () => getActiveWordIds(curriculum, progress, getCurrentWeekKey()).length,
    [curriculum, progress],
  );
  const reinforceCount = useMemo(
    () => [...allPhonicsWords, ...allSightWords].filter((w) => progress[w.id]?.needsReinforcement && !progress[w.id]?.canUnderstand).length,
    [progress],
  );

  return (
    <div className="no-print -mx-4 mb-6 overflow-x-auto border-b border-white/10 px-4 pb-3">
      <div className="flex gap-1.5">
        <Link
          href="/english"
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors visited:text-inherit ${
            pathname === '/english'
              ? 'bg-[var(--hero-gold)] text-zinc-900'
              : 'bg-white/10 text-zinc-200 hover:bg-white/20'
          }`}
        >
          總覽
        </Link>

        {/* 當週單字 quick-access shortcut */}
        <Link
          href="/browse?filter=thisWeek"
          className="shrink-0 flex items-center gap-1 rounded-full border border-[var(--hero-gold)] px-3 py-1.5 text-sm font-medium text-[var(--hero-gold)] transition-colors hover:bg-[var(--hero-gold)] hover:text-zinc-900 visited:text-inherit"
        >
          📅 當週字卡
          {thisWeekCount > 0 && (
            <span className="rounded-full bg-[var(--hero-gold)] px-1.5 py-0.5 text-[10px] font-bold text-zinc-900 leading-none">
              {thisWeekCount}
            </span>
          )}
        </Link>

        {/* 加強單字 quick-access shortcut */}
        <Link
          href="/browse?filter=reinforce"
          className="shrink-0 flex items-center gap-1 rounded-full border border-orange-400 px-3 py-1.5 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-400 hover:text-zinc-900 visited:text-inherit"
        >
          🔥 加強單字
          {reinforceCount > 0 && (
            <span className="rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {reinforceCount}
            </span>
          )}
        </Link>

        {sectionItems.slice(1).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors visited:text-inherit ${
                isActive
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-white/10 text-zinc-200 hover:bg-white/20'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
