'use client';

import Link from 'next/link';
import {
  ALL_MAX_FACTOR_TIERS,
  ALL_DIFFICULTY_STAGES,
  DIFFICULTY_STAGE_LABELS,
  ALL_MONSTER_VARIETIES,
  MONSTER_VARIETY_LABELS,
  useMonsterDessertSettings,
  setMaxFactorTiers,
  setDifficultyStage,
  setMonsterVariety,
  type MonsterVarietyKey,
} from '@/lib/monsterDessertSettings';

export default function MonsterDessertSettingsView() {
  const { maxFactorTiers, difficultyStage, monsterVariety } = useMonsterDessertSettings();

  function toggleTier(tier: number) {
    const next = maxFactorTiers.includes(tier)
      ? maxFactorTiers.filter((t) => t !== tier)
      : [...maxFactorTiers, tier];
    setMaxFactorTiers(next);
  }

  function toggleVariety(key: MonsterVarietyKey) {
    setMonsterVariety({ ...monsterVariety, [key]: !monsterVariety[key] });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/games/monster-dessert"
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
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">⚙️ 怪獸點心店設定</h1>
      <p className="mt-1 text-sm text-zinc-300">調整乘法題目的難度範圍，還有要不要出現特殊怪獸關卡。</p>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">🔢 乘法難度（盤數／每盤數量上限）</h2>
          <button
            type="button"
            onClick={() => setMaxFactorTiers(ALL_MAX_FACTOR_TIERS)}
            className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
          >
            全選
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          連續答對 10 題會自動升一階，一路升到你勾選的最難等級。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_MAX_FACTOR_TIERS.map((tier) => {
            const checked = maxFactorTiers.includes(tier);
            return (
              <label
                key={tier}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                  checked ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTier(tier)}
                  className="h-4 w-4 cursor-pointer accent-zinc-900"
                />
                {tier} 以內
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">📈 學習階段</h2>
        <p className="mt-1 text-xs text-zinc-500">每個階段固定用同一種方式出題，適合第一次學乘法的小朋友慢慢適應。</p>
        <div className="mt-2 flex flex-col gap-2">
          {ALL_DIFFICULTY_STAGES.map((stage) => {
            const checked = difficultyStage === stage;
            const { title, description } = DIFFICULTY_STAGE_LABELS[stage];
            return (
              <label
                key={stage}
                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 ${
                  checked ? 'bg-[var(--hero-gold)]' : 'bg-zinc-50 hover:bg-zinc-100'
                }`}
              >
                <input
                  type="radio"
                  name="difficultyStage"
                  checked={checked}
                  onChange={() => setDifficultyStage(stage)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900"
                />
                <span>
                  <span className="block text-sm font-bold text-zinc-900">{title}</span>
                  <span className="block text-xs text-zinc-600">{description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
        <h2 className="text-sm font-bold text-zinc-900">👾 特殊怪獸關卡</h2>
        <div className="mt-2 flex flex-col gap-2">
          {ALL_MONSTER_VARIETIES.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
            >
              {MONSTER_VARIETY_LABELS[key]}
              <input
                type="checkbox"
                checked={monsterVariety[key]}
                onChange={() => toggleVariety(key)}
                className="h-5 w-5 cursor-pointer accent-zinc-900"
              />
            </label>
          ))}
        </div>
      </div>
    </main>
  );
}
