// The "sync code" is what partitions the shared /api/sync KV store into
// separate progress spaces, so multiple people (Sharon + colleagues) can use
// this platform without seeing or overwriting each other's learning
// progress. A device that already has real local progress from before this
// feature existed defaults to the original owner's code so nothing is lost;
// a brand new device/browser gets a random code so it starts isolated.

import { useSyncExternalStore } from 'react';

const SYNC_CODE_STORAGE_KEY = 'sync_code';
export const DEFAULT_OWNER_CODE = 'sharon';

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function readSyncCode(): string | null {
  const raw = localStorage.getItem(SYNC_CODE_STORAGE_KEY);
  cachedRaw = raw;
  return raw;
}

// Reactive read for display in the control panel — updates automatically
// after switchSyncCode()/startFreshWithNewCode() call notify() via
// persistSyncCode(), without a manual setState-in-effect.
export function useSyncCode(): string | null {
  return useSyncExternalStore(subscribe, readSyncCode, () => null);
}

export function normalizeSyncCode(code: string): string {
  return code.trim().toLowerCase();
}

export function getSyncCode(): string | null {
  return localStorage.getItem(SYNC_CODE_STORAGE_KEY);
}

export function persistSyncCode(code: string): string {
  const normalized = normalizeSyncCode(code);
  localStorage.setItem(SYNC_CODE_STORAGE_KEY, normalized);
  if (normalized !== cachedRaw) notify();
  return normalized;
}

export function generateRandomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

// Returns this device's sync code, assigning one on first use.
export function ensureSyncCode(looksLikeExistingDevice: boolean): string {
  const existing = getSyncCode();
  if (existing) return existing;
  return persistSyncCode(looksLikeExistingDevice ? DEFAULT_OWNER_CODE : generateRandomCode());
}
