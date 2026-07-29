'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { sightWordStages, getSightWordsByStage, sightWords as allSightWords } from '@/data/sightWords';
import { useProgress, updateWordProgressFresh, toggleReinforcementFresh } from '@/lib/progress';
import { useCurriculum, getCurrentWeekKey, shiftWeekKey } from '@/lib/curriculum';
import FlashCard from '@/components/FlashCard';
import PrintModal from '@/components/PrintModal';
import EnglishSubNav from '@/components/EnglishSubNav';
import BackButton from '@/components/BackButton';

type WordFilter = 'all' | 'reinforce';

export default function SightWordsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = Number(searchParams.get('stage') ?? '1') || 1;
  const wordFilter: WordFilter = (() => {
    const f = searchParams.get('filter');
    if (f === 'reinforce') return f;
    return 'all';
  })();

  const progress = useProgress();
  const curriculum = useCurriculum();

  // Map every past/current-week curriculum sight word → week status
  const weekWordStatus = useMemo(() => {
    const currentKey = getCurrentWeekKey();
    const prevKey = shiftWeekKey(currentKey, -1);
    const result = new Map<string, 'current' | 'previous' | 'old'>();
    const sorted = Object.entries(curriculum).sort(([a], [b]) => a.localeCompare(b));
    for (const [weekKey, wordIds] of sorted) {
      if (weekKey > currentKey) continue;
      const status: 'current' | 'previous' | 'old' =
        weekKey === currentKey ? 'current' : weekKey === prevKey ? 'previous' : 'old';
      for (const id of wordIds) result.set(id, status);
    }
    return result;
  }, [curriculum]);

  const [showPrint, setShowPrint] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wordsInStage = useMemo(() => getSightWordsByStage(stage), [stage]);

  const words = useMemo(() => {
    if (wordFilter === 'reinforce') {
      return allSightWords.filter((w) => progress[w.id]?.needsReinforcement && !progress[w.id]?.canUnderstand);
    }
    return wordsInStage;
  }, [wordFilter, progress, wordsInStage]);

  const searchTrimmed = searchQuery.trim().toLowerCase();

  const displayedWords = useMemo(() => {
    if (!searchTrimmed) return words;
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(searchTrimmed) ||
        w.zh.includes(searchQuery.trim()) ||
        w.en.toLowerCase().includes(searchTrimmed),
    );
  }, [words, searchTrimmed, searchQuery]);

  function handleToggle(wordId: string) {
    const current = progress[wordId];
    updateWordProgressFresh(wordId, 'canUnderstand', !current?.canUnderstand);
  }

  const isFiltered = wordFilter !== 'all';

  return (
    <main className={`mx-auto w-full max-w-5xl flex-1 px-4 py-8${showPrint ? ' no-print' : ''}`}>
      <EnglishSubNav />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          {isFiltered ? (
            <h1 className="text-2xl font-bold text-[var(--hero-gold)]">🔥 加強單字 — 重要單字卡</h1>
          ) : (
            <h1 className="text-2xl font-bold text-[var(--hero-gold)]">重要單字卡</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Link href="/sight-words" className="text-xs text-zinc-400 hover:text-zinc-200">
              全部字卡
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/20"
          >
            🖨️ 列印
          </button>
        </div>
      </div>
      {!isFiltered && (
        <p className="mt-1 text-sm text-zinc-300">
          這些字要練習「秒讀」，看到就直接認出來，不用拼音。
        </p>
      )}

      {showPrint && (
        <PrintModal
          words={words}
          title={isFiltered ? '加強單字 — 重要單字卡' : `重要單字卡 Stage ${stage}`}
          onClose={() => setShowPrint(false)}
        />
      )}

      {!isFiltered && (
        <div className="mt-4 flex flex-wrap gap-2">
          {sightWordStages.map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => router.push(`/sight-words?stage=${s.stage}`)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                stage === s.stage
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {s.stageLabel.replace('Sight Words：', '')}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="mt-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋單字（英文 / 中文 / 解釋）"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--hero-gold)] focus:outline-none"
        />
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        {searchTrimmed
          ? `搜尋結果：${displayedWords.length} 個單字`
          : isFiltered
            ? `共 ${words.length} 個單字`
            : `${words.length} 字`}
      </p>

      {displayedWords.length === 0 && searchTrimmed ? (
        <p className="mt-8 text-sm text-zinc-300">找不到符合「{searchQuery.trim()}」的單字。</p>
      ) : words.length === 0 ? (
        wordFilter === 'reinforce' ? (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-sm text-zinc-300">目前沒有標記為加強的重要單字卡。</p>
            <p className="mt-1 text-xs text-zinc-500">
              在字卡下方點選「🔥 加強」可將單字加入加強清單。
            </p>
          </div>
        ) : (
          <p className="mt-8 text-sm text-zinc-300">目前沒有符合條件的單字。</p>
        )
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {displayedWords.map((w) => (
            <FlashCard
              key={w.id}
              word={w}
              canUnderstand={progress[w.id]?.canUnderstand}
              weekBadge={
                wordFilter === 'all' && weekWordStatus.get(w.id) === 'current'
                  ? 'current'
                  : undefined
              }
              needsReinforcement={progress[w.id]?.needsReinforcement}
              showLearnedAsGray={wordFilter === 'all'}
              onToggleProgress={() => handleToggle(w.id)}
              onToggleReinforcement={() => toggleReinforcementFresh(w.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
