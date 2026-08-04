'use client';

import Link from 'next/link';
import {
  useWordGridSources,
  setWordGridSources,
  useWordGridSpeechRate,
  setWordGridSpeechRate,
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type WordSourceKey,
  type SpeechRate,
} from '@/lib/wordGridSettings';

const SPEECH_RATE_OPTIONS: { value: SpeechRate; label: string; desc: string }[] = [
  { value: 'slow', label: '慢速', desc: '×0.7' },
  { value: 'normal', label: '正常', desc: '×1.0' },
  { value: 'fast', label: '快速', desc: '×1.3' },
];

export default function WordGridSettingsView() {
  const wordSources = useWordGridSources();
  const speechRate = useWordGridSpeechRate();

  function toggleSource(key: WordSourceKey) {
    const next = wordSources.includes(key) ? wordSources.filter((k) => k !== key) : [...wordSources, key];
    setWordGridSources(next);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/word-grid"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">📚 題目來源</h2>
          <button
            type="button"
            onClick={() => setWordGridSources(ALL_WORD_SOURCES)}
            className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
          >
            全選
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          出題只會從下方勾選的來源抽字，有勾選多個來源時，抽題順序固定為「本週單字 → 加強單字 → 自訂單字 → 自然發音卡 →
          重要單字卡」。
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
        <p className="mt-2 text-xs text-zinc-500">可複選，取消到剩 0 個時會自動恢復全選。</p>
      </div>

      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔊 語音速度</h2>
        <div className="mt-2 flex gap-2">
          {SPEECH_RATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWordGridSpeechRate(opt.value)}
              className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm font-bold ${
                speechRate === opt.value ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
              <span className="text-xs font-normal">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
