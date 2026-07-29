export interface MazeWord {
  word: string;
  zh: string;
  emoji: string;
}

// All 5 letters long, so the maze always hides exactly 5 letters and the
// puzzle phase always has exactly 5 blanks — keeps both phases consistent.
export const MAZE_WORDS: MazeWord[] = [
  { word: 'APPLE', zh: '蘋果', emoji: '🍎' },
  { word: 'GRAPE', zh: '葡萄', emoji: '🍇' },
  { word: 'LEMON', zh: '檸檬', emoji: '🍋' },
  { word: 'BREAD', zh: '麵包', emoji: '🍞' },
  { word: 'PIZZA', zh: '披薩', emoji: '🍕' },
  { word: 'SHEEP', zh: '綿羊', emoji: '🐑' },
  { word: 'HORSE', zh: '馬', emoji: '🐴' },
  { word: 'TIGER', zh: '老虎', emoji: '🐯' },
  { word: 'HAPPY', zh: '開心', emoji: '😀' },
  { word: 'CLOCK', zh: '時鐘', emoji: '🕐' },
  { word: 'CHAIR', zh: '椅子', emoji: '🪑' },
  { word: 'PLANT', zh: '植物', emoji: '🌱' },
];
