'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const subNavItems = [
  { href: '/math', label: '總覽' },
  { href: '/math/abacus', label: '珠算' },
  { href: '/math/mental', label: '心算' },
];

export default function MathSubNav() {
  const pathname = usePathname();
  return (
    <div className="no-print -mx-4 mb-6 overflow-x-auto border-b border-white/10 px-4 pb-3">
      <div className="flex gap-1.5">
        {subNavItems.map((item) => {
          const isActive = pathname === item.href;
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
