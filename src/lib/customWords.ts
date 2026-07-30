import { useSyncExternalStore } from 'react';
import type { Word } from './types';

const STORAGE_KEY = 'custom-words';

const listeners = new Set<() => void>();

// Cache the last-seen raw string and its parsed result so the snapshot function
// returns a stable reference when nothing has changed. useSyncExternalStore
// relies on Object.is equality — returning a new array on every call would
// trigger an infinite re-render loop.
let cachedRaw: string | null = null;
let cachedWords: Word[] = [];

function readStorage(): Word[] {
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

function notify() {
  listeners.forEach((fn) => fn());
}

export function loadCustomWords(): Word[] {
  return readStorage();
}

function saveCustomWords(words: Word[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  notify();
}

export function addCustomWord(data: {
  word: string;
  zh: string;
  zhuyin?: string;
  kk?: string;
  en?: string;
  sentence?: string;
  sentenceZh?: string;
  emoji?: string;
}): Word {
  const existing = loadCustomWords();
  const id = `custom-${Date.now()}-${data.word.toLowerCase().replace(/\s+/g, '-')}`;
  const newWord: Word = {
    id,
    word: data.word.trim(),
    zh: data.zh.trim(),
    zhuyin: data.zhuyin?.trim() ?? '',
    kk: data.kk?.trim() ?? '',
    en: data.en?.trim() ?? '',
    sentence: data.sentence?.trim() ?? '',
    sentenceZh: data.sentenceZh?.trim() || undefined,
    emoji: data.emoji?.trim() ?? '📝',
    phase: 0,
    phaseLabel: '自訂單字',
    subPhase: '自訂',
    subPhaseKey: 'custom',
    category: 'custom',
    highlight: '',
  };
  saveCustomWords([...existing, newWord]);
  return newWord;
}

export function updateCustomWord(id: string, data: Partial<Omit<Word, 'id' | 'phase' | 'phaseLabel' | 'subPhase' | 'subPhaseKey' | 'category' | 'highlight'>>): void {
  const existing = loadCustomWords();
  const updated = existing.map((w) => (w.id === id ? { ...w, ...data } : w));
  saveCustomWords(updated);
}

export function deleteCustomWord(id: string): void {
  const existing = loadCustomWords();
  saveCustomWords(existing.filter((w) => w.id !== id));
}

export function getCustomWordById(id: string): Word | undefined {
  return loadCustomWords().find((w) => w.id === id);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCustomWords(): Word[] {
  return useSyncExternalStore(subscribe, loadCustomWords, () => []);
}
