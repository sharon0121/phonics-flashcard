import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'hanzi_words';

export interface HanziWord {
  id: string;
  char: string;
  // true = still being practiced (shows up in the quiz pool); false =
  // the parent unchecked it because the child already knows it well, so
  // it's excluded from quizzes without being deleted.
  needsPractice: boolean;
  addedAt: string;
}

const listeners = new Set<() => void>();

// Cache the last-seen raw string and its parsed result so the snapshot
// function returns a stable reference when nothing has changed —
// useSyncExternalStore requires this or it re-renders in a loop.
let cachedRaw: string | null = null;
let cachedWords: HanziWord[] = [];

function readStorage(): HanziWord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedWords;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedWords = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedWords = [];
  }
  return cachedWords;
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function loadHanziWords(): HanziWord[] {
  return readStorage();
}

export function saveHanziWords(words: HanziWord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  cachedRaw = JSON.stringify(words);
  cachedWords = words;
  notify();
}

interface AddResult {
  ok: boolean;
  error?: string;
}

export function addHanziWord(char: string): AddResult {
  const trimmed = char.trim();
  if (!trimmed) return { ok: false, error: '請輸入文字' };
  if (trimmed.length > 6) return { ok: false, error: '請輸入 6 個字以內' };
  const existing = loadHanziWords();
  if (existing.some((w) => w.char === trimmed)) return { ok: false, error: '這個字已經新增過了' };
  const newWord: HanziWord = {
    id: `hanzi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    char: trimmed,
    needsPractice: true,
    addedAt: new Date().toISOString().slice(0, 10),
  };
  saveHanziWords([...existing, newWord]);
  return { ok: true };
}

export function removeHanziWord(id: string): void {
  saveHanziWords(loadHanziWords().filter((w) => w.id !== id));
}

export function toggleHanziNeedsPractice(id: string): void {
  const updated = loadHanziWords().map((w) => (w.id === id ? { ...w, needsPractice: !w.needsPractice } : w));
  saveHanziWords(updated);
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useHanziWords(): HanziWord[] {
  return useSyncExternalStore(subscribe, readStorage, () => []);
}
