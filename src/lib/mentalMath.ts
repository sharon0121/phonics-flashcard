import { useSyncExternalStore } from 'react';

const START_DATE_KEY = 'mental_math_start_date';

export interface MentalMathDayInfo {
  day: number;
  termCount: 3 | 4;
}

// Stable placeholder used for the server-rendered pass (and the client's
// first hydration pass) so there's no localStorage-vs-server mismatch —
// the same trick useProgress/useCurriculum use for their EMPTY snapshots.
const SERVER_SNAPSHOT: MentalMathDayInfo = { day: 1, termCount: 3 };

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getTermCountForDay(day: number): 3 | 4 {
  return day <= 10 ? 3 : 4;
}

// The first time this runs, today is stamped as day 1 and never changes
// again. Every later call measures elapsed days from that fixed start
// date, so the 3-口 -> 4-口 progression advances by the calendar (day 11
// onward), not by how many rounds have actually been played.
function computeDayInfo(): MentalMathDayInfo {
  const existing = localStorage.getItem(START_DATE_KEY);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!existing) {
    localStorage.setItem(START_DATE_KEY, formatDateKey(today));
    return { day: 1, termCount: getTermCountForDay(1) };
  }
  const start = parseDateKey(existing);
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86400000);
  const day = Math.max(1, diffDays + 1);
  return { day, termCount: getTermCountForDay(day) };
}

let cachedSnapshot: MentalMathDayInfo | null = null;

function getSnapshot(): MentalMathDayInfo {
  if (!cachedSnapshot) cachedSnapshot = computeDayInfo();
  return cachedSnapshot;
}

function getServerSnapshot(): MentalMathDayInfo {
  return SERVER_SNAPSHOT;
}

// The day number only advances with real calendar time, not with any event
// this session could observe, so there is nothing to actively subscribe to.
function subscribe(): () => void {
  return () => {};
}

export function useMentalMathDayInfo(): MentalMathDayInfo {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
