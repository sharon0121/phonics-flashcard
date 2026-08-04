'use client';

import Link from 'next/link';
import {
  useSchulteMode,
  useSchulteTimeLimit,
  setSchulteMode,
  setSchulteTimeLimit,
  MODE_OPTIONS,
  TIME_LIMIT_OPTIONS,
  type SchulteMode,
  type SchulteTimeLimit,
} from '@/lib/schulteSettings';

export default function SchulteSettingsView() {
  const mode = useSchulteMode();
  const timeLimit = useSchulteTimeLimit();

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
      <p className="mt-1 text-xs text-zinc-400">方格固定為 5 × 5，內容較多時會自動分批進行。</p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
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
    </main>
  );
}
