'use client';

import { useEffect } from 'react';
import { playCelebrationChime } from '@/lib/sound';

interface ScoreCelebrationProps {
  score: number;
  total: number;
  perfectMessage?: string;
}

export default function ScoreCelebration({ score, total, perfectMessage }: ScoreCelebrationProps) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const tier: 'perfect' | 'great' | 'practice' = percent >= 100 ? 'perfect' : percent >= 80 ? 'great' : 'practice';

  useEffect(() => {
    if (tier === 'perfect') playCelebrationChime();
    // Only play once when the celebration first mounts for a perfect score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tier === 'perfect') {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-[3px] border-[var(--hero-gold)] bg-gradient-to-b from-yellow-50 to-white p-6 text-center shadow-lg">
        <div className="animate-bounce text-5xl">🎆🏆🎆</div>
        <div className="text-2xl font-bold text-[var(--hero-red)]">{perfectMessage ?? '你超棒！'}</div>
      </div>
    );
  }

  if (tier === 'great') {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-[3px] border-emerald-400 bg-emerald-50 p-6 text-center shadow-lg">
        <div className="text-5xl">👍</div>
        <div className="text-xl font-bold text-emerald-700">很棒喔！下次要再細心一點喔</div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-[3px] border-sky-300 bg-sky-50 p-6 text-center shadow-lg">
      <div className="text-5xl">🤗</div>
      <div className="text-xl font-bold text-sky-700">加油！再練習一次吧～</div>
    </div>
  );
}
