import { useSyncExternalStore } from 'react';
import { BUILTIN_SENTENCES, type GameSentence } from '@/data/gameSentences';

const STORAGE_KEY = 'custom_game_sentences';
const DISABLED_KEY = 'disabled_builtin_sentence_ids';

const EMPTY: GameSentence[] = [];
const EMPTY_IDS: string[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedCustom: GameSentence[] = EMPTY;
let cachedDisabledRaw: string | null = null;
let cachedDisabled: string[] = EMPTY_IDS;

function readStorage(): GameSentence[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedCustom;
  cachedRaw = raw;
  try {
    cachedCustom = raw ? (JSON.parse(raw) as GameSentence[]) : EMPTY;
  } catch {
    cachedCustom = EMPTY;
  }
  return cachedCustom;
}

function readDisabled(): string[] {
  const raw = localStorage.getItem(DISABLED_KEY);
  if (raw === cachedDisabledRaw) return cachedDisabled;
  cachedDisabledRaw = raw;
  try {
    cachedDisabled = raw ? (JSON.parse(raw) as string[]) : EMPTY_IDS;
  } catch {
    cachedDisabled = EMPTY_IDS;
  }
  return cachedDisabled;
}

function getSnapshot(): GameSentence[] {
  return readStorage();
}

function getServerSnapshot(): GameSentence[] {
  return EMPTY;
}

function getDisabledSnapshot(): string[] {
  return readDisabled();
}

function getDisabledServerSnapshot(): string[] {
  return EMPTY_IDS;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function useCustomSentences(): GameSentence[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDisabledBuiltinIds(): string[] {
  return useSyncExternalStore(subscribe, getDisabledSnapshot, getDisabledServerSnapshot);
}

function loadCustom(): GameSentence[] {
  if (typeof window === 'undefined') return EMPTY;
  return readStorage();
}

function saveCustom(entries: GameSentence[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
}

export function addCustomSentence(en: string, zh: string): void {
  const trimmedEn = en.trim();
  const words = trimmedEn.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;
  const entry: GameSentence = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    en: trimmedEn,
    zh: zh.trim(),
    words,
  };
  const fresh = loadCustom();
  saveCustom([...fresh, entry]);
}

export function removeCustomSentence(id: string): void {
  const fresh = loadCustom();
  saveCustom(fresh.filter((s) => s.id !== id));
}

function saveDisabled(ids: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISABLED_KEY, JSON.stringify(ids));
  notify();
}

export function toggleBuiltinSentence(id: string): void {
  const current = readDisabled();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  saveDisabled(next);
}

export function enableAllBuiltinSentences(): void {
  saveDisabled(EMPTY_IDS);
}

// All sentences available to the game: built-in sentences the parent hasn't
// turned off, plus anything added via the settings page. Falls back to the
// full built-in set if a parent accidentally disables everything, so the
// game pool is never empty.
export function useAllSentences(): GameSentence[] {
  const custom = useCustomSentences();
  const disabledIds = useDisabledBuiltinIds();
  const activeBuiltin =
    disabledIds.length === 0 ? BUILTIN_SENTENCES : BUILTIN_SENTENCES.filter((s) => !disabledIds.includes(s.id));
  const combined = [...activeBuiltin, ...custom];
  return combined.length > 0 ? combined : BUILTIN_SENTENCES;
}
