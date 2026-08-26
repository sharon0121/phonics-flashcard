// Unlockable visual skins for Block Puzzle. Swapping a theme only changes
// how existing colorIndex values are painted (see blockpuzzle.ts) — it never
// touches game state, so switching mid-run is safe.

export type ThemeId = 'candy' | 'gem' | 'animal' | 'ocean';
export type ThemeStyle = 'flat' | 'glossy' | 'emoji';

export interface BlockTheme {
  id: ThemeId;
  name: string;
  icon: string;
  // Lifetime paw-prints collected required to unlock; 0 = unlocked from the start.
  unlockAt: number;
  style: ThemeStyle;
  colors: string[]; // one per palette index (see PALETTE_SIZE in blockpuzzle.ts)
  emojis?: string[]; // parallel to colors — only used when style === 'emoji'
}

export const BLOCK_THEMES: BlockTheme[] = [
  {
    id: 'candy',
    name: '經典糖果',
    icon: '🍬',
    unlockAt: 0,
    style: 'flat',
    colors: ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4'],
  },
  {
    id: 'gem',
    name: '寶石閃耀',
    icon: '💎',
    unlockAt: 25,
    style: 'glossy',
    colors: ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#22d3ee'],
  },
  {
    id: 'animal',
    name: '森林動物',
    icon: '🐾',
    unlockAt: 75,
    style: 'emoji',
    colors: ['#b45309', '#1d4ed8', '#15803d', '#b91c1c', '#7e22ce', '#0e7490'],
    emojis: ['🐻', '🦊', '🐸', '🐰', '🦉', '🐢'],
  },
  {
    id: 'ocean',
    name: '深海探險',
    icon: '🌊',
    unlockAt: 150,
    style: 'emoji',
    colors: ['#0369a1', '#1d4ed8', '#0d9488', '#0891b2', '#4338ca', '#0e7490'],
    emojis: ['🐠', '🐡', '🦑', '🐙', '🦀', '🫧'],
  },
];

export function getTheme(id: ThemeId): BlockTheme {
  return BLOCK_THEMES.find((t) => t.id === id) ?? BLOCK_THEMES[0];
}

export function isThemeUnlocked(theme: BlockTheme, lifetimeCollected: number): boolean {
  return lifetimeCollected >= theme.unlockAt;
}
