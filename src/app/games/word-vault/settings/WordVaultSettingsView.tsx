'use client';

import Link from 'next/link';
import {
  useGhostCount,
  useGhostSpeed,
  useMazeWordSources,
  useTunnelMode,
  setGhostCount,
  setGhostSpeed,
  setMazeWordSources,
  setTunnelMode,
  MIN_GHOST_COUNT,
  MAX_GHOST_COUNT,
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type GhostSpeed,
  type WordSourceKey,
} from '@/lib/wordVaultSettings';
import { useBestCompletions, removeCompletion } from '@/lib/wordVaultHistory';

const GHOST_OPTIONS = Array.from(
  { length: MAX_GHOST_COUNT - MIN_GHOST_COUNT + 1 },
  (_, i) => MIN_GHOST_COUNT + i,
);

const SPEED_OPTIONS: { value: GhostSpeed; label: string }[] = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '普通' },
  { value: 'fast', label: '快' },
];

export default function WordVaultSettingsView() {
  const ghostCount = useGhostCount();
  const ghostSpeed = useGhostSpeed();
  const wordSources = useMazeWordSources();
  const tunnelMode = useTunnelMode();
  const bestCompletions = useBestCompletions();

  function toggleSource(key: WordSourceKey) {
    const next = wordSources.includes(key) ? wordSources.filter((k) => k !== key) : [...wordSources, key];
    setMazeWordSources(next);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/games/word-vault" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🎓 已解鎖的單字（共 {bestCompletions.length} 個）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          如果小朋友對某個單字還不熟，可以移除它的解鎖紀錄，下次破關就能重新拿到星星。
        </p>
        {bestCompletions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有解鎖任何單字。</p>
        ) : (
          <div className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {bestCompletions.map((c) => (
              <div
                key={c.word}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
              >
                <span>
                  {c.emoji} {c.word}
                  <span className="ml-2 text-zinc-500">（{c.zh}）</span>
                  <span className="ml-2">
                    {'⭐'.repeat(c.stars)}
                    {'☆'.repeat(3 - c.stars)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeCompletion(c.word)}
                  aria-label="移除這個單字的解鎖紀錄"
                  className="ml-2 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-500"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">👻 幽靈數量</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {GHOST_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGhostCount(n)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                ghostCount === n
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {n} 隻
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">幽靈越多，迷宮探索的挑戰性越高。</p>

        <h2 className="mt-4 text-sm font-bold text-zinc-900">🏃 幽靈速度</h2>
        <div className="mt-2 flex gap-2">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGhostSpeed(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                ghostSpeed === opt.value
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">📚 題目來源</h2>
          <button
            type="button"
            onClick={() => setMazeWordSources(ALL_WORD_SOURCES)}
            className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
          >
            全選
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          出題只會從下方勾選的來源抽字，有勾選多個來源時，抽題順序固定為「本週單字 → 加強單字 → 自訂單字 → 自然發音卡 →
          重要單字卡」，同一輪內盡量不重複，抽完一輪才會重新循環。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORD_SOURCE_DISPLAY_ORDER.map((key) => {
            const checked = wordSources.includes(key);
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                  checked ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSource(key)}
                  className="h-4 w-4 cursor-pointer accent-zinc-900"
                />
                {WORD_SOURCE_LABELS[key]}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          自訂單字可以到「自訂單字」頁面新增；可複選，取消到剩 0 個時會自動恢復全選。
        </p>
      </div>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🌀 穿透模式</h2>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setTunnelMode(false)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              !tunnelMode ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            一般版
          </button>
          <button
            type="button"
            onClick={() => setTunnelMode(true)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              tunnelMode ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            穿透版
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          穿透版：小精靈撞到外牆會從對面穿出，可以快速逃離幽靈！
        </p>
      </div>
    </main>
  );
}
