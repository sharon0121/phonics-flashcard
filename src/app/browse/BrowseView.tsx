'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { phases, getWordsByPhase, words as allPhonicsWords } from '@/data/words';
import { sightWords as allSightWords } from '@/data/sightWords';
import { useProgress, updateWordProgressFresh, toggleReinforcementFresh } from '@/lib/progress';
import { useCurriculum, getCurrentWeekKey, getWeekRangeLabel, shiftWeekKey } from '@/lib/curriculum';
import FlashCard from '@/components/FlashCard';
import PrintModal from '@/components/PrintModal';
import EnglishSubNav from '@/components/EnglishSubNav';
import BackButton from '@/components/BackButton';

type WordFilter = 'all' | 'thisWeek' | 'reinforce';

export default function BrowseView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phase = Number(searchParams.get('phase') ?? '1') || 1;
  const [subPhaseKey, setSubPhaseKey] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const wordFilter: WordFilter = (() => {
    const f = searchParams.get('filter');
    if (f === 'thisWeek' || f === 'reinforce') return f;
    return 'all';
  })();

  const progress = useProgress();
  const curriculum = useCurriculum();

  // Map every past/current-week curriculum word (both phonics + sight) → week status
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

  const phaseInfo = phases.find((p) => p.phase === phase) ?? phases[0];
  const validSubPhaseKey =
    subPhaseKey && phaseInfo.subPhases.includes(subPhaseKey) ? subPhaseKey : null;
  const allWordsInPhase = useMemo(() => getWordsByPhase(phase), [phase]);
  const wordsInPhase = useMemo(
    () =>
      validSubPhaseKey
        ? allWordsInPhase.filter((w) => w.subPhaseKey === validSubPhaseKey)
        : allWordsInPhase,
    [allWordsInPhase, validSubPhaseKey],
  );

  const searchTrimmed = searchQuery.trim().toLowerCase();

  const words = useMemo(() => {
    if (wordFilter === 'thisWeek') {
      // Combine phonics + sight words; exclude 懂意思 and 加強 (they go to their own views)
      const isActive = (id: string) =>
        weekWordStatus.has(id) &&
        !progress[id]?.canUnderstand &&
        !progress[id]?.needsReinforcement;
      const combined = [
        ...allPhonicsWords.filter((w) => isActive(w.id)),
        ...allSightWords.filter((w) => isActive(w.id)),
      ];
      return combined.sort((a, b) => {
        const order = { current: 0, previous: 1, old: 2 } as const;
        return order[weekWordStatus.get(a.id) ?? 'old'] - order[weekWordStatus.get(b.id) ?? 'old'];
      });
    }
    if (wordFilter === 'reinforce') {
      // Combined phonics + sight; 懂意思 overrides 加強 → graduated out
      const isReinforce = (id: string) =>
        progress[id]?.needsReinforcement && !progress[id]?.canUnderstand;
      return [
        ...allPhonicsWords.filter((w) => isReinforce(w.id)),
        ...allSightWords.filter((w) => isReinforce(w.id)),
      ];
    }
    return wordsInPhase;
  }, [wordFilter, progress, wordsInPhase, weekWordStatus]);

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
  const filterTitle =
    wordFilter === 'thisWeek'
      ? `當週字卡（${getWeekRangeLabel(getCurrentWeekKey())}）`
      : '🔥 加強單字';

  return (
    <main className={`mx-auto w-full max-w-5xl flex-1 px-4 py-8${showPrint ? ' no-print' : ''}`}>
      <EnglishSubNav />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          {isFiltered ? (
            <h1 className="text-2xl font-bold text-[var(--hero-gold)]">{filterTitle}</h1>
          ) : (
            <h1 className="text-2xl font-bold text-[var(--hero-gold)]">自然發音字卡</h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Link href="/browse" className="text-xs text-zinc-400 hover:text-zinc-200">
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

      {showPrint && (
        <PrintModal
          words={words}
          title={isFiltered ? filterTitle : `自然發音字卡 Phase ${phase}`}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Phase tabs — only in all view */}
      {!isFiltered && (
        <div className="mt-4 flex flex-wrap gap-2">
          {phases.map((p) => (
            <button
              key={p.phase}
              type="button"
              onClick={() => { setSubPhaseKey(null); router.push(`/browse?phase=${p.phase}`); }}
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

      {!isFiltered && allWordsInPhase.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-300">這個階段的字卡尚未建立，敬請期待。</p>
      ) : (
        <>
          {/* Sub-phase tabs */}
          {!isFiltered && (
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

          {isFiltered && (
            <p className="mt-3 text-xs text-zinc-400">共 {displayedWords.length} 個單字（自然發音 + 重要單字）</p>
          )}
          {!isFiltered && searchTrimmed && (
            <p className="mt-2 text-xs text-zinc-400">搜尋結果：{displayedWords.length} 個單字</p>
          )}

          {displayedWords.length === 0 && searchTrimmed ? (
            <p className="mt-8 text-sm text-zinc-300">找不到符合「{searchQuery.trim()}」的單字。</p>
          ) : words.length === 0 ? (
            wordFilter === 'thisWeek' ? (
              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-sm text-zinc-300">當週字卡都已完成或移入加強清單！</p>
                <p className="mt-1 text-xs text-zinc-500">尚未設定本週單字？可前往進度頁面設定。</p>
                <a href="/progress" className="mt-3 inline-block rounded-full bg-[var(--hero-gold)] px-4 py-1.5 text-sm font-bold text-zinc-900 hover:opacity-90">
                  前往進度頁面設定 →
                </a>
              </div>
            ) : wordFilter === 'reinforce' ? (
              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-sm text-zinc-300">目前沒有標記為加強的單字。</p>
                <p className="mt-1 text-xs text-zinc-500">在字卡下方點選「🔥 加強」可將單字加入加強清單。</p>
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
                    wordFilter === 'thisWeek'
                      ? weekWordStatus.get(w.id)
                      : wordFilter === 'all' && weekWordStatus.get(w.id) === 'current'
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
        </>
      )}
    </main>
  );
}
