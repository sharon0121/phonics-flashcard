'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const subNavItems = [
  { href: '/english', label: '總覽' },
  { href: '/browse', label: '自然發音字卡' },
  { href: '/sight-words', label: '重要單字卡' },
  { href: '/print', label: '列印' },
  { href: '/progress', label: '進度' },
  { href: '/quiz', label: '測驗' },
];

export default function EnglishSubNav() {
  const pathname = usePathname();

  return (
    <div className="no-print -mx-4 mb-6 overflow-x-auto border-b border-white/10 px-4 pb-3">
      <div className="flex gap-1.5">
        {subNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors visited:text-inherit ${
                isActive
                  ? 'bg-[var(--hero-gold)] text-zinc-900'
                  : 'bg-white/10 text-zinc-200 hover:bg-white/20'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
