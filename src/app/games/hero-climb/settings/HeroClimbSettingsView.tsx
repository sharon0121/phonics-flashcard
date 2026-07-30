'use client';

import Link from 'next/link';
import {
  useSpeechRate, setSpeechRate, type SpeechRate,
  useStartDifficulty, setStartDifficulty, type StartDifficulty, START_DIFFICULTY_VALUES,
} from '@/lib/heroClimbSettings';
import { useUsedWordIds, removeUsedWordId, clearUsedWordIds } from '@/lib/heroClimbUsedWords';
import { useCustomWords } from '@/lib/customWords';
import { words as PHONICS_WORDS } from '@/data/words';
import type { Word } from '@/lib/types';

const SPEECH_RATE_OPTIONS: { value: SpeechRate; label: string; desc: string }[] = [
  { value: 'slow', label: '慢速', desc: '×0.7' },
  { value: 'normal', label: '正常', desc: '×1.0' },
  { value: 'fast', label: '快速', desc: '×1.3' },
];

const START_DIFFICULTY_OPTIONS: { value: StartDifficulty; label: string }[] = [
  { value: 'normal', label: `正常 ×${START_DIFFICULTY_VALUES.normal}` },
  { value: 'tier1',  label: `稍快 ×${START_DIFFICULTY_VALUES.tier1}` },
  { value: 'tier2',  label: `中等 ×${START_DIFFICULTY_VALUES.tier2}` },
  { value: 'tier3',  label: `快速 ×${START_DIFFICULTY_VALUES.tier3}` },
  { value: 'max',    label: `最快 ×${START_DIFFICULTY_VALUES.max}` },
];

export default function HeroClimbSettingsView() {
  const speechRate = useSpeechRate();
  const startDifficulty = useStartDifficulty();
  const usedIds = useUsedWordIds();
  const customWords = useCustomWords();

  const allWords: Word[] = [...(PHONICS_WORDS as Word[]), ...customWords];
  const usedWordsList = allWords.filter((w) => usedIds.has(w.id));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/hero-climb"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>
      <p className="mt-1 text-sm text-zinc-300">
        出題順序固定為「本週單字 → 加強單字 → 自訂單字 → 標準題庫」，拼完一個單字就換下一個，同一輪內盡量不重複。
      </p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🔊 語音速度</h2>
        <div className="mt-2 flex gap-2">
          {SPEECH_RATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSpeechRate(opt.value)}
              className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm font-bold ${
                speechRate === opt.value
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
              <span className="text-xs font-normal">{opt.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">拼出單字後播放英文→中文→例句的朗讀速度。</p>
      </div>

      <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🚀 起始速度</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {START_DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStartDifficulty(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                startDifficulty === opt.value
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">遊戲一開始的速度，之後每完成 5 個單字再加快一格。</p>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--hero-gold)]">
            📚 已出現的單字（{usedWordsList.length} 個）
          </h2>
          {usedWordsList.length > 0 && (
            <button
              type="button"
              onClick={clearUsedWordIds}
              className="rounded-lg bg-zinc-700 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-zinc-600"
            >
              清除全部
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          打勾的單字本輪不會重複出現。取消打勾讓單字可以再次出現。
        </p>
        {usedWordsList.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有單字出現過，快去玩玩看吧！</p>
        ) : (
          <div className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg bg-white/5 p-2">
            {usedWordsList.map((w) => (
              <label
                key={w.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => removeUsedWordId(w.id)}
                  className="h-4 w-4 cursor-pointer accent-[var(--hero-gold)]"
                />
                <span className="text-lg leading-none">{w.emoji}</span>
                <span className="flex-1 text-sm font-bold text-zinc-100 uppercase">{w.word}</span>
                <span className="text-sm text-zinc-400">{w.zh}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
