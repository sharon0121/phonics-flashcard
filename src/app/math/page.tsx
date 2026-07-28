import Link from 'next/link';
import MathSubNav from '@/components/MathSubNav';
import HeroMascot from '@/components/HeroMascot';

const categories = [
  {
    href: '/math/abacus',
    emoji: '🧮',
    title: '珠算',
    description: '實體算盤練習，7 行 → 8 行 → 10 行漸進訓練',
    accent: 'var(--hero-red)',
    ready: true,
  },
  {
    href: '/math/mental',
    emoji: '🧠',
    title: '心算',
    description: '腦中撥珠練習，10 題 3 分鐘',
    accent: 'var(--hero-blue)',
    ready: true,
  },
];

export default function MathPage() {
  return (
    <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-math.png" alt="" />
      <div className="relative z-10">
        <MathSubNav />
        <h1 className="text-2xl font-bold text-[var(--hero-gold)]">數學珠心算</h1>
        <p className="mt-1 text-sm text-zinc-300">選一個模式開始練習吧！</p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {categories.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              style={{ borderColor: c.accent }}
              className="flex flex-col items-center rounded-2xl border-[3px] bg-white p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl"
            >
              <span className="text-5xl">{c.emoji}</span>
              <h2 className="mt-3 text-xl font-bold text-zinc-900">{c.title}</h2>
              <p className="mt-2 text-xs text-zinc-500">{c.description}</p>
              {!c.ready && (
                <span className="mt-3 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
                  敬請期待
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
