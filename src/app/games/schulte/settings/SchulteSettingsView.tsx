'use client';

import Link from 'next/link';
import {
  useSchulteGridDim,
  useSchulteMode,
  useSchulteTimeLimit,
  useSchulteNumberCount,
  setSchulteGridDim,
  setSchulteMode,
  setSchulteTimeLimit,
  setSchulteNumberCount,
  GRID_DIM_OPTIONS,
  MODE_OPTIONS,
  TIME_LIMIT_OPTIONS,
  NUMBER_COUNT_OPTIONS,
  type SchulteGridDim,
  type SchulteMode,
  type SchulteTimeLimit,
  type SchulteNumberCount,
} from '@/lib/schulteSettings';

export default function SchulteSettingsView() {
  const gridDim = useSchulteGridDim();
  const mode = useSchulteMode();
  const timeLimit = useSchulteTimeLimit();
  const numberCount = useSchulteNumberCount();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/schulte"
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔳 方格大小</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {GRID_DIM_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSchulteGridDim(n as SchulteGridDim)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                gridDim === n ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {n} × {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          內容項目較多時（例如注音符號、英文字母）會自動分批進行，按完一批接著下一批。
        </p>
      </div>

      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🎮 挑戰模式</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSchulteMode(opt.value as SchulteMode)}
              className={`flex-1 rounded-lg px-4 py-2 text-left text-sm font-bold ${
                mode === opt.value ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
              <div className="mt-0.5 text-xs font-normal opacity-80">{opt.desc}</div>
            </button>
          ))}
        </div>

        {mode === 'timedLimit' && (
          <>
            <h2 className="mt-4 text-sm font-bold text-zinc-900">⏱️ 限時秒數</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIME_LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSchulteTimeLimit(n as SchulteTimeLimit)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    timeLimit === n ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {n} 秒
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔢 數字範圍（數字項目用）</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {NUMBER_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSchulteNumberCount(n as SchulteNumberCount)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                numberCount === n ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              1～{n}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
