'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BUILTIN_SENTENCES } from '@/data/gameSentences';
import {
  useCustomSentences,
  useDisabledBuiltinIds,
  addCustomSentence,
  removeCustomSentence,
  toggleBuiltinSentence,
  enableAllBuiltinSentences,
} from '@/lib/gameSentences';

export default function SentenceSettingsView() {
  const customSentences = useCustomSentences();
  const disabledIds = useDisabledBuiltinIds();
  const [en, setEn] = useState('');
  const [zh, setZh] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enabledBuiltinCount = BUILTIN_SENTENCES.length - disabledIds.length;
  const totalActiveCount = enabledBuiltinCount + customSentences.length;

  function handleAdd() {
    const trimmedEn = en.trim();
    if (!trimmedEn) {
      setError('請輸入英文句子');
      return;
    }
    if (!/\s/.test(trimmedEn)) {
      setError('句子至少要有 2 個單字（用空白分隔）');
      return;
    }
    addCustomSentence(trimmedEn, zh);
    setEn('');
    setZh('');
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/games/coordinate-hunt" className="text-sm font-medium text-[var(--hero-gold)] hover:underline">
        ← 回座標寶藏迷宮
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 句子管理</h1>
      <p className="mt-1 text-sm text-zinc-300">
        目前題庫共 {totalActiveCount} 句（內建 {enabledBuiltinCount} / {BUILTIN_SENTENCES.length} 句啟用，自訂{' '}
        {customSentences.length} 句）。可以新增句子，也可以關閉太難或太簡單的內建句子，調整小朋友的練習難度。
      </p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <label className="block text-sm font-medium text-zinc-700">
          英文句子（用空白分開單字）
          <input
            type="text"
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder="例如：I like my dog."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-zinc-700">
          中文意思（選填）
          <input
            type="text"
            value={zh}
            onChange={(e) => setZh(e.target.value)}
            placeholder="例如：我喜歡我的狗。"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 rounded-lg bg-[var(--hero-red)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
        >
          新增句子
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">已新增的句子</h2>
        {customSentences.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有新增任何句子。</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {customSentences.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-200"
              >
                <span>
                  {s.en}
                  {s.zh && <span className="ml-2 text-zinc-400">（{s.zh}）</span>}
                </span>
                <button
                  type="button"
                  onClick={() => removeCustomSentence(s.id)}
                  aria-label="刪除這句"
                  className="ml-2 rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-red-400"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--hero-gold)]">
            內建題庫（{enabledBuiltinCount} / {BUILTIN_SENTENCES.length} 已啟用）
          </h2>
          {disabledIds.length > 0 && (
            <button
              type="button"
              onClick={enableAllBuiltinSentences}
              className="text-xs font-medium text-zinc-300 hover:underline"
            >
              全部啟用
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">取消勾選的句子不會出現在遊戲中，隨時可以再勾回來。</p>
        <div className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg bg-white/5 p-2">
          {BUILTIN_SENTENCES.map((s) => {
            const isEnabled = !disabledIds.includes(s.id);
            return (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleBuiltinSentence(s.id)}
                  className="h-4 w-4 accent-[var(--hero-gold)]"
                />
                <span className={isEnabled ? '' : 'text-zinc-500 line-through'}>
                  {s.en}
                  <span className="ml-2 text-zinc-400">（{s.zh}）</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </main>
  );
}
