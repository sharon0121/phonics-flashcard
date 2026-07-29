'use client';

import { useBestCompletions } from '@/lib/wordVaultHistory';

const SCROLL_THRESHOLD = 8;
const SECONDS_PER_ITEM = 1.8;

function Badge({ emoji, word, stars }: { emoji: string; word: string; stars: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-1.5 py-1">
      <span className="shrink-0 text-base leading-none">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold text-zinc-900">{word}</div>
        <div className="text-[8px] leading-none">
          {'⭐'.repeat(stars)}
          {'☆'.repeat(3 - stars)}
        </div>
      </div>
    </div>
  );
}

export default function AchievementSidebar() {
  const completions = useBestCompletions();
  const shouldScroll = completions.length > SCROLL_THRESHOLD;
  const list = shouldScroll ? [...completions, ...completions] : completions;

  return (
    <>
      {/* Mobile/narrow: a short, fixed-height horizontal scroller so it never
          grows with the achievement count and eats into the game's vertical
          space budget. */}
      <div className="flex h-14 w-full shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 px-3 py-1 sm:hidden">
        <p className="text-center text-[9px] font-bold text-zinc-900 leading-tight">
          🏆 成就榜・已完成 {completions.length} 個單字
        </p>
        {completions.length === 0 ? (
          <p className="text-center text-[10px] leading-tight text-zinc-400">還沒有完成任何單字</p>
        ) : (
          <div className="mt-0.5 flex flex-1 gap-1.5 overflow-x-auto">
            {completions.map((c) => (
              <div key={c.word} className="w-20 shrink-0">
                <Badge emoji={c.emoji} word={c.word} stars={c.stars} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sm and up: tall sidebar matched to the maze's height via flex
          stretch, with an auto-scrolling marquee once there are many. */}
      <div className="hidden w-32 shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3 sm:flex">
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
                <Badge key={`${c.word}-${i}`} emoji={c.emoji} word={c.word} stars={c.stars} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
