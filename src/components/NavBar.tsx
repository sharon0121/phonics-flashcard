'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '首頁', icon: '🏠' },
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
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-3 py-2.5 sm:px-4 sm:py-3">
        <span className="mr-2 shrink-0 text-base font-bold whitespace-nowrap text-[var(--hero-gold)] sm:mr-4 sm:text-xl">
          💥 英雄學習平台
        </span>
        <div className="flex flex-wrap gap-0.5 sm:gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href) || (item.extraMatch?.some((p) => pathname.startsWith(p)) ?? false);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1.5 text-sm font-bold transition-colors visited:text-white sm:px-3 ${
                  isActive
                    ? 'bg-[var(--hero-gold)] text-zinc-900 visited:text-zinc-900'
                    : 'text-white hover:bg-white/20 hover:text-[var(--hero-gold)]'
                }`}
              >
                {item.icon && <span className="text-base sm:mr-1 sm:text-sm">{item.icon}</span>}
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
