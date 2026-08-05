'use client';

import { useMemo, useState } from 'react';
import { phases, getWordsByPhase } from '@/data/words';
import type { Word } from '@/lib/types';
import PrintCard from '@/components/PrintCard';
import EnglishSubNav from '@/components/EnglishSubNav';
import { useProgress, markWordsAsPrinted, clearWordsPrinted } from '@/lib/progress';

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
const PAGE_HEIGHT_MM = 277;
const SAFETY_MARGIN_MM = 5;

type PrintMode = 'single' | 'double' | 'study';

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

function daysAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return `${diff} 天前`;
}

export default function PrintView() {
  const progress = useProgress();

  const [phase, setPhase] = useState(1);
  const [subPhaseKey, setSubPhaseKey] = useState<string | null>(null);
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(4);
  const [printMode, setPrintMode] = useState<PrintMode>('double');
  const [showOnlyUnprinted, setShowOnlyUnprinted] = useState(false);

  const phaseInfo = phases.find((p) => p.phase === phase) ?? phases[0];
  const allWordsInPhase = getWordsByPhase(phase);

  // Words matching phase + subphase, before print-filter
  const allFilteredWords = useMemo(
    () =>
      subPhaseKey
        ? allWordsInPhase.filter((w) => w.subPhaseKey === subPhaseKey)
        : allWordsInPhase,
    [allWordsInPhase, subPhaseKey],
  );

  // Words actually shown in print layout (may be further filtered by print status)
  const words = useMemo(
    () =>
      showOnlyUnprinted
        ? allFilteredWords.filter((w) => !progress[w.id]?.lastPrinted)
        : allFilteredWords,
    [allFilteredWords, showOnlyUnprinted, progress],
  );

  const printedCount = useMemo(
    () => allFilteredWords.filter((w) => progress[w.id]?.lastPrinted).length,
    [allFilteredWords, progress],
  );

  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);
  const cols = COLS_BY_PER_PAGE[perPage];
  const rows = perPage / cols;
  const cardHeightMm = (PAGE_HEIGHT_MM - SAFETY_MARGIN_MM) / rows;

  function handlePrint() {
    markWordsAsPrinted(words.map((w) => w.id));
    setTimeout(() => window.print(), 50);
  }

  function handleClearPrinted() {
    clearWordsPrinted(allFilteredWords.map((w) => w.id));
  }

  const pageCount = printMode === 'double' ? pages.length * 2 : pages.length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="no-print">
        <EnglishSubNav />
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">列印字卡</h1>

        {/* ── Phase tabs ─────────────────────────────────────── */}
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
            {/* ── SubPhase filter ────────────────────────────── */}
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

            {/* ── Print-status filter ────────────────────────── */}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-300">
                  共 <span className="font-bold text-white">{allFilteredWords.length}</span> 張・
                  已印過 <span className={`font-bold ${printedCount > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>{printedCount}</span> 張・
                  未印過 <span className="font-bold text-amber-400">{allFilteredWords.length - printedCount}</span> 張
                </span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOnlyUnprinted}
                  onChange={(e) => setShowOnlyUnprinted(e.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                <span className="font-medium text-amber-300">只顯示未印過</span>
              </label>
              {printedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearPrinted}
                  className="rounded-md bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-600"
                >
                  清除列印紀錄
                </button>
              )}
            </div>

            {/* ── Per-page selector ──────────────────────────── */}
            <div className="mt-4 flex items-center gap-3">
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

            {/* ── Print mode selector ────────────────────────── */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-300">卡片類型：</span>
              {(
                [
                  { value: 'double', label: '雙面卡', desc: '正面英文＋背面中文圖' },
                  { value: 'study', label: '學習卡', desc: '英文＋中文＋圖同一面' },
                  { value: 'single', label: '純英文', desc: '只印英文面（考試用）' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrintMode(opt.value)}
                  className={`flex flex-col items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    printMode === opt.value
                      ? 'bg-[var(--hero-gold)] text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {opt.label}
                  <span className="text-[10px] font-normal opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-zinc-400">
              {words.length === 0
                ? '目前篩選結果為 0 張，請調整篩選條件。'
                : `本次列印 ${words.length} 張字卡，共 ${pageCount} 頁。`}
              {printMode === 'double' &&
                ' 請在列印視窗開啟「雙面列印」並選擇「長邊翻頁」，正反面就會自動對齊。'}
              {printMode === 'study' && ' 單面列印，每張卡片英文中文圖片全包含，適合學習記憶。'}
              {printMode === 'single' && ' 只印英文面，適合考試時使用。'}
            </p>

            {/* ── Previously printed word chips ─────────────── */}
            {!showOnlyUnprinted && printedCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {allFilteredWords
                  .filter((w) => progress[w.id]?.lastPrinted)
                  .map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300"
                    >
                      ✓ {w.word}
                      <span className="text-emerald-500 text-[10px]">
                        {daysAgo(progress[w.id].lastPrinted!)}
                      </span>
                    </span>
                  ))}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={handlePrint}
                disabled={words.length === 0}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                開始列印
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Print-only output ──────────────────────────────────── */}
      <div className="print-only">
        {pages.map((pageWords, i) => (
          <div key={i}>
            <div className={`print-grid ${cols === 1 ? 'print-grid-cols-1' : ''}`}>
              {pageWords.map((w) => (
                <PrintCard
                  key={`${w.id}-front`}
                  word={w}
                  side={printMode === 'study' ? 'study' : 'front'}
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
