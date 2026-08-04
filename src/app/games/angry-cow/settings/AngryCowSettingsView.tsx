'use client';

import Link from 'next/link';
import {
  useAngryCowWordSources, setAngryCowWordSources,
  WORD_SOURCE_LABELS, WORD_SOURCE_DISPLAY_ORDER, ALL_WORD_SOURCES, type WordSourceKey,
  useAngryCowMathRanges, setAngryCowMathRanges, NUMBER_RANGE_OPTIONS,
  useAngryCowSpeechRate, setAngryCowSpeechRate, type SpeechRate,
  useAngryCowGameMode, setAngryCowGameMode, GAME_MODE_OPTIONS, type AngryCowGameMode,
  useAngryCowMathTerms, setAngryCowMathTerms, MATH_TERMS_OPTIONS,
} from '@/lib/angryCowSettings';

const SPEECH_RATE_OPTIONS: { value: SpeechRate; label: string; desc: string }[] = [
  { value: 'slow',   label: '慢速', desc: '×0.7' },
  { value: 'normal', label: '正常', desc: '×1.0' },
  { value: 'fast',   label: '快速', desc: '×1.3' },
];

export default function AngryCowSettingsView() {
  const gameMode   = useAngryCowGameMode();
  const wordSources = useAngryCowWordSources();
  const mathRanges = useAngryCowMathRanges();
  const mathTerms  = useAngryCowMathTerms();
  const speechRate = useAngryCowSpeechRate();

  const showEnglish = gameMode === 'english' || gameMode === 'mixed';
  const showMath    = gameMode === 'math'    || gameMode === 'mixed';

  function toggleSource(key: WordSourceKey) {
    const next = wordSources.includes(key) ? wordSources.filter((k) => k !== key) : [...wordSources, key];
    setAngryCowWordSources(next);
  }

  function toggleRange(value: number) {
    const next = mathRanges.includes(value) ? mathRanges.filter((v) => v !== value) : [...mathRanges, value];
    if (next.length === 0) return;
    setAngryCowMathRanges(next);
  }

  function toggleTerms(value: number) {
    const next = mathTerms.includes(value) ? mathTerms.filter((v) => v !== value) : [...mathTerms, value];
    if (next.length === 0) return;
    setAngryCowMathTerms(next);
  }

  const sortedRanges = [...mathRanges].sort((a, b) => a - b);
  const sortedTerms = [...mathTerms].sort((a, b) => a - b);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/angry-cow"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>

      {/* ── 遊戲模式 ───────────────────────────────────── */}
      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🎮 出題模式</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {GAME_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAngryCowGameMode(opt.value as AngryCowGameMode)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold ${
                gameMode === opt.value ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">選擇出題語言；「英文+數學」會隨機混合出題。</p>
      </div>

      {/* ── 英文版題目來源 ────────────────────────────── */}
      {showEnglish && (
        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">📚 英文版題庫範圍</h2>
            <button
              type="button"
              onClick={() => setAngryCowWordSources(ALL_WORD_SOURCES)}
              className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
            >
              全選
            </button>
          </div>
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
      )}

      {/* ── 數學版設定 ──────────────────────────────────── */}
      {showMath && (
        <>
          <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
            <h2 className="text-sm font-bold text-zinc-900">🔢 數學版數字範圍（可複選）</h2>
            <p className="mt-1 text-xs text-zinc-500">
              從最小開始，連續答對 10 題升一層 → 目前最高層：{sortedRanges[sortedRanges.length - 1]} 以內
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NUMBER_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleRange(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    mathRanges.includes(opt.value) ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sortedRanges.length > 1 && (
              <p className="mt-2 text-[10px] text-zinc-400">
                進度：{sortedRanges.map((r, i) => `第${i + 1}層：${r}以內`).join(' → ')}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
            <h2 className="text-sm font-bold text-zinc-900">➕ 幾個數字相加（可複選）</h2>
            <p className="mt-1 text-xs text-zinc-500">從最少開始，連續答對 10 題升一層；2 個含加減法，3 個以上為全加法。</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MATH_TERMS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleTerms(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    mathTerms.includes(opt.value) ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sortedTerms.length > 1 && (
              <p className="mt-2 text-[10px] text-zinc-400">
                進度：{sortedTerms.map((c, i) => `第${i + 1}層：${c}個數字`).join(' → ')}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── 語音速度 ──────────────────────────────────── */}
      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔊 語音速度</h2>
        <div className="mt-2 flex gap-2">
          {SPEECH_RATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAngryCowSpeechRate(opt.value)}
              className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm font-bold ${
                speechRate === opt.value ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
              <span className="text-xs font-normal">{opt.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">英文版牌子上喇叭按鈕的朗讀速度。</p>
      </div>
    </main>
  );
}
