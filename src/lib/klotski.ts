// Core Klotski (華容道) board model + BFS solver, shared by the game engine
// (for live hint / full-solution computation from whatever position the
// child is currently in) and by the offline level-generation script.
//
// Board convention: 4 columns x 5 rows. Caocao (2x2) wins by reaching
// row=WIN_ROW, col=EXIT_COL (occupying rows WIN_ROW..WIN_ROW+1, cols
// EXIT_COL..EXIT_COL+1). Every move slides one piece exactly one cell.

export const BOARD_COLS = 4;
export const BOARD_ROWS = 5;
export const EXIT_COL = 1;
export const WIN_ROW = 3;

export type PieceType = 'caocao' | 'horizontal' | 'vertical' | 'soldier';
export type Difficulty = 'easy' | 'medium' | 'hard';

export const SHAPES: Record<PieceType, { w: number; h: number }> = {
  caocao: { w: 2, h: 2 },
  horizontal: { w: 2, h: 1 },
  vertical: { w: 1, h: 2 },
  soldier: { w: 1, h: 1 },
};

export interface PieceDef {
  id: string;
  type: PieceType;
  row: number;
  col: number;
  label?: string;
  emoji?: string;
}

export interface Move {
  pieceId: string;
  dr: number;
  dc: number;
}

export interface SolveResult {
  solvable: boolean;
  minSteps: number;
  path: Move[];
  statesExplored: number;
}

const DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export function buildOccupancy(pieces: PieceDef[]): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  for (const p of pieces) {
    const { w, h } = SHAPES[p.type];
    for (let r = p.row; r < p.row + h; r++) {
      for (let c = p.col; c < p.col + w; c++) {
        grid[r][c] = p.id;
      }
    }
  }
  return grid;
}

export function validateLevel(pieces: PieceDef[]): string[] {
  const errors: string[] = [];
  const grid: (string | null)[][] = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const caocaoCount = pieces.filter((p) => p.type === 'caocao').length;
  if (caocaoCount !== 1) errors.push(`Expected exactly 1 caocao piece, found ${caocaoCount}`);
  for (const p of pieces) {
    const { w, h } = SHAPES[p.type];
    if (p.row < 0 || p.col < 0 || p.row + h > BOARD_ROWS || p.col + w > BOARD_COLS) {
      errors.push(`Piece ${p.id} out of bounds: row=${p.row} col=${p.col} type=${p.type}`);
      continue;
    }
    for (let r = p.row; r < p.row + h; r++) {
      for (let c = p.col; c < p.col + w; c++) {
        if (grid[r][c] !== null) errors.push(`Overlap at (${r},${c}) between ${grid[r][c]} and ${p.id}`);
        grid[r][c] = p.id;
      }
    }
  }
  return errors;
}

export function canonicalKey(pieces: PieceDef[]): string {
  const grouped = new Map<string, [number, number][]>();
  for (const p of pieces) {
    const arr = grouped.get(p.type) ?? [];
    arr.push([p.row, p.col]);
    grouped.set(p.type, arr);
  }
  const parts: string[] = [];
  for (const type of [...grouped.keys()].sort()) {
    const positions = grouped.get(type)!.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    parts.push(type + ':' + positions.map(([r, c]) => `${r},${c}`).join(';'));
  }
  return parts.join('|');
}

export function canPlace(grid: (string | null)[][], piece: PieceDef, nr: number, nc: number): boolean {
  const { w, h } = SHAPES[piece.type];
  if (nr < 0 || nc < 0 || nr + h > BOARD_ROWS || nc + w > BOARD_COLS) return false;
  for (let r = nr; r < nr + h; r++) {
    for (let c = nc; c < nc + w; c++) {
      const occupant = grid[r][c];
      if (occupant !== null && occupant !== piece.id) return false;
    }
  }
  return true;
}

export function isSolved(pieces: PieceDef[]): boolean {
  const caocao = pieces.find((p) => p.type === 'caocao');
  return !!caocao && caocao.row === WIN_ROW && caocao.col === EXIT_COL;
}

// Legal single-step directions for one piece from the current board.
export function legalMovesForPiece(pieces: PieceDef[], pieceId: string): Move[] {
  const grid = buildOccupancy(pieces);
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  const moves: Move[] = [];
  for (const [dr, dc] of DIRS) {
    if (canPlace(grid, piece, piece.row + dr, piece.col + dc)) moves.push({ pieceId, dr, dc });
  }
  return moves;
}

export function applyMove(pieces: PieceDef[], move: Move): PieceDef[] {
  return pieces.map((p) => (p.id === move.pieceId ? { ...p, row: p.row + move.dr, col: p.col + move.dc } : p));
}

export function solve(pieces: PieceDef[], maxStates = 300000): SolveResult {
  const start = pieces.map((p) => ({ ...p }));
  if (isSolved(start)) return { solvable: true, minSteps: 0, path: [], statesExplored: 1 };
  const startKey = canonicalKey(start);
  const visited = new Set<string>([startKey]);
  const queue: { state: PieceDef[]; path: Move[] }[] = [{ state: start, path: [] }];
  let head = 0;
  while (head < queue.length) {
    const { state, path } = queue[head++];
    if (queue.length > maxStates) return { solvable: false, minSteps: -1, path: [], statesExplored: head };
    const grid = buildOccupancy(state);
    for (const piece of state) {
      for (const [dr, dc] of DIRS) {
        const nr = piece.row + dr;
        const nc = piece.col + dc;
        if (!canPlace(grid, piece, nr, nc)) continue;
        const nextState = state.map((p) => (p.id === piece.id ? { ...p, row: nr, col: nc } : p));
        const nextPath = [...path, { pieceId: piece.id, dr, dc }];
        if (isSolved(nextState)) return { solvable: true, minSteps: nextPath.length, path: nextPath, statesExplored: head };
        const key = canonicalKey(nextState);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ state: nextState, path: nextPath });
      }
    }
  }
  return { solvable: false, minSteps: -1, path: [], statesExplored: head };
}

// One generated/curated level: a starting arrangement plus its verified
// true minimum step count (used for the difficulty label and to gauge how
// "impressive" a given completion was, never as a target the child must
// match exactly).
export interface KlotskiLevel {
  id: string;
  difficulty: Difficulty;
  minSteps: number;
  pieces: PieceDef[];
}

export function difficultyRange(d: Difficulty): { min: number; max: number } {
  if (d === 'easy') return { min: 8, max: 25 };
  if (d === 'medium') return { min: 26, max: 45 };
  return { min: 46, max: 999 };
}
