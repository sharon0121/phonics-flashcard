'use client';

import { useMemo, useState } from 'react';
import { phases, getWordsByPhase } from '@/data/words';
import type { Word } from '@/lib/types';
import PrintCard from '@/components/PrintCard';

const PER_PAGE_OPTIONS = [2, 4, 6, 8, 10, 12] as const;

const COLS_BY_PER_PAGE: Record<(typeof PER_PAGE_OPTIONS)[number], number> = {
  2: 1,
  4: 2,
  6: 2,
  8: 2,
  10: 2,
  12: 2,
};

// A4 printable area is 297mm minus the 10mm @page margin on each side.
// A few mm are shaved off as a safety margin so browser/printer rounding
// can't push the last row onto a second page.
const PAGE_HEIGHT_MM = 277;
const SAFETY_MARGIN_MM = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Reverses each row's left-right order so a duplex-printed back page lines
// up under its matching front card (assumes the printer flips on the long edge).
function mirrorForBack(pageWords: Word[], cols: number): Word[] {
  return chunk(pageWords, cols).flatMap((row) => [...row].reverse());
}

export default function PrintView() {
  const [phase, setPhase] = useState(1);
  const [subPhaseKey, setSubPhaseKey] = useState<string | null>(null);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(4);
  const [printMode, setPrintMode] = useState<'single' | 'double'>('single');

  const phaseInfo = phases.find((p) => p.phase === phase) ?? phases[0];
  const allWordsInPhase = getWordsByPhase(phase);
  const words = useMemo(
    () =>
      subPhaseKey
        ? allWordsInPhase.filter((w) => w.subPhaseKey === subPhaseKey)
        : allWordsInPhase,
    [allWordsInPhase, subPhaseKey]
  );

  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);
  const cols = COLS_BY_PER_PAGE[perPage];
  const rows = perPage / cols;
  const cardHeightMm = (PAGE_HEIGHT_MM - SAFETY_MARGIN_MM) / rows;

  function handlePrint() {
    setTimeout(() => window.print(), 50);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">列印字卡</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          {phases.map((p) => (
            <button
              key={p.phase}
              type="button"
              onClick={() => {
                setPhase(p.phase);
                setSubPhaseKey(null);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                phase === p.phase
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {p.phaseLabel}
            </button>
          ))}
        </div>

        {allWordsInPhase.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-300">這個階段的字卡尚未建立，敬請期待。</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubPhaseKey(null)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  subPhaseKey === null
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                全部（{allWordsInPhase.length} 字）
              </button>
              {phaseInfo.subPhases.map((key) => {
                const sample = allWordsInPhase.find((w) => w.subPhaseKey === key);
                if (!sample) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSubPhaseKey(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      subPhaseKey === key
                        ? 'bg-[var(--hero-gold)] text-zinc-900'
                        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400'
                    }`}
                  >
                    {sample.subPhase}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm text-zinc-300">每頁張數：</span>
              {PER_PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPerPage(n)}
                  className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
                    perPage === n
                      ? 'bg-[var(--hero-gold)] text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-zinc-300">列印方式：</span>
              <button
                type="button"
                onClick={() => setPrintMode('single')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  printMode === 'single'
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                單面（只印英文）
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('double')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  printMode === 'double'
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                雙面（正面英文＋背面中文）
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-400">
              共 {words.length} 張字卡，{printMode === 'single' ? pages.length : pages.length * 2} 頁。
              {printMode === 'double' &&
                '請在列印視窗開啟「雙面列印」並選擇「長邊翻頁」，正反面就會自動對齊，不需要手動放回紙張。'}
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                開始列印
              </button>
            </div>
          </>
        )}
      </div>

      <div className="print-only">
        {pages.map((pageWords, i) => (
          <div key={i}>
            <div className={`print-grid ${cols === 1 ? 'print-grid-cols-1' : ''}`}>
              {pageWords.map((w) => (
                <PrintCard
                  key={`${w.id}-front`}
                  word={w}
                  side="front"
                  perPage={perPage}
                  heightMm={cardHeightMm}
                />
              ))}
            </div>
            {printMode === 'double' && (
              <div className={`print-grid ${cols === 1 ? 'print-grid-cols-1' : ''}`}>
                {mirrorForBack(pageWords, cols).map((w) => (
                  <PrintCard
                    key={`${w.id}-back`}
                    word={w}
                    side="back"
                    perPage={perPage}
                    heightMm={cardHeightMm}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
