'use client';

import Link from 'next/link';
import {
  useSpaceRacerLevelCap,
  setSpaceRacerLevelCap,
  LEVEL_CAP_OPTIONS,
  MAX_LEVEL,
  useSpaceRacerQuestionTypes,
  setSpaceRacerQuestionTypes,
  QUESTION_TYPE_OPTIONS,
  useSpaceRacerArithmeticSize,
  setSpaceRacerArithmeticSize,
  ARITHMETIC_SIZE_OPTIONS,
  useSpaceRacerArithmeticTerms,
  setSpaceRacerArithmeticTerms,
  ARITHMETIC_TERMS_OPTIONS,
  useSpaceRacerWordSources,
  setSpaceRacerWordSources,
  WORD_SOURCE_LABELS,
  WORD_SOURCE_DISPLAY_ORDER,
  ALL_WORD_SOURCES,
  type LevelCap,
  type QuestionType,
  type ArithmeticSize,
  type ArithmeticTerms,
  type WordSourceKey,
} from '@/lib/spaceRacerSettings';

export default function SpaceRacerSettingsView() {
  const levelCap = useSpaceRacerLevelCap();
  const questionTypes = useSpaceRacerQuestionTypes();
  const arithmeticSize = useSpaceRacerArithmeticSize();
  const arithmeticTerms = useSpaceRacerArithmeticTerms();
  const wordSources = useSpaceRacerWordSources();

  function toggleQuestionType(key: QuestionType) {
    const next = questionTypes.includes(key) ? questionTypes.filter((k) => k !== key) : [...questionTypes, key];
    setSpaceRacerQuestionTypes(next);
  }

  function toggleSource(key: WordSourceKey) {
    const next = wordSources.includes(key) ? wordSources.filter((k) => k !== key) : [...wordSources, key];
    setSpaceRacerWordSources(next);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link
          href="/games/space-racer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 太空賽車設定</h1>

        <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">🎯 題目類型</h2>
          <p className="mt-1 text-xs text-zinc-400">
            門裡出的題目類型，可複選，每一局隨機從勾選的類型抽一種：數列規律訓練邏輯推理，珠心算練心算，英文單字練拼字（題目會念出中文＋顯示注音，選完答案後會念出正確的英文單字）。預設只用「數列規律」。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUESTION_TYPE_OPTIONS.map((opt) => {
              const checked = questionTypes.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={
                    checked
                      ? { background: '#ffcc33', color: '#1a1a2e' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleQuestionType(opt.value as QuestionType)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">🧮 珠心算難度</h2>
          <p className="mt-1 text-xs text-zinc-400">
            設定珠心算題目的數字大小上限，以及要有幾個數字連加減，家長可依小朋友程度直接設定，不會隨關卡自動變化。
          </p>
          <div className="mt-2 text-xs font-bold text-zinc-400">數字大小</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {ARITHMETIC_SIZE_OPTIONS.map((opt) => {
              const checked = arithmeticSize === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={
                    checked
                      ? { background: '#ffcc33', color: '#1a1a2e' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }
                  }
                >
                  <input
                    type="radio"
                    name="arithmeticSize"
                    checked={checked}
                    onChange={() => setSpaceRacerArithmeticSize(opt.value as ArithmeticSize)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          <div className="mt-3 text-xs font-bold text-zinc-400">相加減的數字個數</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {ARITHMETIC_TERMS_OPTIONS.map((opt) => {
              const checked = arithmeticTerms === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={
                    checked
                      ? { background: '#ffcc33', color: '#1a1a2e' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }
                  }
                >
                  <input
                    type="radio"
                    name="arithmeticTerms"
                    checked={checked}
                    onChange={() => setSpaceRacerArithmeticTerms(opt.value as ArithmeticTerms)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <h2 className="text-sm font-bold">🏁 最高難度關卡</h2>
          <p className="mt-1 text-xs text-zinc-400">
            數列規律的難度會隨著玩的局數自動升級（每 5 局升一關，共 {MAX_LEVEL} 關，依序練習 1、10、5、2、3、4、6、7、8、9 的乘法表——照這個順序背九九乘法表比較好記），答錯不會被打回原本的關卡，只會停在原地繼續累積。這裡可以設定自動升級最高能升到第幾關。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVEL_CAP_OPTIONS.map((opt) => {
              const checked = levelCap === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={
                    checked
                      ? { background: '#ffcc33', color: '#1a1a2e' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }
                  }
                >
                  <input
                    type="radio"
                    name="levelCap"
                    checked={checked}
                    onChange={() => setSpaceRacerLevelCap(opt.value as LevelCap)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            看清楚上方數列的規律，選好車道後按「衝刺」開向答案正確的那個門，撞錯或太慢都會扣一顆心！
          </p>
        </div>

        <div className="mt-4 rounded-xl border-2 border-[var(--hero-gold)] bg-white/5 p-4 text-zinc-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">📚 單字考題來源</h2>
            <button
              type="button"
              onClick={() => setSpaceRacerWordSources(ALL_WORD_SOURCES)}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20"
            >
              全選
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            每玩 2 分鐘會暫停一次，考一題單字（英文選中文＋注音），答對五題連續才能繼續玩；如果上面「題目類型」也勾了「英文單字」，賽道上的門也會從這裡抽字。考題只會從下方勾選的來源抽字；預設只用「本週單字」，可複選。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WORD_SOURCE_DISPLAY_ORDER.map((key) => {
              const checked = wordSources.includes(key);
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold"
                  style={
                    checked
                      ? { background: '#ffcc33', color: '#1a1a2e' }
                      : { background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSource(key)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {WORD_SOURCE_LABELS[key]}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            如果勾選的來源加起來字數不夠出三選一，會自動改用自然發音卡＋重要單字卡的完整題庫。
          </p>
        </div>
      </div>
    </div>
  );
}
