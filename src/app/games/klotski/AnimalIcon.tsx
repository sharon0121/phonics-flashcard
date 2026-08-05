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

// Spider-hero: crimson mask with web pattern + large angular white eyes.
function Hero() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {/* Side capes */}
      <path d="M20 62 Q8 94 32 94 Q30 72 40 64 Z" fill="#be0f2f" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M80 62 Q92 94 68 94 Q70 72 60 64 Z" fill="#be0f2f" stroke={OUTLINE} strokeWidth="5" strokeLinejoin="round" />

      {/* Head — crimson spider mask */}
      <rect x="14" y="14" width="72" height="72" rx="24" fill="#c8102e" stroke={OUTLINE} strokeWidth="6" />

      {/* Web pattern — dark red on red */}
      <line x1="50" y1="14" x2="50" y2="86" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <path d="M14 38 Q50 30 86 38" fill="none" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <path d="M14 58 Q50 49 86 58" fill="none" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <path d="M18 74 Q50 66 82 74" fill="none" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <line x1="50" y1="14" x2="14" y2="55" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <line x1="50" y1="14" x2="86" y2="55" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <line x1="14" y1="55" x2="40" y2="86" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />
      <line x1="86" y1="55" x2="60" y2="86" stroke="#8a0a20" strokeWidth="1.8" opacity="0.65" />

      {/* Spider eyes — large angular ovals pointing inward */}
      <ellipse cx="34" cy="44" rx="15" ry="9.5" fill="white" stroke={OUTLINE} strokeWidth="2.5" transform="rotate(-18 34 44)" />
      <ellipse cx="66" cy="44" rx="15" ry="9.5" fill="white" stroke={OUTLINE} strokeWidth="2.5" transform="rotate(18 66 44)" />
      <ellipse cx="33" cy="43" rx="9" ry="5.5" fill="#e0e0e0" transform="rotate(-18 33 43)" />
      <ellipse cx="67" cy="43" rx="9" ry="5.5" fill="#e0e0e0" transform="rotate(18 67 43)" />
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
