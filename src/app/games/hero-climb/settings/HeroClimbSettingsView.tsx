'use client';

import Link from 'next/link';
import { useMarqueeSpeed, setMarqueeSpeed, type MarqueeSpeed } from '@/lib/heroClimbSettings';
import { useClimbLeaderboard } from '@/lib/heroClimbHistory';

const SPEED_OPTIONS: { value: MarqueeSpeed; label: string }[] = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '普通' },
  { value: 'fast', label: '快' },
];

export default function HeroClimbSettingsView() {
  const marqueeSpeed = useMarqueeSpeed();
  const leaderboard = useClimbLeaderboard();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/games/hero-climb" className="text-sm font-medium text-[var(--hero-gold)] hover:underline">
        ← 回小英雄下樓梯
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>
      <p className="mt-1 text-sm text-zinc-300">
        出題順序固定為「本週單字 → 加強單字 → 自訂單字 → 標準題庫」，拼完一個單字就換下一個，同一輪內盡量不重複。
      </p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🏃 排行榜跑馬燈速度</h2>
        <div className="mt-2 flex gap-2">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMarqueeSpeed(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                marqueeSpeed === opt.value
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">調整右側排行榜自動捲動的速度。</p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">🏆 完整排行榜（共 {leaderboard.length} 筆）</h2>
        {leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有任何紀錄，快去玩玩看吧！</p>
        ) : (
          <div className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg bg-white/5 p-2">
            {leaderboard.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-zinc-200"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 text-center font-extrabold text-zinc-400">{i + 1}</span>
                  <span className="font-bold">{r.name}</span>
                </span>
                <span className="text-xs text-zinc-400">
                  拼出 {r.wordsCompleted} 個單字・深度 {r.floor}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
