// Pure Block Puzzle (8x8 "Block Blast" style) game logic — no React.

export const GRID_SIZE = 8;

export type Shape = [number, number][]; // [row, col] offsets, normalized to min 0

export interface BoardCell {
  filled: boolean;
  // Index into the active theme's color palette (see blockPuzzleThemes.ts),
  // not a literal color — this is what lets a theme swap re-skin every cell
  // already on the board instantly, with no data migration.
  colorIndex: number;
  special: boolean;
}

export type Board = BoardCell[][];

// Palette size only — the actual hex colors live per-theme in
// blockPuzzleThemes.ts. Kept here because piece generation needs to know how
// many indices exist.
export const PALETTE_SIZE = 6;

// Chance a freshly generated piece carries one collectible ("paw print") cell.
const SPECIAL_CHANCE = 0.15;

export function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ filled: false, colorIndex: -1, special: false }))
  );
}

export function shapeSize(shape: Shape): { rows: number; cols: number } {
  const rows = Math.max(...shape.map(([r]) => r)) + 1;
  const cols = Math.max(...shape.map(([, c]) => c)) + 1;
  return { rows, cols };
}

export function canPlace(board: Board, shape: Shape, originRow: number, originCol: number): boolean {
  for (const [dr, dc] of shape) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    if (board[r][c].filled) return false;
  }
  return true;
}

export function canPlaceAnywhere(board: Board, shape: Shape): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlace(board, shape, r, c)) return true;
    }
  }
  return false;
}

export function placeShape(
  board: Board,
  shape: Shape,
  originRow: number,
  originCol: number,
  colorIndex: number,
  specialCellIndex: number | null
): Board {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  shape.forEach(([dr, dc], i) => {
    const r = originRow + dr;
    const c = originCol + dc;
    next[r][c] = { filled: true, colorIndex, special: i === specialCellIndex };
  });
  return next;
}

export interface ClearedCell {
  row: number;
  col: number;
  colorIndex: number;
}

export interface ClearResult {
  board: Board;
  rowsCleared: number[];
  colsCleared: number[];
  specialCollected: number;
  // Exact board position of every collected special cell, for placing a
  // "+1" float effect precisely; and every cleared cell in general, for
  // spawning clear-burst particles at the right spot.
  specialCollectedCells: { row: number; col: number }[];
  clearedCells: ClearedCell[];
}

export function findAndClearLines(board: Board): ClearResult {
  const rowsCleared: number[] = [];
  const colsCleared: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r].every((cell) => cell.filled)) rowsCleared.push(r);
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (board.every((row) => row[c].filled)) colsCleared.push(c);
  }
  if (rowsCleared.length === 0 && colsCleared.length === 0) {
    return { board, rowsCleared, colsCleared, specialCollected: 0, specialCollectedCells: [], clearedCells: [] };
  }

  let specialCollected = 0;
  const specialCollectedCells: { row: number; col: number }[] = [];
  const clearedCells: ClearedCell[] = [];
  const next = board.map((row, r) =>
    row.map((cell, c) => {
      const cleared = rowsCleared.includes(r) || colsCleared.includes(c);
      if (cleared && cell.filled) {
        clearedCells.push({ row: r, col: c, colorIndex: cell.colorIndex });
        if (cell.special) {
          specialCollected++;
          specialCollectedCells.push({ row: r, col: c });
        }
        return { filled: false, colorIndex: -1, special: false };
      }
      return cell;
    })
  );
  return { board: next, rowsCleared, colsCleared, specialCollected, specialCollectedCells, clearedCells };
}

export function countEmpty(board: Board): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (!cell.filled) n++;
  return n;
}

export function placementScore(shape: Shape): number {
  return shape.length;
}

// Multi-line clears get an escalating bonus, and consecutive clearing
// placements (combo) multiply the whole thing.
export function clearScore(linesCleared: number, combo: number): number {
  if (linesCleared === 0) return 0;
  const base = linesCleared * GRID_SIZE * 10;
  const multiBonus = 1 + (linesCleared - 1) * 0.5;
  return Math.round(base * multiBonus * combo);
}

// ─── Shape library ──────────────────────────────────────────────────────────
// One representative per shape family; every rotation is expanded below so
// pieces never need in-game rotation (per spec — rotation is a future
// power-up, not a base mechanic).

function rotateShape(shape: Shape): Shape {
  const rotated: Shape = shape.map(([r, c]) => [c, -r]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}

function shapeKey(shape: Shape): string {
  return [...shape]
    .map(([r, c]) => `${r},${c}`)
    .sort()
    .join('|');
}

function allRotations(shape: Shape): Shape[] {
  const out: Shape[] = [];
  const seen = new Set<string>();
  let cur = shape;
  for (let i = 0; i < 4; i++) {
    const key = shapeKey(cur);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cur);
    }
    cur = rotateShape(cur);
  }
  return out;
}

const BASE_SHAPES: Shape[] = [
  [[0, 0]], // dot
  [[0, 0], [0, 1]], // domino
  [[0, 0], [0, 1], [0, 2]], // tromino straight
  [[0, 0], [1, 0], [1, 1]], // tromino corner (small L)
  [[0, 0], [0, 1], [1, 0], [1, 1]], // 2x2 square
  [[0, 0], [0, 1], [0, 2], [0, 3]], // tetromino I
  [[0, 0], [1, 0], [2, 0], [2, 1]], // tetromino L
  [[0, 1], [1, 1], [2, 0], [2, 1]], // tetromino J
  [[0, 0], [0, 1], [0, 2], [1, 1]], // tetromino T
  [[0, 0], [0, 1], [1, 1], [1, 2]], // tetromino S
  [[0, 1], [0, 2], [1, 0], [1, 1]], // tetromino Z
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], // pentomino I
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], // 3x3 square
];

export const SHAPE_POOL: Shape[] = BASE_SHAPES.flatMap(allRotations);

function pieceWeight(shape: Shape, emptyCount: number): number {
  const n = shape.length;
  let w = n <= 2 ? 4 : n <= 4 ? 3 : 1.5;
  if (n >= 5) {
    if (emptyCount < 16) w *= 0.15;
    else if (emptyCount < 28) w *= 0.4;
  }
  return w;
}

function pickWeightedShape(emptyCount: number): Shape {
  const weights = SHAPE_POOL.map((s) => pieceWeight(s, emptyCount));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SHAPE_POOL.length; i++) {
    r -= weights[i];
    if (r <= 0) return SHAPE_POOL[i];
  }
  return SHAPE_POOL[SHAPE_POOL.length - 1];
}

export interface Piece {
  id: string;
  shape: Shape;
  colorIndex: number;
  specialCellIndex: number | null;
}

export function generatePiece(board: Board): Piece {
  const emptyCount = countEmpty(board);
  const shape = pickWeightedShape(emptyCount);
  const colorIndex = Math.floor(Math.random() * PALETTE_SIZE);
  const specialCellIndex = Math.random() < SPECIAL_CHANCE ? Math.floor(Math.random() * shape.length) : null;
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, shape, colorIndex, specialCellIndex };
}

export function isGameOver(board: Board, pieces: (Piece | null)[]): boolean {
  return pieces.every((p) => p === null || !canPlaceAnywhere(board, p.shape));
}
