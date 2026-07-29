'use client';

import { useState, useEffect } from 'react';
import { phases, getWordsByPhase, words as allWords, getWordById } from '@/data/words';
import {
  sightWordStages,
  getSightWordsByStage,
  sightWords,
  getSightWordById,
} from '@/data/sightWords';
import { useProgress, clearProgress, updateWordProgressFresh, clearReinforcementFresh } from '@/lib/progress';
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
import { getCustomWordById } from '@/lib/customWords';
import EnglishSubNav from '@/components/EnglishSubNav';
import BackButton from '@/components/BackButton';

const WEEKLY_TARGET = 10;

function resolveWord(id: string): Word | undefined {
  return getWordById(id) ?? getSightWordById(id) ?? getCustomWordById(id);
}

function learnedStats(wordIds: string[], progress: ProgressMap) {
  const resolved = wordIds.map(resolveWord).filter((w): w is Word => !!w);
  const total = resolved.length;
  const learnedWords = resolved.filter(
    (w) => progress[w.id]?.canUnderstand
  );
  const percent = total === 0 ? 0 : Math.round((learnedWords.length / total) * 100);
  return { total, learned: learnedWords.length, percent, learnedWords };
}

function sightStageCompletion(stage: number, progress: ProgressMap) {
  const wordsInStage = getSightWordsByStage(stage);
  if (wordsInStage.length === 0) return { percent: 0, total: 0, learned: 0 };
  let learned = 0;
  for (const w of wordsInStage) {
    if (progress[w.id]?.canUnderstand) learned += 1;
  }
  const percent = Math.round((learned / wordsInStage.length) * 100);
  return { percent, total: wordsInStage.length, learned };
}

function phaseCompletion(phase: number, progress: ProgressMap) {
  const wordsInPhase = getWordsByPhase(phase);
  if (wordsInPhase.length === 0) return { percent: 0, total: 0, learned: 0 };
  let learned = 0;
  for (const w of wordsInPhase) {
    if (progress[w.id]?.canUnderstand) learned += 1;
  }
  const percent = Math.round((learned / wordsInPhase.length) * 100);
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
  const [pendingReset, setPendingReset] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);

  // 3 秒後自動取消待確認狀態
  useEffect(() => {
    if (!pendingReset) return;
    const t = setTimeout(() => setPendingReset(null), 3000);
    return () => clearTimeout(t);
  }, [pendingReset]);

  function handleClearProgress() {
    if (!window.confirm('確定要清除所有學習進度嗎？此動作無法復原。')) return;
    clearProgress();
  }

  function handleClearWeek() {
    if (!window.confirm(`確定要清除 ${getWeekRangeLabel(planWeekKey)} 這週的規劃嗎？其他週的規劃不會受影響。`)) return;
    clearWeek(planWeekKey);
  }

  function handleToggleWord(wordId: string) {
    setPendingReset(null);
    toggleWordInWeekFresh(planWeekKey, wordId);
  }

  function handleResetWord(wordId: string) {
    if (pendingReset === wordId) {
      updateWordProgressFresh(wordId, 'canUnderstand', false);
      clearReinforcementFresh(wordId);
      if (!planWeekIds.includes(wordId)) {
        toggleWordInWeekFresh(planWeekKey, wordId);
      }
      setPendingReset(null);
    } else {
      setPendingReset(wordId);
    }
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
  const pickerWords: Word[] = (() => {
    const base =
      source === 'phonics'
        ? phonicsSubPhase
          ? phonicsWordsInPhase.filter((w) => w.subPhaseKey === phonicsSubPhase)
          : phonicsWordsInPhase
        : getSightWordsByStage(sightStage);
    if (!hideCompleted) return base;
    return base.filter((w) => !progress[w.id]?.canUnderstand && !progress[w.id]?.needsReinforcement);
  })();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <EnglishSubNav />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-2xl font-bold text-[var(--hero-gold)]">學習進度</h1>
        </div>
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

      </section>

      {/* 自然發音字卡 & 重要單字卡 — 各自獨立卡片，並排 */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 自然發音字卡 */}
        <section className="rounded-xl border-2 border-[var(--hero-gold)] bg-white p-4 text-zinc-900">
          <h2 className="font-semibold text-zinc-900">🔤 自然發音字卡</h2>
          <div className="mt-3 flex flex-col gap-2">
            {phases.map((p) => {
              const { percent, total, learned } = phaseCompletion(p.phase, progress);
              return (
                <div key={p.phase} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800">{p.phaseLabel}</span>
                    <span className="text-xs text-zinc-400">
                      {total === 0 ? '尚未建立' : `${learned}/${total}`}
                    </span>
                  </div>
                  <ProgressBar percent={percent} color="var(--hero-gold)" />
                  <div className="mt-1 text-right text-xs text-zinc-400">{percent}%</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 重要單字卡 */}
        <section className="rounded-xl border-2 border-[var(--hero-blue)] bg-white p-4 text-zinc-900">
          <h2 className="font-semibold text-zinc-900">👁️ 重要單字卡</h2>
          <div className="mt-3 flex flex-col gap-2">
            {sightWordStages.map((s) => {
              const { percent, total, learned } = sightStageCompletion(s.stage, progress);
              return (
                <div key={s.stage} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-800">{s.stageLabel.replace('Sight Words：', '')}</span>
                    <span className="text-xs text-zinc-400">{learned}/{total}</span>
                  </div>
                  <ProgressBar percent={percent} color="var(--hero-blue)" />
                  <div className="mt-1 text-right text-xs text-zinc-400">{percent}%</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

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
          建議每週至少 {WEEKLY_TARGET} 個單字・已選 {planWeekIds.length} 個
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

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-400">
            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />已學會（點兩下可重新學習）</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full bg-orange-400" />加強</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full border-2 border-[var(--hero-gold)] bg-white" />已選本週</span>
            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full bg-zinc-200 ring-1 ring-zinc-300" />新單字</span>
          </div>
          <button
            type="button"
            onClick={() => setHideCompleted((v) => !v)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              hideCompleted
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {hideCompleted ? '顯示全部' : '隱藏已學會／加強'}
          </button>
        </div>
        <div className="mt-2 flex max-h-80 flex-wrap gap-2 overflow-y-auto rounded-lg bg-zinc-50 p-3">
          {pickerWords.map((w) => {
            const selected = planWeekIds.includes(w.id);
            const isLearned = !!progress[w.id]?.canUnderstand;
            const isReinforce = !!(progress[w.id]?.needsReinforcement && !progress[w.id]?.canUnderstand);
            const isPendingReset = pendingReset === w.id;
            if (isLearned) {
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleResetWord(w.id)}
                  title="再點一次確認重新學習"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                    isPendingReset
                      ? 'bg-red-100 text-red-600 ring-2 ring-red-400 hover:bg-red-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  {isPendingReset ? '再點一次確認' : '✔︎ '}
                  {!isPendingReset && w.word}
                </button>
              );
            }
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => handleToggleWord(w.id)}
                title={isReinforce ? '加強單字' : selected ? '已加入本週' : '點擊加入本週'}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isReinforce
                    ? selected
                      ? 'bg-orange-300 text-orange-900'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : selected
                      ? 'border-2 border-[var(--hero-gold)] bg-white text-zinc-800 hover:bg-amber-50'
                      : 'bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {isReinforce ? '🔥 ' : selected ? '✓ ' : ''}
                {w.word}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
