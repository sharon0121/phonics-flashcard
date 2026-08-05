'use client';

import { useAngryCowLeaderboard } from '@/lib/angryCowHistory';
import type { AngryCowMode } from '@/lib/angryCow';

const TOP_N = 15;
const TOP_COMPACT = 8;

function Row({ rank, name, score }: { rank: number; name: string; score: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-1.5 py-1">
      <span className="w-4 shrink-0 text-center text-[10px] font-extrabold text-zinc-400">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold text-zinc-900">{name}</div>
        <div className="text-[8px] leading-none text-zinc-500">得分 {score}</div>
      </div>
    </div>
  );
}

export default function AngryCowLeaderboardPanel({
  mode,
  matchHeight,
  compact,
}: {
  mode: AngryCowMode;
  matchHeight?: number | null;
  compact?: boolean;
}) {
  const leaderboard = useAngryCowLeaderboard(mode);

  // Compact horizontal strip — shown below the game panel in full-width layout.
  if (compact) {
    const top = leaderboard.slice(0, TOP_COMPACT);
    return (
      <div className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2">
        <span className="shrink-0 text-xs font-bold text-zinc-400">🏆 排行</span>
        {leaderboard.length === 0 ? (
          <span className="text-xs text-zinc-500">還沒有任何紀錄</span>
        ) : (
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {top.map((r, i) => (
              <div
                key={r.id}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5"
              >
                <span className="text-[10px] font-extrabold text-zinc-500">#{i + 1}</span>
                <span className="max-w-[5rem] truncate text-[10px] font-bold text-white">{r.name}</span>
                <span className="text-[10px] text-amber-400">{r.score}</span>
              </div>
            ))}
          </div>
        )}
        <span className="shrink-0 text-[10px] text-zinc-600">{leaderboard.length} 筆</span>
      </div>
    );
  }

  const top = leaderboard.slice(0, TOP_N);
  return (
    <>
      {/* Mobile/narrow: short fixed-height horizontal scroller. */}
      <div className="flex h-14 w-full shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 px-3 py-1 sm:hidden">
        <p className="text-center text-[9px] font-bold text-zinc-900 leading-tight">
          🏆 排行榜・共 {leaderboard.length} 筆紀錄
        </p>
        {leaderboard.length === 0 ? (
          <p className="text-center text-[10px] leading-tight text-zinc-400">還沒有任何紀錄</p>
        ) : (
          <div className="mt-0.5 flex flex-1 gap-1.5 overflow-x-auto">
            {top.map((r, i) => (
              <div key={r.id} className="w-24 shrink-0">
                <Row rank={i + 1} name={r.name} score={r.score} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sm and up: sidebar matched to the game panel's own rendered height. */}
      <div
        className="hidden w-36 shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3 sm:flex"
        style={matchHeight ? { height: `${matchHeight}px` } : undefined}
      >
        <h2 className="text-center text-xs font-bold text-zinc-900">🏆 排行榜 Top {TOP_N}</h2>
        <p className="text-center text-[10px] text-zinc-500">共 {leaderboard.length} 筆紀錄</p>
        <div className="mt-2 flex-1 overflow-y-auto">
          {leaderboard.length === 0 ? (
            <p className="mt-6 text-center text-[11px] text-zinc-400">還沒有任何紀錄</p>
          ) : (
            <div className="flex flex-col gap-1">
              {top.map((r, i) => (
                <Row key={r.id} rank={i + 1} name={r.name} score={r.score} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
