import { loadProgress, saveProgress, subscribe as onProgressChange } from './progress';
import { loadCurriculum, saveCurriculum, subscribe as onCurriculumChange } from './curriculum';
import { loadHanziWords, saveHanziWords, subscribe as onHanziWordsChange, type HanziWord } from './hanziWords';
import {
  loadKlotskiProgress, saveKlotskiProgress,
  loadKlotskiItemsUsed, saveKlotskiItemsUsed,
  subscribeKlotski,
  type KlotskiLevelProgress,
} from './klotskiProgress';
import { loadPhotoStars, savePhotoStars, subscribePuzzle } from './puzzleProgress';
import type { ProgressMap } from './types';
import type { CurriculumMap } from './curriculum';
import { ensureSyncCode, persistSyncCode, generateRandomCode } from './syncCode';

// Cross-device sync for the pieces of state meant to follow the learner
// across devices: flashcard progress, the weekly curriculum plan, and the
// custom 國字 word list. Scoped by "sync code" (see syncCode.ts) so
// different people's progress doesn't mix. Last-write-wins by timestamp
// within a given code — simple on purpose, since each code has one learner,
// not multiple accounts negotiating conflicts.

const UPDATED_AT_KEY = 'sync_updated_at';
const PUSH_DEBOUNCE_MS = 1500;

interface SyncState {
  progress: ProgressMap;
  curriculum: CurriculumMap;
  hanziWords?: HanziWord[];
  klotskiProgress?: Record<string, KlotskiLevelProgress>;
  klotskiItemsUsed?: number;
  puzzlePhotoStars?: Record<string, number>;
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

function emptySyncState(): SyncState {
  return { progress: {}, curriculum: {}, hanziWords: [], klotskiProgress: {}, klotskiItemsUsed: 0, puzzlePhotoStars: {}, updatedAt: Date.now() };
}

function hasAnyLocalData(): boolean {
  return (
    Object.keys(loadProgress()).length > 0 ||
    Object.keys(loadCurriculum()).length > 0 ||
    loadHanziWords().length > 0 ||
    Object.keys(loadKlotskiProgress()).length > 0 ||
    Object.keys(loadPhotoStars()).length > 0
  );
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
    saveHanziWords(state.hanziWords ?? []);
    if (state.klotskiProgress) saveKlotskiProgress(state.klotskiProgress);
    if (state.klotskiItemsUsed !== undefined) saveKlotskiItemsUsed(state.klotskiItemsUsed);
    if (state.puzzlePhotoStars) savePhotoStars(state.puzzlePhotoStars);
    setLocalUpdatedAt(state.updatedAt);
  } finally {
    applyingRemote = false;
  }
}

let activeCode: string | null = null;

function syncUrl(code: string): string {
  return `/api/sync?code=${encodeURIComponent(code)}`;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushNow(): Promise<void> {
  if (!activeCode) return;
  const updatedAt = Date.now();
  const body: SyncState = {
    progress: loadProgress(),
    curriculum: loadCurriculum(),
    hanziWords: loadHanziWords(),
    klotskiProgress: loadKlotskiProgress(),
    klotskiItemsUsed: loadKlotskiItemsUsed(),
    puzzlePhotoStars: loadPhotoStars(),
    updatedAt,
  };
  try {
    const res = await fetch(syncUrl(activeCode), {
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

// Pulls the given code's cloud state and decides whether to adopt it or
// push this device's current state up, based on which side actually has
// real data — not just timestamps (a device with no history yet, or one
// that just switched codes, always starts at "no local updatedAt", which
// would otherwise unfairly lose to any existing record). Used both for a
// device's very first sync and whenever the sync code is switched.
async function runInitialSyncForCode(code: string): Promise<void> {
  try {
    const res = await fetch(syncUrl(code));
    if (!res.ok) return;
    const server = (await res.json()) as unknown;
    const serverHasData =
      isSyncState(server) &&
      (Object.keys(server.progress).length > 0 ||
        Object.keys(server.curriculum).length > 0 ||
        (server.hanziWords?.length ?? 0) > 0);

    const localHasData = hasAnyLocalData();
    if (localHasData && !serverHasData) {
      await pushNow();
    } else if (isSyncState(server) && serverHasData) {
      applyServerState(server);
    } else {
      await pushNow();
    }
  } catch {
    // Offline or KV unavailable — the app still works fully from localStorage.
  }
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
  onHanziWordsChange(schedulePush);
  subscribeKlotski(schedulePush);
  subscribePuzzle(schedulePush);

  const looksLikeExistingDevice = localStorage.getItem(UPDATED_AT_KEY) !== null || hasAnyLocalData();
  activeCode = ensureSyncCode(looksLikeExistingDevice);

  (async () => {
    if (localStorage.getItem(UPDATED_AT_KEY) === null) {
      await runInitialSyncForCode(activeCode!);
      return;
    }
    try {
      const res = await fetch(syncUrl(activeCode!));
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

// Called from the sync code control panel when the user types in a
// different code to join — treated like a fresh device's first sync
// against that code, so joining an empty/new code pushes this device's
// data up, and joining an already-used code pulls its data down.
export async function switchSyncCode(rawCode: string): Promise<string> {
  const normalized = persistSyncCode(rawCode);
  activeCode = normalized;
  localStorage.removeItem(UPDATED_AT_KEY);
  await runInitialSyncForCode(normalized);
  return normalized;
}

// Wipes this device's local progress and starts a brand new, private code —
// for a colleague who wants their own independent space from scratch rather
// than joining someone else's code.
export async function startFreshWithNewCode(): Promise<string> {
  applyServerState(emptySyncState());
  localStorage.removeItem(UPDATED_AT_KEY);
  const newCode = generateRandomCode();
  persistSyncCode(newCode);
  activeCode = newCode;
  await runInitialSyncForCode(newCode);
  return newCode;
}
