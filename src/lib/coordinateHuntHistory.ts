const MAX_ENTRIES = 10;

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

function boardKey(termCount: number, timeLimit: number): string {
  return `coord_hunt_speed_${termCount}x${timeLimit}`;
}

export function getLeaderboard(termCount: number, timeLimit: number): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(boardKey(termCount, timeLimit));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

export function qualifiesForLeaderboard(score: number, termCount: number, timeLimit: number): boolean {
  if (score <= 0) return false;
  const board = getLeaderboard(termCount, timeLimit);
  if (board.length < MAX_ENTRIES) return true;
  return score > board[board.length - 1].score;
}

export function addToLeaderboard(
  name: string,
  score: number,
  termCount: number,
  timeLimit: number,
): LeaderboardEntry[] {
  const board = getLeaderboard(termCount, timeLimit);
  const entry: LeaderboardEntry = {
    name: name.trim() || '匿名挑戰者',
    score,
    date: new Date().toLocaleDateString('zh-TW'),
  };
  const updated = [...board, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(boardKey(termCount, timeLimit), JSON.stringify(updated));
  return updated;
}
