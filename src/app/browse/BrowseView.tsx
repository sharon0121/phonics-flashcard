'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { phases, getWordsByPhase, words as allPhonicsWords } from '@/data/words';
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

export default function BrowseView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phase = Number(searchParams.get('phase') ?? '1') || 1;
  const [subPhaseKey, setSubPhaseKey] = useState<string | null>(null);
  const [wordFilter, setWordFilter] = useState<WordFilter>('all');
  const progress = useProgress();
  const curriculum = useCurriculum();
  const thisWeekIds = useMemo(() => curriculum[getCurrentWeekKey()] ?? [], [curriculum]);

  const phaseInfo = phases.find((p) => p.phase === phase) ?? phases[0];
  const validSubPhaseKey =
    subPhaseKey && phaseInfo.subPhases.includes(subPhaseKey) ? subPhaseKey : null;
  const allWordsInPhase = useMemo(() => getWordsByPhase(phase), [phase]);
  const wordsInPhase = useMemo(
    () =>
      validSubPhaseKey
        ? allWordsInPhase.filter((w) => w.subPhaseKey === validSubPhaseKey)
        : allWordsInPhase,
    [allWordsInPhase, validSubPhaseKey]
  );

  // When a cross-group filter is active, ignore phase/sub-phase grouping
  // entirely and pull matching words from the full word bank instead.
  const words = useMemo(() => {
    if (wordFilter === 'learned') {
      return allPhonicsWords.filter((w) => progress[w.id]?.canUnderstand);
    }
    if (wordFilter === 'thisWeek') {
      return allPhonicsWords.filter((w) => thisWeekIds.includes(w.id));
    }
    return wordsInPhase;
  }, [wordFilter, progress, thisWeekIds, wordsInPhase]);

  function handleToggle(wordId: string, field: 'canPronounce' | 'canUnderstand') {
    const current = progress[wordId];
    const nextValue = !(field === 'canPronounce' ? current?.canPronounce : current?.canUnderstand);
    updateWordProgressFresh(wordId, field, nextValue);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <EnglishSubNav />
      <h1 className="text-2xl font-bold text-[var(--hero-gold)]">自然發音字卡</h1>

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
      )}

      {wordFilter === 'all' && allWordsInPhase.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-300">這個階段的字卡尚未建立，敬請期待。</p>
      ) : (
        <>
          {wordFilter === 'all' && (
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
          )}

          {wordFilter !== 'all' && (
            <p className="mt-3 text-xs text-zinc-400">符合條件的單字共 {words.length} 個（不分階段混合顯示）</p>
          )}

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
        </>
      )}
    </main>
  );
}
