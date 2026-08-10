'use client';

import Link from 'next/link';
import { SMART_GRID_DIFFICULTY, SMART_GRID_DIFFICULTIES, type SmartGridDifficulty } from '@/lib/smartGrid';
import { useSmartGridProgress, resetSmartGridProgress } from '@/lib/smartGridProgress';

const DIFFICULTY_STARS: Record<SmartGridDifficulty, string> = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' };

export default function SmartGridSettingsView() {
  const progress = useSmartGridProgress();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/smart-grid"
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔄 重置進度</h2>
        <p className="mt-1 text-xs text-zinc-500">選擇要重置哪個難度的破案紀錄，重置後該難度的🏆會從 0 重新開始算。</p>

        <div className="mt-3 flex flex-col gap-2">
          {SMART_GRID_DIFFICULTIES.map((d) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900"
            >
              <span className="font-bold">
                {DIFFICULTY_STARS[d]} {SMART_GRID_DIFFICULTY[d].label}
                <span className="ml-2 font-normal text-zinc-500">🏆 已完成 {progress[d]} 題</span>
              </span>
              <button
                type="button"
                onClick={() => resetSmartGridProgress(d)}
                disabled={progress[d] === 0}
                className="rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                重置
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
