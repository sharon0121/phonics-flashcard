'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import WordHighlight from './WordHighlight';
import SpeakButton from './SpeakButton';
import ZhuyinText from './ZhuyinText';

interface FlashCardProps {
  word: Word;
  canUnderstand?: boolean;
  /** 'current'=本週(金) | 'previous'=前週(灰) | 'old'=舊單字(紅) */
  weekBadge?: 'current' | 'previous' | 'old';
  needsReinforcement?: boolean;
  showLearnedAsGray?: boolean;
  onToggleProgress?: () => void;
  onToggleReinforcement?: () => void;
}

export default function FlashCard({
  word,
  canUnderstand = false,
  weekBadge,
  needsReinforcement = false,
  showLearnedAsGray = false,
  onToggleProgress,
  onToggleReinforcement,
}: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isGray = showLearnedAsGray && canUnderstand;

  let borderClass = 'border-[3px] border-zinc-900';
  if (needsReinforcement)         borderClass = 'border-[4px] border-orange-400';
  else if (weekBadge === 'current')  borderClass = 'border-[4px] border-[var(--hero-gold)]';
  else if (weekBadge === 'previous') borderClass = 'border-[4px] border-zinc-400';
  else if (weekBadge === 'old')      borderClass = 'border-[4px] border-red-500';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className={`relative flex h-72 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-white p-4 text-center text-zinc-900 shadow-[4px_4px_0_var(--hero-blue)] transition-transform hover:-translate-y-0.5 hover:rotate-[0.5deg] hover:shadow-[6px_6px_0_var(--hero-red)] ${borderClass} ${isGray ? 'grayscale opacity-50' : ''}`}
      >
        {canUnderstand && (
          <span className="absolute top-2 left-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700 shadow">
            ✓
          </span>
        )}

        {/* Top-right badge — reinforcement takes priority over week badge */}
        {needsReinforcement ? (
          <span className="absolute top-2 right-2 rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            🔥 加強
          </span>
        ) : weekBadge === 'current' ? (
          <span className="absolute top-2 right-2 rounded-full bg-[var(--hero-gold)] px-2 py-0.5 text-[10px] font-bold text-zinc-900 shadow">
            本週
          </span>
        ) : weekBadge === 'previous' ? (
          <span className="absolute top-2 right-2 rounded-full bg-zinc-300 px-2 py-0.5 text-[10px] font-bold text-zinc-700 shadow">
            前週
          </span>
        ) : weekBadge === 'old' ? (
          <span className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            舊單字
          </span>
        ) : null}

        {!flipped ? (
          <>
            <div className="text-2xl font-bold">
              <WordHighlight word={word.word} highlight={word.highlight} />
            </div>
            <div className="text-sm text-zinc-500">{word.kk}</div>
            <div className="px-2 text-xs text-zinc-500">{word.en}</div>
            <div className="px-2 text-xs italic text-zinc-400">{word.sentence}</div>
            <SpeakButton text={word.word} className="mt-1" />
          </>
        ) : (
          <>
            <div className="text-6xl">{word.emoji}</div>
            <div className="text-2xl font-bold">
              <ZhuyinText zh={word.zh} zhuyin={word.zhuyin} />
            </div>
            <SpeakButton text={word.zh} lang="zh-TW" className="mt-1" />
          </>
        )}
        <span className="absolute bottom-2 right-3 text-xs text-zinc-300">點擊翻牌</span>
      </div>

      {(onToggleProgress || onToggleReinforcement) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onToggleProgress && (
            <button
              type="button"
              onClick={onToggleProgress}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                canUnderstand
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              ✓ 已學會
            </button>
          )}
          {onToggleReinforcement && (
            <button
              type="button"
              onClick={onToggleReinforcement}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                needsReinforcement
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              🔥 加強
            </button>
          )}
        </div>
      )}
    </div>
  );
}
