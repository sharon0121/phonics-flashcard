'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resetKlotskiProgress } from '@/lib/klotskiProgress';

export default function KlotskiSettingsView() {
  const [justReset, setJustReset] = useState(false);

  function handleReset() {
    if (!window.confirm('確定要重置動物華容道的所有進度嗎？星星、每關最佳步數、看解答道具都會清空，此動作無法復原。')) return;
    resetKlotskiProgress();
    setJustReset(true);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/klotski"
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
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 動物華容道設定</h1>

      <div className="mt-6 rounded-xl border-2 border-rose-400 bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">🗑️ 重置進度</h2>
        <p className="mt-1 text-xs text-zinc-500">
          清除全部難度的過關紀錄、每關最佳步數，以及已累積的看解答道具，讓遊戲從頭開始。
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-3 rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
        >
          重置所有進度
        </button>
        {justReset && <p className="mt-2 text-xs font-bold text-emerald-600">已重置完成！</p>}
      </div>
    </main>
  );
}
