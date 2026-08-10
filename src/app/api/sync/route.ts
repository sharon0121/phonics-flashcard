import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { ProgressMap } from '@/lib/types';
import type { CurriculumMap } from '@/lib/curriculum';
import type { HanziWord } from '@/lib/hanziWords';

// Single shared record — this app has one family/one learner, not
// multiple accounts, so there's no per-user keying or auth to manage.
const KEY = 'phonics_sync_state';

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

export async function GET() {
  const state = await kv.get(KEY);
  return NextResponse.json(state ?? null);
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;
  if (!isSyncState(body)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  // Last-write-wins by timestamp — if another device already pushed
  // something newer while this request was in flight, keep that instead
  // and hand it back so the caller can adopt it.
  const existing = await kv.get(KEY);
  if (isSyncState(existing) && existing.updatedAt > body.updatedAt) {
    return NextResponse.json(existing);
  }

  await kv.set(KEY, body);
  return NextResponse.json(body);
}
