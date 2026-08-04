import { loadProgress, saveProgress, subscribe as onProgressChange } from './progress';
import { loadCurriculum, saveCurriculum, subscribe as onCurriculumChange } from './curriculum';
import type { ProgressMap } from './types';
import type { CurriculumMap } from './curriculum';

// Cross-device sync for the two pieces of state that make up "英文字卡學習
// 進度": flashcard progress and the weekly curriculum plan. Last-write-wins
// by timestamp — simple on purpose, since this app has one learner, not
// multiple accounts negotiating conflicts.

const UPDATED_AT_KEY = 'sync_updated_at';
const PUSH_DEBOUNCE_MS = 1500;

interface SyncState {
  progress: ProgressMap;
  curriculum: CurriculumMap;
  updatedAt: number;
}

function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.updatedAt === 'number' && typeof v.progress === 'object' && typeof v.curriculum === 'object';
}

function getLocalUpdatedAt(): number {
  const raw = localStorage.getItem(UPDATED_AT_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function setLocalUpdatedAt(ts: number): void {
  localStorage.setItem(UPDATED_AT_KEY, String(ts));
}

// Set while a server snapshot is being written back into localStorage, so
// the onChange listeners below don't turn right around and push that same
// snapshot back up to the server.
let applyingRemote = false;

function applyServerState(state: SyncState): void {
  applyingRemote = true;
  try {
    saveProgress(state.progress);
    saveCurriculum(state.curriculum);
    setLocalUpdatedAt(state.updatedAt);
  } finally {
    applyingRemote = false;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushNow(): Promise<void> {
  const updatedAt = Date.now();
  const body: SyncState = { progress: loadProgress(), curriculum: loadCurriculum(), updatedAt };
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const result = (await res.json()) as unknown;
    if (isSyncState(result) && result.updatedAt > updatedAt) {
      // Another device's push won the race — adopt its version instead.
      applyServerState(result);
    } else {
      setLocalUpdatedAt(updatedAt);
    }
  } catch {
    // Offline or KV unavailable — keep working locally, try again next change.
  }
}

function schedulePush(): void {
  if (applyingRemote) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
}

let started = false;

// Called once at app startup: pulls the latest shared state and applies it
// if it's newer than what's on this device, otherwise pushes this device's
// current state up. Also wires up push-on-change for later edits.
export function startSync(): void {
  if (started) return;
  started = true;

  onProgressChange(schedulePush);
  onCurriculumChange(schedulePush);

  (async () => {
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) return;
      const server = (await res.json()) as unknown;
      const localUpdatedAt = getLocalUpdatedAt();
      if (isSyncState(server) && server.updatedAt > localUpdatedAt) {
        applyServerState(server);
      } else {
        await pushNow();
      }
    } catch {
      // Offline or KV unavailable — the app still works fully from localStorage.
    }
  })();
}
