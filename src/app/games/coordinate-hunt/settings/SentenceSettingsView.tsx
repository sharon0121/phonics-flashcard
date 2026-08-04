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
import {
  useCoordTermCounts,
  useCoordMaxValues,
  useCoordTimeLimit,
  setCoordTermCounts,
  setCoordMaxValues,
  setCoordTimeLimit,
  TERM_COUNT_OPTIONS,
  COORD_NUMBER_RANGE_OPTIONS,
  TIME_LIMIT_OPTIONS,
} from '@/lib/coordinateHuntSettings';

export default function SentenceSettingsView() {
  const termCounts = useCoordTermCounts();
  const maxValues = useCoordMaxValues();
  const timeLimit = useCoordTimeLimit();
  const sortedTerms = [...termCounts].sort((a, b) => a - b);
  const sortedMax = [...maxValues].sort((a, b) => a - b);

  function toggleTermCount(n: number) {
    const next = termCounts.includes(n) ? termCounts.filter((v) => v !== n) : [...termCounts, n];
    if (next.length === 0) return;
    setCoordTermCounts(next);
  }

  function toggleMaxValue(v: number) {
    const next = maxValues.includes(v) ? maxValues.filter((x) => x !== v) : [...maxValues, v];
    if (next.length === 0) return;
    setCoordMaxValues(next);
  }

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
      <Link href="/games/coordinate-hunt" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      {/* ── Math difficulty ── */}
      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔢 行數（題目有幾個數字，可複選）</h2>
        <p className="mt-1 text-xs text-zinc-500">從最少開始，連續答對 10 題升一層。</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TERM_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => toggleTermCount(n)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                termCounts.includes(n)
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {n} 個數字
            </button>
          ))}
        </div>
        {sortedTerms.length > 1 && (
          <p className="mt-2 text-[10px] text-zinc-400">
            進度：{sortedTerms.map((n, i) => `第${i + 1}層：${n}個數字`).join(' → ')}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          例：2 個數字 → 3 + 5 = ?；3 個數字 → 3 + 5 − 2 = ?
        </p>

        <h2 className="mt-4 text-sm font-bold text-zinc-900">📏 數字大小（題目中每個數字的範圍，可複選）</h2>
        <p className="mt-1 text-xs text-zinc-500">從最小開始，連續答對 10 題升一層。</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COORD_NUMBER_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleMaxValue(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                maxValues.includes(opt.value)
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {sortedMax.length > 1 && (
          <p className="mt-2 text-[10px] text-zinc-400">
            進度：{sortedMax.map((v, i) => `第${i + 1}層：${v}以內`).join(' → ')}
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">控制題目中每個數字的大小（不是答案的大小）。</p>

        <h2 className="mt-4 text-sm font-bold text-zinc-900">⏱️ 時間限制</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIME_LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCoordTimeLimit(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                timeLimit === opt.value
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          計時從按下「開始遊戲」開始，時間到自動結束並顯示得分。
        </p>
      </div>

      {/* ── Sentence management ── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">📝 句子管理</h2>
        <p className="mt-1 text-sm text-zinc-300">
          目前題庫共 {totalActiveCount} 句（內建 {enabledBuiltinCount} / {BUILTIN_SENTENCES.length} 句啟用，自訂{' '}
          {customSentences.length} 句）。
        </p>
      </div>

      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
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

      <div className="mt-6">
        <h3 className="text-base font-bold text-[var(--hero-gold)]">已新增的句子</h3>
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

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--hero-gold)]">
            內建題庫（{enabledBuiltinCount} / {BUILTIN_SENTENCES.length} 已啟用）
          </h3>
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
