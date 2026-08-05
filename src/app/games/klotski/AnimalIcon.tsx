// Flat "sticker" style faces (thick outline, rounded square, blush cheeks)
// matching the reference art Sharon picked — hand-drawn as SVG rather than
// emoji, since emoji render differently per platform and can't match a
// specific flat-illustration style.

import type { PieceType } from '@/lib/klotski';

export type AnimalKind = 'hero' | 'crab' | 'giraffe' | 'rabbit';

export const TYPE_TO_ANIMAL: Record<PieceType, AnimalKind> = {
  caocao: 'hero',
  horizontal: 'crab',
  vertical: 'giraffe',
  soldier: 'rabbit',
};

export const ANIMAL_LABEL: Record<AnimalKind, string> = {
  hero: '英雄',
  crab: '螃蟹',
  giraffe: '長頸鹿',
  rabbit: '兔兔',
};

const OUTLINE = '#2b2b2b';
const BLUSH = '#ffb3c1';

// Reuses the site's own hero palette (--hero-red / --hero-blue / --hero-gold
// from globals.css) so the escaping piece reads as "the same hero" as the
// rest of the app, not a generic character.
function Hero() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path d="M20 60 Q10 90 32 92 Q30 70 40 62 Z" fill="#e0262f" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M80 60 Q90 90 68 92 Q70 70 60 62 Z" fill="#e0262f" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <rect x="14" y="14" width="72" height="72" rx="24" fill="#ffdcb0" stroke={OUTLINE} strokeWidth="6" />
      <path d="M16 30 Q14 12 50 12 Q86 12 84 30 Q68 20 50 20 Q32 20 16 30 Z" fill="#5a3a22" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <rect x="20" y="24" width="60" height="12" rx="6" fill="#ffcc33" stroke={OUTLINE} strokeWidth="4" />
      <circle cx="50" cy="30" r="6" fill="#e0262f" stroke={OUTLINE} strokeWidth="3" />
      <ellipse cx="30" cy="64" rx="8" ry="6" fill={BLUSH} opacity="0.85" />
      <ellipse cx="70" cy="64" rx="8" ry="6" fill={BLUSH} opacity="0.85" />
      <circle cx="38" cy="50" r="5.5" fill={OUTLINE} />
      <circle cx="62" cy="50" r="5.5" fill={OUTLINE} />
      <circle cx="40.5" cy="47.5" r="1.7" fill="#fff" />
      <circle cx="64.5" cy="47.5" r="1.7" fill="#fff" />
      <path d="M42 70 q8 6 16 0" stroke={OUTLINE} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Crab() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path
        d="M13 46 Q1 38 5 24 Q16 20 22 34 Z"
        fill="#ff6f4a"
        stroke={OUTLINE}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M87 46 Q99 38 95 24 Q84 20 78 34 Z"
        fill="#ff6f4a"
        stroke={OUTLINE}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect x="14" y="22" width="72" height="64" rx="22" fill="#ff6f4a" stroke={OUTLINE} strokeWidth="6" />
      <line x1="38" y1="20" x2="38" y2="12" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <line x1="62" y1="20" x2="62" y2="12" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <circle cx="38" cy="10" r="9" fill="#fff" stroke={OUTLINE} strokeWidth="4" />
      <circle cx="62" cy="10" r="9" fill="#fff" stroke={OUTLINE} strokeWidth="4" />
      <circle cx="38" cy="11" r="4" fill={OUTLINE} />
      <circle cx="62" cy="11" r="4" fill={OUTLINE} />
      <ellipse cx="30" cy="58" rx="7" ry="5" fill={BLUSH} opacity="0.9" />
      <ellipse cx="70" cy="58" rx="7" ry="5" fill={BLUSH} opacity="0.9" />
      <path d="M42 66 q8 6 16 0" stroke={OUTLINE} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Giraffe() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <line x1="38" y1="4" x2="38" y2="18" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <line x1="62" y1="4" x2="62" y2="18" stroke={OUTLINE} strokeWidth="5" strokeLinecap="round" />
      <circle cx="38" cy="6" r="6" fill="#e88a2e" stroke={OUTLINE} strokeWidth="4" />
      <circle cx="62" cy="6" r="6" fill="#e88a2e" stroke={OUTLINE} strokeWidth="4" />
      <ellipse cx="16" cy="32" rx="8" ry="12" fill="#ffcf7a" stroke={OUTLINE} strokeWidth="5" transform="rotate(-25 16 32)" />
      <ellipse cx="84" cy="32" rx="8" ry="12" fill="#ffcf7a" stroke={OUTLINE} strokeWidth="5" transform="rotate(25 84 32)" />
      <rect x="14" y="18" width="72" height="68" rx="22" fill="#ffcf7a" stroke={OUTLINE} strokeWidth="6" />
      <rect x="28" y="58" width="44" height="24" rx="12" fill="#ffe0a3" stroke={OUTLINE} strokeWidth="5" />
      <circle cx="26" cy="34" r="5" fill="#e88a2e" opacity="0.85" />
      <circle cx="70" cy="30" r="6" fill="#e88a2e" opacity="0.85" />
      <circle cx="60" cy="46" r="4" fill="#e88a2e" opacity="0.85" />
      <ellipse cx="28" cy="66" rx="6" ry="4" fill={BLUSH} opacity="0.85" />
      <ellipse cx="72" cy="66" rx="6" ry="4" fill={BLUSH} opacity="0.85" />
      <circle cx="38" cy="42" r="5" fill={OUTLINE} />
      <circle cx="62" cy="42" r="5" fill={OUTLINE} />
      <circle cx="40" cy="40" r="1.5" fill="#fff" />
      <circle cx="64" cy="40" r="1.5" fill="#fff" />
      <circle cx="44" cy="70" r="2" fill={OUTLINE} />
      <circle cx="56" cy="70" r="2" fill={OUTLINE} />
    </svg>
  );
}

function Rabbit() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <path d="M30 20 Q26 -2 40 0 Q48 2 44 22 Z" fill="#ffffff" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M70 20 Q74 -2 60 0 Q52 2 56 22 Z" fill="#ffffff" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M34 18 Q32 4 40 5 Q45 6 42 19 Z" fill={BLUSH} opacity="0.7" />
      <path d="M66 18 Q68 4 60 5 Q55 6 58 19 Z" fill={BLUSH} opacity="0.7" />
      <rect x="14" y="18" width="72" height="68" rx="24" fill="#ffffff" stroke={OUTLINE} strokeWidth="6" />
      <ellipse cx="28" cy="62" rx="8" ry="6" fill={BLUSH} opacity="0.9" />
      <ellipse cx="72" cy="62" rx="8" ry="6" fill={BLUSH} opacity="0.9" />
      <circle cx="38" cy="48" r="5" fill={OUTLINE} />
      <circle cx="62" cy="48" r="5" fill={OUTLINE} />
      <circle cx="40" cy="46" r="1.5" fill="#fff" />
      <circle cx="64" cy="46" r="1.5" fill="#fff" />
      <ellipse cx="50" cy="58" rx="3" ry="2" fill={BLUSH} />
      <path d="M50 60 q0 4 -4 5 M50 60 q0 4 4 5" stroke={OUTLINE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const ANIMAL_COMPONENT: Record<AnimalKind, () => React.ReactElement> = {
  hero: Hero,
  crab: Crab,
  giraffe: Giraffe,
  rabbit: Rabbit,
};

export function AnimalIcon({ kind, className }: { kind: AnimalKind; className?: string }) {
  const Component = ANIMAL_COMPONENT[kind];
  return (
    <div className={className}>
      <Component />
    </div>
  );
}
