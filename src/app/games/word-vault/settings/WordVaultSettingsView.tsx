'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MAZE_WORDS } from '@/data/wordMazeWords';
import {
  useCustomMazeWords,
  useDisabledMazeWordIds,
  useGhostCount,
  useGhostSpeed,
  useWordSource,
  useThisWeekMazeWords,
  useLearnedMazeWords,
  useTunnelMode,
  addCustomMazeWord,
  removeCustomMazeWord,
  toggleBuiltinMazeWord,
  enableAllBuiltinMazeWords,
  setGhostCount,
  setGhostSpeed,
  setWordSource,
  setTunnelMode,
  MIN_GHOST_COUNT,
  MAX_GHOST_COUNT,
  type GhostSpeed,
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
  const customWords = useCustomMazeWords();
  const disabledIds = useDisabledMazeWordIds();
  const ghostCount = useGhostCount();
  const ghostSpeed = useGhostSpeed();
  const wordSource = useWordSource();
  const weekWords = useThisWeekMazeWords();
  const learnedWords = useLearnedMazeWords();
  const tunnelMode = useTunnelMode();
  const bestCompletions = useBestCompletions();

  const [word, setWord] = useState('');
  const [zh, setZh] = useState('');
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState<string | null>(null);

  const enabledBuiltinCount = MAZE_WORDS.length - disabledIds.length;
  const totalActiveCount = enabledBuiltinCount + customWords.length;

  function handleAdd() {
    const result = addCustomMazeWord(word, zh, emoji);
    if (!result.ok) {
      setError(result.error ?? '新增失敗');
      return;
    }
    setWord('');
    setZh('');
    setEmoji('');
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/games/word-vault" className="text-sm font-medium text-[var(--hero-gold)] hover:underline">
        ← 回小精靈大探險
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 遊戲設定</h1>
      <p className="mt-1 text-sm text-zinc-300">
        目前題庫共 {totalActiveCount} 個單字（內建 {enabledBuiltinCount} / {MAZE_WORDS.length} 個啟用，自訂{' '}
        {customWords.length} 個）。
      </p>

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
        <h2 className="text-sm font-bold text-zinc-900">📚 單字來源</h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setWordSource('builtin')}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              wordSource === 'builtin' ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            標準題庫
          </button>
          <button
            type="button"
            onClick={() => weekWords.length > 0 && setWordSource('week')}
            disabled={weekWords.length === 0}
            className={`rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
              wordSource === 'week' && weekWords.length > 0
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            本週學習單字（{weekWords.length} 個）
          </button>
          <button
            type="button"
            onClick={() => learnedWords.length > 0 && setWordSource('learned')}
            disabled={learnedWords.length === 0}
            className={`rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
              wordSource === 'learned' && learnedWords.length > 0
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            已學會單字（{learnedWords.length} 個）
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {wordSource === 'learned'
            ? learnedWords.length === 0
              ? '還沒有標記為「知道意思 🌟」的單字，請先在字卡區練習。'
              : '使用字卡區已標記「知道意思 🌟」的單字，複習已掌握的詞彙。'
            : wordSource === 'week'
              ? weekWords.length === 0
                ? '本週還沒有指定學習單字。'
                : '只出本週正在學習的單字，幫助複習。'
              : '使用標準題庫，由設定控制哪些單字啟用。'}
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

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">新增單字（3～8 個英文字母）</h2>
        <label className="mt-3 block text-sm font-medium text-zinc-700">
          英文單字
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="例如：BREAD"
            maxLength={8}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 uppercase"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-zinc-700">
          中文意思
          <input
            type="text"
            value={zh}
            onChange={(e) => setZh(e.target.value)}
            placeholder="例如：麵包"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-zinc-700">
          Emoji 圖示
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="例如：🍞"
            maxLength={4}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 rounded-lg bg-[var(--hero-red)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
        >
          新增單字
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[var(--hero-gold)]">已新增的單字</h2>
        {customWords.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">還沒有新增任何單字。</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {customWords.map((w) => (
              <div
                key={w.word}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-200"
              >
                <span>
                  {w.emoji} {w.word}
                  <span className="ml-2 text-zinc-400">（{w.zh}）</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeCustomMazeWord(w.word)}
                  aria-label="刪除這個單字"
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
            內建題庫（{enabledBuiltinCount} / {MAZE_WORDS.length} 已啟用）
          </h2>
          {disabledIds.length > 0 && (
            <button
              type="button"
              onClick={enableAllBuiltinMazeWords}
              className="text-xs font-medium text-zinc-300 hover:underline"
            >
              全部啟用
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">取消勾選的單字不會出現在迷宮中，隨時可以再勾回來。</p>
        <div className="mt-2 flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg bg-white/5 p-2">
          {MAZE_WORDS.map((w) => {
            const isEnabled = !disabledIds.includes(w.word);
            return (
              <label
                key={w.word}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleBuiltinMazeWord(w.word)}
                  className="h-4 w-4 accent-[var(--hero-gold)]"
                />
                <span className={isEnabled ? '' : 'text-zinc-500 line-through'}>
                  {w.emoji} {w.word}
                  <span className="ml-2 text-zinc-400">（{w.zh}）</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </main>
  );
}
