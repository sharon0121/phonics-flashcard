'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '首頁' },
  {
    href: '/english',
    label: 'English',
    icon: '🔤',
    extraMatch: ['/browse', '/sight-words', '/print', '/progress', '/quiz'],
  },
  { href: '/math', label: 'Math', icon: '🧮' },
  { href: '/games', label: 'Game', icon: '🎮' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="no-print sticky top-0 z-10 border-b-4 border-[var(--hero-gold)] bg-gradient-to-r from-[var(--hero-blue-dark)] via-[var(--hero-blue)] to-[var(--hero-blue-dark)] shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3">
        <span className="mr-4 text-xl font-bold text-[var(--hero-gold)]">💥 英雄學習平台</span>
        <div className="flex flex-wrap gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href) || (item.extraMatch?.some((p) => pathname.startsWith(p)) ?? false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors visited:text-white ${
                  isActive
                    ? 'bg-[var(--hero-gold)] text-zinc-900 visited:text-zinc-900'
                    : 'text-white hover:bg-white/20 hover:text-[var(--hero-gold)]'
                }`}
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
