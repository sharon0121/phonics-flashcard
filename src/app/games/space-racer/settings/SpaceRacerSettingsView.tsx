'use client';

import Link from 'next/link';
import {
  useSpaceRacerStepTiers,
  setSpaceRacerStepTiers,
  STEP_TIER_OPTIONS,
  type StepTier,
} from '@/lib/spaceRacerSettings';

export default function SpaceRacerSettingsView() {
  const stepTiers = useSpaceRacerStepTiers();
  const sorted = [...stepTiers].sort((a, b) => a - b);

  function toggleTier(value: StepTier) {
    const next = stepTiers.includes(value) ? stepTiers.filter((v) => v !== value) : [...stepTiers, value];
    if (next.length === 0) return;
    setSpaceRacerStepTiers(next);
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
          <h2 className="text-sm font-bold">🔢 數列規律（可複選）</h2>
          <p className="mt-1 text-xs text-zinc-400">
            從最小的規律開始，連續答對 10 題升一層 → 目前最高層：+{sorted[sorted.length - 1]}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STEP_TIER_OPTIONS.map((opt) => {
              const checked = stepTiers.includes(opt.value);
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
                    onChange={() => toggleTier(opt.value)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          {sorted.length > 1 && (
            <p className="mt-2 text-[10px] text-zinc-500">
              進度：{sorted.map((s, i) => `第${i + 1}層：+${s}`).join(' → ')}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            看清楚上方數列的規律，開船撞向答案正確的那個門，撞錯會扣一顆心！
          </p>
        </div>
      </div>
    </div>
  );
}
