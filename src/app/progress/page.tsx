'use client';

import { useState } from 'react';
import { phases, getWordsByPhase, words as allWords, getWordById } from '@/data/words';
import {
  sightWordStages,
  getSightWordsByStage,
  sightWords,
  getSightWordById,
} from '@/data/sightWords';
import { useProgress, clearProgress } from '@/lib/progress';
import {
  useCurriculum,
  toggleWordInWeekFresh,
  clearWeek,
  getCurrentWeekKey,
  shiftWeekKey,
  getWeekRangeLabel,
  getTaughtWordIds,
} from '@/lib/curriculum';
import type { ProgressMap, Word } from '@/lib/types';

const WEEKLY_TARGET = 10;

function resolveWord(id: string): Word | undefined {
  return getWordById(id) ?? getSightWordById(id);
}

function learnedStats(wordIds: string[], progress: ProgressMap) {
  const resolved = wordIds.map(resolveWord).filter((w): w is Word => !!w);
  const total = resolved.length;
  const learnedWords = resolved.filter(
    (w) => progress[w.id]?.canPronounce && progress[w.id]?.canUnderstand
  );
  const percent = total === 0 ? 0 : Math.round((learnedWords.length / total) * 100);
  return { total, learned: learnedWords.length, percent, learnedWords };
}

function phaseCompletion(phase: number, progress: ProgressMap) {
  const wordsInPhase = getWordsByPhase(phase);
  if (wordsInPhase.length === 0) return { percent: 0, total: 0, learned: 0 };
  let points = 0;
  let learned = 0;
  for (const w of wordsInPhase) {
    const entry = progress[w.id];
    if (entry?.canPronounce) points += 1;
    if (entry?.canUnderstand) points += 1;
    if (entry?.canPronounce && entry?.canUnderstand) learned += 1;
  }
  const percent = Math.round((points / (wordsInPhase.length * 2)) * 100);
  return { percent, total: wordsInPhase.length, learned };
}

function ProgressBar({ percent, color = 'var(--hero-blue)' }: { percent: number; color?: string }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
    </div>
  );
}

