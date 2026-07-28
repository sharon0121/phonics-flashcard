'use client';

interface CountdownRingProps {
  totalSeconds: number;
  remainingSeconds: number;
}

export default function CountdownRing({ totalSeconds, remainingSeconds }: CountdownRingProps) {
  const clamped = Math.max(0, remainingSeconds);
  const percent = Math.max(0, Math.min(100, (clamped / totalSeconds) * 100));
  const isLow = clamped <= 60;
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const color = isLow ? 'var(--hero-red)' : 'var(--hero-gold)';

  return (
    <div
      className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full transition-[background]"
      style={{
        background: `conic-gradient(${color} ${percent}%, rgba(255,255,255,0.15) ${percent}%)`,
      }}
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--hero-blue-dark)]">
        <span className={`text-2xl font-bold tabular-nums ${isLow ? 'text-[var(--hero-red)]' : 'text-white'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
