export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const COLUMN_LABELS = ['A', 'B', 'C', 'D'];

export interface GridPosition {
  col: number;
  row: number;
}

export function formatCoordinate(pos: GridPosition): string {
  return `${COLUMN_LABELS[pos.col]}${pos.row + 1}`;
}

export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

export function cellKey(pos: GridPosition): string {
  return `${pos.col},${pos.row}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks a random grid cell that isn't already in `used` (so each hidden
// word in a hunt gets its own distinct cell).
function randomUnusedPosition(used: GridPosition[]): GridPosition {
  let pos: GridPosition;
  do {
    pos = { col: Math.floor(Math.random() * GRID_COLS), row: Math.floor(Math.random() * GRID_ROWS) };
  } while (used.some((p) => samePosition(p, pos)));
  return pos;
}

// Hides each word of the sentence at its own random cell, with no
// prescribed order — the child digs blindly (like a memory game) and
// whatever order they discover words in is unrelated to the sentence's
// real word order, so building the sentence afterward is a real puzzle.
export function buildWordMap(wordCount: number): Map<string, number> {
  const usedPositions: GridPosition[] = [];
  const map = new Map<string, number>();
  for (let i = 0; i < wordCount; i++) {
    const pos = randomUnusedPosition(usedPositions);
    usedPositions.push(pos);
    map.set(cellKey(pos), i);
  }
  return map;
}

// Reverses a word map (cell -> word index) into (word index -> cell), so a
// coordinate hint can be looked up for whichever word is currently targeted.
export function positionsByWordIndex(wordMap: Map<string, number>): Map<number, GridPosition> {
  const result = new Map<number, GridPosition>();
  for (const [key, wordIndex] of wordMap) {
    const [col, row] = key.split(',').map(Number);
    result.set(wordIndex, { col, row });
  }
  return result;
}
