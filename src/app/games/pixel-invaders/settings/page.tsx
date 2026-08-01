'use client';

import BackButton from '@/components/BackButton';
import { useEffect, useState } from 'react';

const SETTINGS_KEY = 'pixelInvaders_settings';

interface Settings {
  ranges: number[];
  operandCounts: number[];
  combatSecs: number;
  quizSecs: number;
  shootSound: boolean;
  quizMode: 'math' | 'english' | 'mixed';
  englishPhases: number[];
}

const DEFAULTS: Settings = {
  ranges: [20], operandCounts: [2], combatSecs: 10, quizSecs: 8, shootSound: true,
  quizMode: 'math', englishPhases: [1, 2],
};

function loadSettings(): Settings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function toggleItem(arr: number[], val: number): number[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

export default function PixelInvadersSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => { setSettings(loadSettings()); }, []);

  const update = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  };

  const toggleRange = (val: number) => {
    const next = toggleItem(settings.ranges, val);
    if (next.length === 0) return;
    update('ranges', next);
  };

  const toggleCount = (val: number) => {
    const next = toggleItem(settings.operandCounts, val);
    if (next.length === 0) return;
    update('operandCounts', next);
  };

  const togglePhase = (val: number) => {
    const next = toggleItem(settings.englishPhases, val);
    if (next.length === 0) return;
    update('englishPhases', next);
  };

  const checkCls = (active: boolean) =>
    `px-3 py-2 rounded-lg font-mono text-sm font-bold border-2 transition-all ${
      active
        ? 'bg-yellow-400 text-black border-yellow-400'
        : 'bg-white/10 text-gray-300 border-gray-600 hover:border-yellow-500 hover:text-yellow-400'
    }`;

  const btnCls = (active: boolean) =>
    `px-4 py-2 rounded-lg font-mono text-sm font-bold border-2 transition-all ${
      active
        ? 'bg-yellow-400 text-black border-yellow-400'
        : 'bg-white/10 text-gray-300 border-gray-600 hover:border-yellow-500 hover:text-yellow-400'
    }`;

  const sortedRanges = [...settings.ranges].sort((a,b)=>a-b);
  const sortedCounts = [...settings.operandCounts].sort((a,b)=>a-b);

  return (
    <main className="flex flex-col items-center min-h-screen bg-[#05091c] py-8 px-4 text-white">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="text-yellow-400 font-bold text-xl font-mono">⚙️ 遊戲設定</h1>
        </div>

        <div className="space-y-6">
          {/* Range selection */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-1 uppercase tracking-wide">數字範圍（可複選）</h2>
            <p className="text-xs text-gray-500 font-mono mb-3">
              從最小開始，連答 10 題升一層 → 目前最高層：{sortedRanges[sortedRanges.length-1]} 以內
            </p>
            <div className="flex flex-wrap gap-2">
              {[10,20,30,40,60,80,100].map(r => (
                <button key={r} onClick={() => toggleRange(r)} className={checkCls(settings.ranges.includes(r))}>
                  {r} 以內
                </button>
              ))}
            </div>
            {sortedRanges.length > 1 && (
              <p className="mt-2 text-[10px] text-gray-600 font-mono">
                進度：{sortedRanges.map((r,i)=>`第${i+1}層：${r}以內`).join(' → ')}
              </p>
            )}
          </section>

          {/* Operand count */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-1 uppercase tracking-wide">數字個數（可複選）</h2>
            <p className="text-xs text-gray-500 font-mono mb-3">從最少開始，連答 10 題升一層</p>
            <div className="flex gap-2 flex-wrap">
              {[2,3,4,5].map(c => (
                <button key={c} onClick={() => toggleCount(c)} className={checkCls(settings.operandCounts.includes(c))}>
                  {c} 個數字
                  <div className="text-[9px] font-normal opacity-60">
                    {c===2?'a ± b':c===3?'a ± b ± c':c===4?'a ± b ± c ± d':'a ± b ± c ± d ± e'}
                  </div>
                </button>
              ))}
            </div>
            {sortedCounts.length > 1 && (
              <p className="mt-2 text-[10px] text-gray-600 font-mono">
                進度：{sortedCounts.map((c,i)=>`第${i+1}層：${c}個數字`).join(' → ')}
              </p>
            )}
          </section>

          {/* Combat duration */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-3 uppercase tracking-wide">戰鬥時間</h2>
            <div className="flex gap-2 flex-wrap">
              {[8,10,15,20].map(s => (
                <button key={s} onClick={() => update('combatSecs', s)} className={btnCls(settings.combatSecs === s)}>
                  {s} 秒
                </button>
              ))}
            </div>
          </section>

          {/* Quiz time limit */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-1 uppercase tracking-wide">答題時限</h2>
            <p className="text-xs text-gray-500 font-mono mb-3">超時視同答錯，連答紀錄歸零</p>
            <div className="flex gap-2 flex-wrap">
              {[5,8,10,12,15].map(s => (
                <button key={s} onClick={() => update('quizSecs', s)} className={btnCls(settings.quizSecs === s)}>
                  {s} 秒
                </button>
              ))}
            </div>
          </section>

          {/* Quiz mode */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-1 uppercase tracking-wide">出題模式</h2>
            <p className="text-xs text-gray-500 font-mono mb-3">時空凍結時要答什麼題目</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { val: 'math',    label: '📐 數學' },
                { val: 'english', label: '🔤 英文' },
                { val: 'mixed',   label: '🎲 英文＋數學' },
              ] as const).map(o => (
                <button key={o.val} onClick={() => update('quizMode', o.val)} className={btnCls(settings.quizMode === o.val)}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* English phases — only shown when quizMode involves English */}
          {(settings.quizMode === 'english' || settings.quizMode === 'mixed') && (
            <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
              <h2 className="text-sm font-bold text-gray-400 font-mono mb-1 uppercase tracking-wide">英文題目來源（可複選）</h2>
              <p className="text-xs text-gray-500 font-mono mb-3">勾選要出哪幾個 Phase 的英文字彙</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { val: 1, label: 'Phase 1', desc: '短母音' },
                  { val: 2, label: 'Phase 2', desc: '複合輔音' },
                  { val: 3, label: 'Phase 3', desc: '輔音連音' },
                  { val: 4, label: 'Phase 4', desc: 'Magic E' },
                  { val: 5, label: 'Phase 5', desc: '母音組合' },
                  { val: 6, label: 'Phase 6', desc: 'R 控母音' },
                ]).map(p => (
                  <button key={p.val} onClick={() => togglePhase(p.val)} className={checkCls(settings.englishPhases.includes(p.val))}>
                    {p.label}
                    <div className="text-[9px] font-normal opacity-70">{p.desc}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Shoot sound */}
          <section className="bg-gray-900/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-400 font-mono mb-3 uppercase tracking-wide">射擊音效</h2>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-mono text-sm">{settings.shootSound ? '🔊 已開啟' : '🔇 已關閉'}</span>
              <button
                onClick={() => update('shootSound', !settings.shootSound)}
                className={`w-14 h-7 rounded-full transition-colors relative ${settings.shootSound ? 'bg-yellow-400' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.shootSound ? 'translate-x-7' : 'translate-x-0.5'}`}/>
              </button>
            </div>
          </section>

          <p className="text-center text-gray-600 text-xs font-mono">設定即時儲存，下次開局生效</p>
        </div>
      </div>
    </main>
  );
}
