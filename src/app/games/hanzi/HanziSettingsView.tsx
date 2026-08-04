'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useHanziWords,
  addHanziWord,
  removeHanziWord,
  toggleHanziNeedsPractice,
} from '@/lib/hanziWords';

export default function HanziSettingsView() {
  const words = useHanziWords();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const result = addHanziWord(input);
    if (!result.ok) {
      setError(result.error ?? '新增失敗');
      return;
    }
    setInput('');
    setError(null);
  }

  const practicingCount = words.filter((w) => w.needsPractice).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/hanzi"
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 國字設定</h1>
      <p className="mt-1 text-sm text-zinc-300">
        目前共 {words.length} 個字，{practicingCount} 個還在練習中。新增的字會同步到你其他裝置。
      </p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">新增國字</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="例如：山"
            maxLength={6}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-lg text-zinc-900"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-[var(--hero-red)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
          >
            新增
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">已新增的字</h2>
        <p className="mt-1 text-xs text-zinc-400">
          取消勾選代表小朋友已經很熟悉了，之後出題不會再考這個字（不會刪除，可以隨時再勾回來）。
        </p>
        {words.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有新增任何字。</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {words.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-zinc-200"
              >
                <label className="flex flex-1 items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={w.needsPractice}
                    onChange={() => toggleHanziNeedsPractice(w.id)}
                    className="h-4 w-4 cursor-pointer accent-[var(--hero-gold)]"
                  />
                  <span className={`text-2xl font-bold ${w.needsPractice ? '' : 'text-zinc-500 line-through'}`}>
                    {w.char}
                  </span>
                  {!w.needsPractice && <span className="text-xs text-emerald-400">已熟悉</span>}
                </label>
                <button
                  type="button"
                  onClick={() => removeHanziWord(w.id)}
                  aria-label="刪除這個字"
                  className="ml-2 rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-red-400"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
