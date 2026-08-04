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

export function numberItems(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

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

// Returns the full ordered item list for a category — numbers needs the
// configured count since it has no fixed natural length like the others.
export function itemsForCategory(category: SchulteCategory, numberCount: number): string[] {
  if (category === 'zhuyin') return ZHUYIN_SYMBOLS;
  if (category === 'upper') return UPPER_LETTERS;
  if (category === 'lower') return LOWER_LETTERS;
  return numberItems(numberCount);
}
