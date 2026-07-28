import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';

export default function GamesPage() {
  return (
    <main className="relative flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-10 text-center mx-auto">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-6xl">🎮</span>
        <h1 className="mt-4 text-3xl font-bold text-[var(--hero-gold)]">小遊戲</h1>
        <p className="mt-3 text-sm text-zinc-300">
          學習小遊戲會陸續加入，敬請期待！
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          回首頁
        </Link>
      </div>
    </main>
  );
}
