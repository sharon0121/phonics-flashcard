export interface Word {
  id: string;
  word: string;
  kk: string;          // KK phonetics e.g. "/kæt/"
  zh: string;          // Traditional Chinese e.g. "貓"
  zhuyin: string;      // Zhuyin phonetics e.g. "ㄇㄠ"
  en: string;          // Simple English definition, max 10 words
  emoji: string;       // Single emoji
  phase: number;       // 1-6
  phaseLabel: string;  // "Phase 1: Short Vowels"
  subPhase: string;    // "Short A (æ)"
  subPhaseKey: string; // "short-a"
  category: string;    // "animal"|"action"|"adjective"|"noun"
  highlight: string;   // Pattern to highlight e.g. "a", "sh", "a_e"
}

export interface ProgressEntry {
  canPronounce: boolean;
  canUnderstand: boolean;
  learnedDate: string;
}

export type ProgressMap = Record<string, ProgressEntry>;
