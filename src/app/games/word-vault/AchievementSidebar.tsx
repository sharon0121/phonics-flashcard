'use client';

import { useBestCompletions } from '@/lib/wordVaultHistory';

const SCROLL_THRESHOLD = 8;
const SECONDS_PER_ITEM = 1.8;

export default function AchievementSidebar() {
  const completions = useBestCompletions();
  const shouldScroll = completions.length > SCROLL_THRESHOLD;
  const list = shouldScroll ? [...completions, ...completions] : completions;

  return (
    <div className="flex w-full shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3 sm:w-32">
      <h2 className="text-center text-xs font-bold text-zinc-900">🏆 成就榜</h2>
      <p className="text-center text-[10px] text-zinc-500">已完成 {completions.length} 個單字</p>
      <div className="mt-2 flex-1 overflow-hidden">
        {completions.length === 0 ? (
          <p className="mt-6 text-center text-[11px] text-zinc-400">還沒有完成任何單字</p>
        ) : (
          <div
            className={shouldScroll ? 'achievement-marquee flex flex-col gap-1' : 'flex flex-col gap-1'}
            style={shouldScroll ? { animationDuration: `${completions.length * SECONDS_PER_ITEM}s` } : undefined}
          >
            {list.map((c, i) => (
              <div key={`${c.word}-${i}`} className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-1.5 py-1">
                <span className="shrink-0 text-base leading-none">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-bold text-zinc-900">{c.word}</div>
                  <div className="text-[8px] leading-none">
                    {'⭐'.repeat(c.stars)}
                    {'☆'.repeat(3 - c.stars)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
