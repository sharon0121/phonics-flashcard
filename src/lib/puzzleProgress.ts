// Tracks the highest difficulty stars earned per photo (1–5).
// Key: photo src string. Value: star count (1–5). Missing = not yet completed.
const KEY = 'puzzle_photo_stars';

type Listener = () => void;
const listeners: Listener[] = [];

export function loadPhotoStars(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function savePhotoStars(data: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(data));
  listeners.forEach(fn => fn());
}

// Only updates if the new star count is higher than what was previously saved.
export function markPhotoCompleted(src: string, stars: number): void {
  const data = loadPhotoStars();
  if ((data[src] ?? 0) < stars) {
    data[src] = stars;
    savePhotoStars(data);
  }
}

export function subscribePuzzle(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
