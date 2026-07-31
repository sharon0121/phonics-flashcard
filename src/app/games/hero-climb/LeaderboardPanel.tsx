'use client';

import { useClimbLeaderboard } from '@/lib/heroClimbHistory';

const TOP_N = 10;

function Row({ rank, name, floor, wordsCompleted }: { rank: number; name: string; floor: number; wordsCompleted: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-zinc-50 px-1.5 py-1">
      <span className="w-4 shrink-0 text-center text-[10px] font-extrabold text-zinc-400">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-bold text-zinc-900">{name}</div>
        <div className="text-[8px] leading-none text-zinc-500">
          拼出 {wordsCompleted} 個單字・深度 {floor}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPanel({ matchHeight }: { matchHeight?: number | null }) {
  const leaderboard = useClimbLeaderboard();
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
              <div key={r.id} className="w-28 shrink-0">
                <Row rank={i + 1} name={r.name} floor={r.floor} wordsCompleted={r.wordsCompleted} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sm and up: sidebar matched to the game panel's own rendered height,
          showing only the top 10 so it never grows past that height in the
          first place. */}
      <div
        className="hidden w-36 shrink-0 flex-col rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3 sm:flex"
        style={matchHeight ? { height: `${matchHeight}px` } : undefined}
      >
        <h2 className="text-center text-xs font-bold text-zinc-900">🏆 排行榜 Top 10</h2>
        <p className="text-center text-[10px] text-zinc-500">共 {leaderboard.length} 筆紀錄</p>
        <div className="mt-2 flex-1 overflow-y-auto">
          {leaderboard.length === 0 ? (
            <p className="mt-6 text-center text-[11px] text-zinc-400">還沒有任何紀錄</p>
          ) : (
            <div className="flex flex-col gap-1">
              {top.map((r, i) => (
                <Row key={r.id} rank={i + 1} name={r.name} floor={r.floor} wordsCompleted={r.wordsCompleted} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
