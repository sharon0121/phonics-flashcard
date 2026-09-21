'use client';

import { useState } from 'react';
import Link from 'next/link';
import { switchSyncCode, startFreshWithNewCode } from '@/lib/sync';
import { useSyncCode } from '@/lib/syncCode';

export default function SyncSettingsView() {
  const currentCode = useSyncCode();
  const [revealed, setRevealed] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleJoin() {
    const code = joinInput.trim();
    if (!code || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const normalized = await switchSyncCode(code);
      setJoinInput('');
      setRevealed(true);
      setMessage(`已切換到代碼「${normalized}」，這台裝置現在看到的是這組代碼的進度。`);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartFresh() {
    if (busy) return;
    const ok = window.confirm(
      '這會清空這台裝置目前看到的學習進度，並建立一組全新的代碼。\n\n如果這台裝置原本有進度資料，請先確認不需要它，或先記下目前的代碼再繼續。\n\n確定要建立全新代碼嗎？'
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const newCode = await startFreshWithNewCode();
      setRevealed(true);
      setMessage(`已建立全新代碼「${newCode}」，這台裝置現在是一份全新的空白進度。`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — ignore, the code is shown on screen already.
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
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
        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🔑 同步代碼設定</h1>
        <p className="mt-1 text-xs text-zinc-400">
          學習進度用「代碼」區分：同一組代碼在任何裝置輸入都會看到同一份進度，不同代碼彼此獨立、互不影響。分享這個平台給別人使用時，只要不給對方你的代碼，你的進度就不會被動到。
        </p>

        <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">目前這台裝置的代碼</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black/30 px-3 py-2 font-mono text-lg font-bold tracking-wide">
              {currentCode ? (revealed ? currentCode : '••••••') : '讀取中…'}
            </span>
            {currentCode && (
              <>
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
                >
                  {revealed ? '隱藏' : '顯示'}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
                >
                  {copied ? '已複製 ✓' : '複製'}
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            這組代碼只有輸入相同代碼的人看得到你的進度，請不要分享給不想共用進度的人。
          </p>
        </div>

        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">加入其他代碼</h2>
          <p className="mt-1 text-xs text-zinc-400">
            輸入一組代碼並套用，這台裝置就會切換去看那組代碼的進度（例如在新裝置上輸入你自己原本的代碼，把這台裝置接回你原本的進度）。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="輸入代碼"
              className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              disabled={!joinInput.trim() || busy}
              onClick={handleJoin}
              className="rounded-lg bg-[var(--hero-gold)] px-4 py-2 text-sm font-bold text-zinc-900 disabled:opacity-40"
            >
              套用
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-300">
            注意：套用後這台裝置畫面會變成該代碼的進度，原本代碼上的雲端資料不會被刪除，之後隨時可以再輸入原本的代碼切換回來。
          </p>
        </div>

        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">建立全新代碼</h2>
          <p className="mt-1 text-xs text-zinc-400">
            給同事／其他小朋友使用：清空這台裝置目前看到的進度，產生一組全新、只有這台裝置知道的代碼，開始一份完全獨立的進度。
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleStartFresh}
            className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-zinc-100 hover:bg-white/20 disabled:opacity-40"
          >
            建立全新代碼
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
