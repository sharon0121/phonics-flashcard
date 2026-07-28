'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sightWordStages, getSightWordsByStage, sightWords as allSightWords } from '@/data/sightWords';
import { useProgress, updateWordProgressFresh } from '@/lib/progress';
import { useCurriculum, getCurrentWeekKey } from '@/lib/curriculum';
import FlashCard from '@/components/FlashCard';
import EnglishSubNav from '@/components/EnglishSubNav';

type WordFilter = 'all' | 'learned' | 'thisWeek';

const WORD_FILTER_OPTIONS: { value: WordFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'learned', label: '懂意思（已學會）' },
  { value: 'thisWeek', label: '當週單字' },
];

export default function SightWordsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = Number(searchParams.get('stage') ?? '1') || 1;
  const [wordFilter, setWordFilter] = useState<WordFilter>('all');
  const progress = useProgress();
  const curriculum = useCurriculum();
  const thisWeekIds = useMemo(() => curriculum[getCurrentWeekKey()] ?? [], [curriculum]);

  const wordsInStage = useMemo(() => getSightWordsByStage(stage), [stage]);

  // When a cross-group filter is active, ignore the stage grouping entirely
  // and pull matching words from the full sight-word bank instead.
  const words = useMemo(() => {
    if (wordFilter === 'learned') {
      return allSightWords.filter((w) => progress[w.id]?.canUnderstand);
    }
    if (wordFilter === 'thisWeek') {
      return allSightWords.filter((w) => thisWeekIds.includes(w.id));
    }
    return wordsInStage;
  }, [wordFilter, progress, thisWeekIds, wordsInStage]);

  function handleToggle(wordId: string, field: 'canPronounce' | 'canUnderstand') {
    const current = progress[wordId];
    const nextValue = !(field === 'canPronounce' ? current?.canPronounce : current?.canUnderstand);
    updateWordProgressFresh(wordId, field, nextValue);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <EnglishSubNav />
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">重要單字卡</h1>
      <p className="mt-1 text-sm text-zinc-300">
        這些字要練習「秒讀」，看到就直接認出來，不用拼音。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {WORD_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setWordFilter(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              wordFilter === opt.value
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {wordFilter === 'all' && (
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

      <p className="mt-3 text-xs text-zinc-400">
        {wordFilter === 'all' ? `${words.length} 字` : `符合條件的單字共 ${words.length} 個（不分階段混合顯示）`}
      </p>

      {words.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-300">目前沒有符合條件的單字。</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {words.map((w) => (
            <FlashCard
              key={w.id}
              word={w}
              canPronounce={progress[w.id]?.canPronounce}
              canUnderstand={progress[w.id]?.canUnderstand}
              isThisWeek={thisWeekIds.includes(w.id)}
              onToggleProgress={(field) => handleToggle(w.id, field)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
