'use client';

import Link from 'next/link';
import {
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type WordSourceKey,
} from '@/lib/heroClimbSettings';
import { useDetectiveWordSources, setDetectiveWordSources } from '@/lib/detectiveVennSettings';

export default function DetectiveVennSettingsView() {
  const sources = useDetectiveWordSources();

  function toggleSource(key: WordSourceKey) {
    const next = sources.includes(key) ? sources.filter((k) => k !== key) : [...sources, key];
    setDetectiveWordSources(next);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/detective-venn"
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">📚 題庫來源</h2>
          <button
            type="button"
            onClick={() => setDetectiveWordSources(ALL_WORD_SOURCES)}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900"
          >
            全選
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          選擇英文單字題目要從哪些單字庫抽題，跟小精靈大探險的單字來源設定一樣。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORD_SOURCE_DISPLAY_ORDER.map((key) => {
            const checked = sources.includes(key);
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
      </div>
    </main>
  );
}