export default function ProgressPage() {
  const progress = useProgress();
  const curriculum = useCurriculum();
  const [planWeekKey, setPlanWeekKey] = useState(() => getCurrentWeekKey());
  const [source, setSource] = useState<'phonics' | 'sight'>('phonics');
  const [phonicsPhase, setPhonicsPhase] = useState(1);
  const [phonicsSubPhase, setPhonicsSubPhase] = useState<string | null>(null);
  const [sightStage, setSightStage] = useState(1);
  const [showLearnedList, setShowLearnedList] = useState(false);

  function handleClearProgress() {
    if (!window.confirm('確定要清除所有學習進度嗎？此動作無法復原。')) return;
    clearProgress();
  }

  function handleClearWeek() {
    if (!window.confirm(`確定要清除 ${getWeekRangeLabel(planWeekKey)} 這週的規劃嗎？其他週的規劃不會受影響。`)) return;
    clearWeek(planWeekKey);
  }

  function handleToggleWord(wordId: string) {
    toggleWordInWeekFresh(planWeekKey, wordId);
  }

  const currentWeekKey = getCurrentWeekKey();
  const taughtIds = Array.from(getTaughtWordIds(curriculum, currentWeekKey));
  const taughtStats = learnedStats(taughtIds, progress);

  const totalStats = learnedStats(
    [...allWords, ...sightWords].map((w) => w.id),
    progress
  );

  const planWeekIds = curriculum[planWeekKey] ?? [];
  const planWeekStats = learnedStats(planWeekIds, progress);
  const isCurrentWeek = planWeekKey === currentWeekKey;

  const phonicsPhaseInfo = phases.find((p) => p.phase === phonicsPhase) ?? phases[0];
  const phonicsWordsInPhase = getWordsByPhase(phonicsPhase);
  const pickerWords: Word[] =
    source === 'phonics'
      ? phonicsSubPhase
        ? phonicsWordsInPhase.filter((w) => w.subPhaseKey === phonicsSubPhase)
        : phonicsWordsInPhase
      : getSightWordsByStage(sightStage);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">學習進度</h1>
        <button
          type="button"
          onClick={handleClearProgress}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
        >
          清除進度
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* 學習總進度 */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900">
        <h2 className="font-semibold">學習總進度</h2>
        <p className="mt-1 text-sm text-zinc-500">
          總共已完全學會 {totalStats.learned} / {totalStats.total} 個單字
        </p>
        <ProgressBar percent={totalStats.percent} color="var(--hero-gold)" />

        <div className="mt-4 flex items-center justify-between text-sm">
          <span>已經學習過的進度（依每週規劃，累積到本週）</span>
          <span className="text-xs text-zinc-400">
            已學會 {taughtStats.learned} / {taughtStats.total} 字
          </span>
        </div>
        <ProgressBar percent={taughtStats.percent} />

        <button
          type="button"
          onClick={() => setShowLearnedList((v) => !v)}
          className="mt-4 text-xs font-medium text-[var(--hero-blue)] underline"
        >
          {showLearnedList ? '收起已學會的單字清單' : `展開已學會的單字清單（${totalStats.learned} 字）`}
        </button>
        {showLearnedList && (
          <div className="mt-2 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-lg bg-zinc-50 p-3">
            {totalStats.learnedWords.length === 0 ? (
              <span className="text-xs text-zinc-400">還沒有標記完全學會的單字。</span>
            ) : (
              totalStats.learnedWords.map((w) => (
                <span
                  key={w.id}
                  className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                >
                  {w.word}
                </span>
              ))
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {phases.map((p) => {
            const { percent, total, learned } = phaseCompletion(p.phase, progress);
            return (
              <div key={p.phase} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">{p.phaseLabel}</h3>
                  <span className="text-xs text-zinc-400">
                    {total === 0 ? '尚未建立' : `已學會 ${learned} / ${total} 字`}
                  </span>
                </div>
                <ProgressBar percent={percent} color="var(--hero-gold)" />
                <div className="mt-1 text-right text-xs text-zinc-400">{percent}%</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 本週進度 */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white p-4 text-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">本週進度</h2>
          <button
            type="button"
            onClick={handleClearWeek}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            清除本週規劃
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlanWeekKey((k) => shiftWeekKey(k, -1))}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-700 hover:bg-zinc-200"
          >
            ◀
          </button>
          <span className="text-sm font-medium text-zinc-700">
            {getWeekRangeLabel(planWeekKey)}
            {isCurrentWeek && <span className="ml-1 text-[var(--hero-blue)]">（本週）</span>}
          </span>
          <button
            type="button"
            onClick={() => setPlanWeekKey((k) => shiftWeekKey(k, 1))}
            className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold text-zinc-700 hover:bg-zinc-200"
          >
            ▶
          </button>
        </div>

        <p className="mt-3 text-center text-sm text-zinc-500">
          目標每週 {WEEKLY_TARGET} 個單字・已選 {planWeekIds.length} / {WEEKLY_TARGET}
          {planWeekIds.length > 0 && `・已學會 ${planWeekStats.learned} / ${planWeekIds.length}`}
        </p>
        <ProgressBar percent={Math.min(100, Math.round((planWeekIds.length / WEEKLY_TARGET) * 100))} />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSource('phonics')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              source === 'phonics'
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            自然發音字卡
          </button>
          <button
            type="button"
            onClick={() => setSource('sight')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              source === 'sight'
                ? 'bg-[var(--hero-gold)] text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            重要單字卡
          </button>
        </div>

        {source === 'phonics' ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {phases.map((p) => (
                <button
                  key={p.phase}
                  type="button"
                  onClick={() => {
                    setPhonicsPhase(p.phase);
                    setPhonicsSubPhase(null);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    phonicsPhase === p.phase
                      ? 'bg-[var(--hero-gold)] text-zinc-900'
                      : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  {p.phaseLabel}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPhonicsSubPhase(null)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  phonicsSubPhase === null
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                全部
              </button>
              {phonicsPhaseInfo.subPhases.map((key) => {
                const sample = phonicsWordsInPhase.find((w) => w.subPhaseKey === key);
                if (!sample) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPhonicsSubPhase(key)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      phonicsSubPhase === key
                        ? 'bg-[var(--hero-gold)] text-zinc-900'
                        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                    }`}
                  >
                    {sample.subPhase}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {sightWordStages.map((s) => (
              <button
                key={s.stage}
                type="button"
                onClick={() => setSightStage(s.stage)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  sightStage === s.stage
                    ? 'bg-[var(--hero-gold)] text-zinc-900'
                    : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {s.stageLabel.replace('Sight Words：', '')}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex max-h-80 flex-wrap gap-2 overflow-y-auto rounded-lg bg-zinc-50 p-3">
          {pickerWords.map((w) => {
            const selected = planWeekIds.includes(w.id);
            const isLearned = !!(progress[w.id]?.canPronounce && progress[w.id]?.canUnderstand);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => handleToggleWord(w.id)}
                disabled={isLearned}
                title={isLearned ? '已經標記為完全學會' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isLearned
                    ? 'cursor-not-allowed bg-zinc-200 text-zinc-400'
                    : selected
                      ? 'bg-[var(--hero-gold)] text-zinc-900'
                      : 'bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {isLearned ? '✔︎ ' : selected ? '✓ ' : ''}
                {w.word}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
