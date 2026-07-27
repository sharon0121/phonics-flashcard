'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sightWordStages, getSightWordsByStage } from '@/data/sightWords';
import { useProgress, updateWordProgressFresh } from '@/lib/progress';
import FlashCard from '@/components/FlashCard';

export default function SightWordsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = Number(searchParams.get('stage') ?? '1') || 1;
  const progress = useProgress();

  const words = useMemo(() => getSightWordsByStage(stage), [stage]);

  function handleToggle(wordId: string, field: 'canPronounce' | 'canUnderstand') {
    const current = progress[wordId];
    const nextValue = !(field === 'canPronounce' ? current?.canPronounce : current?.canUnderstand);
    updateWordProgressFresh(wordId, field, nextValue);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">重要單字卡</h1>
      <p className="mt-1 text-sm text-zinc-300">
        這些字要練習「秒讀」，看到就直接認出來，不用拼音。
      </p>

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

      <p className="mt-3 text-xs text-zinc-400">{words.length} 字</p>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {words.map((w) => (
          <FlashCard
            key={w.id}
            word={w}
            canPronounce={progress[w.id]?.canPronounce}
            canUnderstand={progress[w.id]?.canUnderstand}
            onToggleProgress={(field) => handleToggle(w.id, field)}
          />
        ))}
      </div>
    </main>
  );
}
