'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Word } from '@/lib/types';
import PrintCard from './PrintCard';

const PER_PAGE_OPTIONS = [2, 4, 6, 8, 10] as const;
type PerPage = (typeof PER_PAGE_OPTIONS)[number];

const COLS: Record<PerPage, number> = { 2: 1, 4: 2, 6: 2, 8: 2, 10: 2 };

// 257mm → 252mm usable (5mm safety), comfortably within A4 277mm printable area.
// All per-page options share this budget: every option gets exactly one A4 page.
const PAGE_HEIGHT_MM = 257;
const SAFETY_MM = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function mirrorForBack(pageWords: Word[], cols: number): Word[] {
  return chunk(pageWords, cols).flatMap((row) => [...row].reverse());
}

interface Props {
  words: Word[];
  title: string;
  onClose: () => void;
}

export default function PrintModal({ words, title, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [perPage, setPerPage] = useState<PerPage>(4);
  const [printMode, setPrintMode] = useState<'single' | 'double'>('single');

  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);
  const cols = COLS[perPage];
  const rows = perPage / cols;
  const cardHeightMm = (PAGE_HEIGHT_MM - SAFETY_MM) / rows;

  function handlePrint() {
    setTimeout(() => window.print(), 50);
  }

  // Rendered via portal at <body> level so it's outside any no-print container
  const printGrid = (
    <div className="print-only">
      {pages.map((pageWords, i) => (
        <div key={i}>
          <div className={`print-grid ${cols === 1 ? 'print-grid-cols-1' : ''}`}>
            {pageWords.map((w) => (
              <PrintCard key={`${w.id}-front`} word={w} side="front" perPage={perPage} heightMm={cardHeightMm} />
            ))}
          </div>
          {printMode === 'double' && (
            <div className={`print-grid ${cols === 1 ? 'print-grid-cols-1' : ''}`}>
              {mirrorForBack(pageWords, cols).map((w) => (
                <PrintCard key={`${w.id}-back`} word={w} side="back" perPage={perPage} heightMm={cardHeightMm} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Modal UI — hidden when printing */}
      <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-4 text-xl text-zinc-400 hover:text-zinc-600"
            aria-label="關閉"
          >
            ✕
          </button>

          <h2 className="text-lg font-bold text-zinc-900">🖨️ 列印字卡</h2>
          <p className="mt-0.5 text-sm text-zinc-500">{title}・共 {words.length} 張</p>

          {words.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">目前沒有可列印的字卡。</p>
          ) : (
            <>
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold text-zinc-500">每頁張數（A4 單面）</p>
                <div className="flex gap-2">
                  {PER_PAGE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPerPage(n)}
                      className={`h-9 w-9 rounded-md text-sm font-medium transition-colors ${
                        perPage === n
                          ? 'bg-[var(--hero-gold)] text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-zinc-500">列印方式</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintMode('single')}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                      printMode === 'single'
                        ? 'bg-[var(--hero-gold)] text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    單面（英文）
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('double')}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                      printMode === 'double'
                        ? 'bg-[var(--hero-gold)] text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    雙面（英＋中）
                  </button>
                </div>
                {printMode === 'double' && (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    列印時請開啟「雙面列印」並選「長邊翻頁」，正反面就會自動對齊。
                  </p>
                )}
              </div>

              <p className="mt-3 text-xs text-zinc-400">
                共 {printMode === 'single' ? pages.length : pages.length * 2} 頁
              </p>

              <button
                type="button"
                onClick={handlePrint}
                className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white hover:bg-zinc-700"
              >
                開始列印
              </button>
            </>
          )}
        </div>
      </div>

      {/* Print grid — portaled to <body> to escape any no-print ancestor */}
      {mounted && createPortal(printGrid, document.body)}
    </>
  );
}
