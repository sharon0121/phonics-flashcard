import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { ProgressMap } from '@/lib/types';
import type { CurriculumMap } from '@/lib/curriculum';
import type { HanziWord } from '@/lib/hanziWords';

// Keyed by "sync code" so multiple people can share this platform without
// sharing progress — each code is its own isolated record. Before codes
// existed, everyone shared this single legacy key; it's migrated on demand
// into the 'sharon' code below so the original learner's history isn't lost.
const LEGACY_KEY = 'phonics_sync_state';
const LEGACY_MIGRATION_CODE = 'sharon';
const MAX_CODE_LENGTH = 64;

function keyFor(code: string): string {
  return `phonics_sync_state:${code}`;
}

function normalizeCode(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (!code || code.length > MAX_CODE_LENGTH) return null;
  return code;
}

interface SyncState {
  progress: ProgressMap;
  curriculum: CurriculumMap;
  hanziWords?: HanziWord[];
  klotskiProgress?: Record<string, unknown>;
  klotskiItemsUsed?: number;
  puzzlePhotoStars?: Record<string, number>;
  updatedAt: number;
}

function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.updatedAt === 'number' && typeof v.progress === 'object' && typeof v.curriculum === 'object';
}

async function readState(code: string): Promise<SyncState | null> {
  const state = await kv.get(keyFor(code));
  if (isSyncState(state)) return state;

  // One-time lazy migration: the first time anyone asks for the 'sharon'
  // code and it has no data of its own yet, adopt the pre-code legacy blob.
  if (code === LEGACY_MIGRATION_CODE) {
    const legacy = await kv.get(LEGACY_KEY);
    if (isSyncState(legacy)) {
      await kv.set(keyFor(code), legacy);
      return legacy;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get('code'));
  if (!code) {
    return NextResponse.json({ error: 'missing code' }, { status: 400 });
  }
  const state = await readState(code);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get('code'));
  if (!code) {
    return NextResponse.json({ error: 'missing code' }, { status: 400 });
  }

  const body = (await request.json()) as unknown;
  if (!isSyncState(body)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  // Last-write-wins by timestamp — if another device already pushed
  // something newer while this request was in flight, keep that instead
  // and hand it back so the caller can adopt it.
  const existing = await readState(code);
  if (existing && existing.updatedAt > body.updatedAt) {
    return NextResponse.json(existing);
  }

  await kv.set(keyFor(code), body);
  return NextResponse.json(body);
}
