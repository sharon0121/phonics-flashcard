'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Word } from '@/lib/types';
import PrintCard from './PrintCard';
import { useProgress, markWordsAsPrinted, clearWordsPrinted } from '@/lib/progress';

const PER_PAGE_OPTIONS = [2, 4, 6, 8, 10] as const;
type PerPage = (typeof PER_PAGE_OPTIONS)[number];
type PrintMode = 'single' | 'double' | 'study';

const COLS: Record<PerPage, number> = { 2: 1, 4: 2, 6: 2, 8: 2, 10: 2 };

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

function daysAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return `${diff} 天前`;
}

interface Props {
  words: Word[];
  title: string;
  onClose: () => void;
}

export default function PrintModal({ words: allWords, title, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const progress = useProgress();
  const [perPage, setPerPage] = useState<PerPage>(4);
  const [printMode, setPrintMode] = useState<PrintMode>('single');
  const [showOnlyUnprinted, setShowOnlyUnprinted] = useState(false);

  const printKey = printMode === 'single' ? 'lastPrintedSingle'
    : printMode === 'double' ? 'lastPrintedDouble'
    : 'lastPrintedStudy';

  const printedCount = useMemo(
    () => allWords.filter((w) => progress[w.id]?.[printKey]).length,
    [allWords, progress, printKey],
  );

  const words = useMemo(
    () => showOnlyUnprinted ? allWords.filter((w) => !progress[w.id]?.[printKey]) : allWords,
    [allWords, showOnlyUnprinted, progress, printKey],
  );

  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);
  const cols = COLS[perPage];
  const rows = perPage / cols;
  const cardHeightMm = (PAGE_HEIGHT_MM - SAFETY_MM) / rows;

  function handlePrint() {
    markWordsAsPrinted(words.map((w) => w.id), printMode);
    setTimeout(() => window.print(), 50);
  }

  function handleClearPrinted() {
    clearWordsPrinted(allWords.map((w) => w.id), printMode);
  }

  const pageCount = printMode === 'double' ? pages.length * 2 : pages.length;

  const printGrid = (
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
          <p className="mt-0.5 text-sm text-zinc-500">{title}・共 {allWords.length} 張</p>

          {allWords.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">目前沒有可列印的字卡。</p>
          ) : (
            <>
              {/* ── 已印 / 未印統計 ── */}
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-zinc-500">
                    已印過 <span className={`font-bold ${printedCount > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>{printedCount}</span> 張・
                    未印過 <span className="font-bold text-amber-600">{allWords.length - printedCount}</span> 張
                  </span>
                  {printedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearPrinted}
                      className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-300"
                    >
                      清除紀錄
                    </button>
                  )}
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showOnlyUnprinted}
                    onChange={(e) => setShowOnlyUnprinted(e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-500"
                  />
                  <span className="font-medium text-amber-700">只列印未印過的（{allWords.length - printedCount} 張）</span>
                </label>
              </div>

              {/* ── 已印過的單字（小標籤）── */}
              {!showOnlyUnprinted && printedCount > 0 && (
                <div className="mt-2 flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                  {allWords.filter((w) => progress[w.id]?.[printKey]).map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700"
                    >
                      ✓ {w.word}
                      <span className="text-emerald-500">{daysAgo(progress[w.id][printKey]!)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* ── 每頁張數 ── */}
              <div className="mt-4">
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

              {/* ── 卡片類型 ── */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-zinc-500">卡片類型</p>
                <div className="flex gap-2">
                  {([
                    { value: 'single', label: '純英文', desc: '考試用' },
                    { value: 'double', label: '雙面卡', desc: '英＋中' },
                    { value: 'study',  label: '學習卡', desc: '同一面' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrintMode(opt.value)}
                      className={`flex flex-1 flex-col items-center rounded-md py-2 text-xs font-medium transition-colors ${
                        printMode === opt.value
                          ? 'bg-[var(--hero-gold)] text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {opt.label}
                      <span className="text-[10px] font-normal opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {printMode === 'double' && (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    請開啟「雙面列印」並選「長邊翻頁」，正反面自動對齊。
                  </p>
                )}
              </div>

              <p className="mt-3 text-xs text-zinc-400">
                {words.length === 0
                  ? '篩選後沒有字卡，請取消篩選。'
                  : `列印 ${words.length} 張・共 ${pageCount} 頁`}
              </p>

              <button
                type="button"
                onClick={handlePrint}
                disabled={words.length === 0}
                className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                開始列印
              </button>
            </>
          )}
        </div>
      </div>

      {mounted && createPortal(printGrid, document.body)}
    </>
  );
}
