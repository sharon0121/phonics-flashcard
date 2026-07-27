'use client';

import { useState } from 'react';
import type { Word } from '@/lib/types';
import WordHighlight from './WordHighlight';
import SpeakButton from './SpeakButton';
import ZhuyinText from './ZhuyinText';

interface FlashCardProps {
  word: Word;
  canPronounce?: boolean;
  canUnderstand?: boolean;
  onToggleProgress?: (field: 'canPronounce' | 'canUnderstand') => void;
}

export default function FlashCard({
  word,
  canPronounce = false,
  canUnderstand = false,
  onToggleProgress,
}: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

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
        className="relative flex h-72 w-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-[3px] border-zinc-900 bg-white p-4 text-center text-zinc-900 shadow-[4px_4px_0_var(--hero-blue)] transition-transform hover:-translate-y-0.5 hover:rotate-[0.5deg] hover:shadow-[6px_6px_0_var(--hero-red)]"
      >
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
          </>
        )}
        <span className="absolute bottom-2 right-3 text-xs text-zinc-300">點擊翻牌</span>
      </div>

      {onToggleProgress && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggleProgress('canPronounce')}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              canPronounce
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
            }`}
          >
            ⭐ 會念
          </button>
          <button
            type="button"
            onClick={() => onToggleProgress('canUnderstand')}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              canUnderstand
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
            }`}
          >
            🌟 懂意思
          </button>
        </div>
      )}
    </div>
  );
}
