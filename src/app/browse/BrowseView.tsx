'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { phases, getWordsByPhase } from '@/data/words';
import { useProgress, updateWordProgressFresh } from '@/lib/progress';
import FlashCard from '@/components/FlashCard';

export default function BrowseView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phase = Number(searchParams.get('phase') ?? '1') || 1;
  const [subPhaseKey, setSubPhaseKey] = useState<string | null>(null);
  const progress = useProgress();

  const phaseInfo = phases.find((p) => p.phase === phase) ?? phases[0];
  const validSubPhaseKey =
    subPhaseKey && phaseInfo.subPhases.includes(subPhaseKey) ? subPhaseKey : null;
  const allWordsInPhase = useMemo(() => getWordsByPhase(phase), [phase]);
  const words = useMemo(
    () =>
      validSubPhaseKey
        ? allWordsInPhase.filter((w) => w.subPhaseKey === validSubPhaseKey)
        : allWordsInPhase,
    [allWordsInPhase, validSubPhaseKey]
  );

  function handleToggle(wordId: string, field: 'canPronounce' | 'canUnderstand') {
    const current = progress[wordId];
    const nextValue = !(field === 'canPronounce' ? current?.canPronounce : current?.canUnderstand);
    updateWordProgressFresh(wordId, field, nextValue);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">自然發音字卡</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {phases.map((p) => (
          <button
            key={p.phase}
            type="button"
            onClick={() => {
              setSubPhaseKey(null);
              router.push(`/browse?phase=${p.phase}`);
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
                validSubPhaseKey === null
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400'
              }`}
            >
              全部
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
                    validSubPhaseKey === key
                      ? 'bg-[var(--hero-gold)] text-zinc-900'
                      : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  {sample.subPhase}
                </button>
              );
            })}
          </div>

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
        </>
      )}
    </main>
  );
}
