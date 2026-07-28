import Image from 'next/image';
import Link from 'next/link';

const categories = [
  {
    href: '/english',
    image: '/heroes/hero-english.png',
    imgWidth: 500,
    imgHeight: 866,
    title: '英文學習',
    description: '自然發音字卡、重要單字卡、列印、進度、測驗',
    accent: 'var(--hero-red)',
    ready: true,
  },
  {
    href: '/math',
    image: '/heroes/hero-math.png',
    imgWidth: 500,
    imgHeight: 646,
    title: '數學珠心算',
    description: '珠算、心算練習與測驗',
    accent: 'var(--hero-blue)',
    ready: true,
  },
  {
    href: '/games',
    image: '/heroes/hero-game.png',
    imgWidth: 417,
    imgHeight: 485,
    title: '小遊戲',
    description: '各種學習小遊戲，陸續開發中',
    accent: 'var(--hero-gold)',
    ready: false,
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold text-[var(--hero-gold)]">英雄學習平台</h1>
      <p className="mt-2 text-sm text-zinc-300">選一個分類開始學習吧！</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{ borderColor: c.accent }}
            className="flex flex-col items-center rounded-2xl border-[3px] bg-white p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:rotate-[0.5deg] hover:shadow-xl"
          >
            <Image
              src={c.image}
              alt={`${c.title}小英雄`}
              width={c.imgWidth}
              height={c.imgHeight}
              className="h-64 w-auto rounded-2xl border-4 object-contain shadow-md"
              style={{ borderColor: c.accent }}
            />
            <h2 className="mt-4 text-2xl font-bold text-zinc-900">{c.title}</h2>
            <p className="mt-2 text-sm text-zinc-500">{c.description}</p>
            {!c.ready && (
              <span className="mt-3 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
                敬請期待
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
