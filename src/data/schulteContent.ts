export type SchulteCategory = 'zhuyin' | 'upper' | 'lower' | 'numbers';

// Full 注音符號 set in the standard recitation order (ㄅㄆㄇㄈ...ㄦ).
export const ZHUYIN_SYMBOLS = [
  'ㄅ', 'ㄆ', 'ㄇ', 'ㄈ', 'ㄉ', 'ㄊ', 'ㄋ', 'ㄌ', 'ㄍ', 'ㄎ', 'ㄏ',
  'ㄐ', 'ㄑ', 'ㄒ', 'ㄓ', 'ㄔ', 'ㄕ', 'ㄖ', 'ㄗ', 'ㄘ', 'ㄙ',
  'ㄧ', 'ㄨ', 'ㄩ',
  'ㄚ', 'ㄛ', 'ㄜ', 'ㄝ', 'ㄞ', 'ㄟ', 'ㄠ', 'ㄡ', 'ㄢ', 'ㄣ', 'ㄤ', 'ㄥ', 'ㄦ',
];

export const UPPER_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
export const LOWER_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

export const CATEGORY_LABELS: Record<SchulteCategory, string> = {
  zhuyin: '注音符號',
  upper: '大寫英文',
  lower: '小寫英文',
  numbers: '數字',
};

export const CATEGORY_EMOJI: Record<SchulteCategory, string> = {
  zhuyin: '㊣',
  upper: '🔤',
  lower: '🔡',
  numbers: '🔢',
};

export const CATEGORY_DISPLAY_ORDER: SchulteCategory[] = ['zhuyin', 'upper', 'lower', 'numbers'];

// Numbers always fill exactly one 5x5 grid (25 items) — no batching, and a
// choice of patterns so it's not always the same "count up from 1" drill.
export const NUMBER_GRID_DIM = 5;
const NUMBER_ITEM_COUNT = NUMBER_GRID_DIM * NUMBER_GRID_DIM;

export type NumberPattern = 'sequential' | 'odd' | 'even' | 'multiplesOf5';

export const NUMBER_PATTERN_LABELS: Record<NumberPattern, string> = {
  sequential: '順序 1-25',
  odd: '奇數練習',
  even: '偶數練習',
  multiplesOf5: '5 的倍數',
};

export const NUMBER_PATTERN_DISPLAY_ORDER: NumberPattern[] = ['sequential', 'odd', 'even', 'multiplesOf5'];

export function numberItemsForPattern(pattern: NumberPattern): string[] {
  const step = pattern === 'sequential' ? 1 : pattern === 'multiplesOf5' ? 5 : 2;
  const start = pattern === 'sequential' ? 1 : pattern === 'even' ? 2 : pattern === 'odd' ? 1 : 5;
  return Array.from({ length: NUMBER_ITEM_COUNT }, (_, i) => String(start + i * step));
}

// Returns the full ordered item list for a category — numbers needs a
// pattern since it has no single fixed sequence like the other categories.
export function itemsForCategory(category: SchulteCategory, numberPattern: NumberPattern): string[] {
  if (category === 'zhuyin') return ZHUYIN_SYMBOLS;
  if (category === 'upper') return UPPER_LETTERS;
  if (category === 'lower') return LOWER_LETTERS;
  return numberItemsForPattern(numberPattern);
}
