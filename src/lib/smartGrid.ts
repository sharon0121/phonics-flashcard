// 聰明格 (Smart Grid) — a KenKen-style addition puzzle. An N×N grid is filled
// with 1..N so every row/column contains each number exactly once (a Latin
// square), and the grid is divided into irregular "cages" of 1-3 cells; each
// cage's top-left cell shows the sum every cell inside it must add up to.

export type SmartGridSize = 3 | 4 | 5;
export type SmartGridDifficulty = 'easy' | 'medium' | 'hard';

export interface SmartGridDifficultyConfig {
  size: SmartGridSize;
  minCage: number;
  maxCage: number;
  // [cageSize, weight] pairs — controls how often each size is picked.
  sizeWeights: [number, number][];
  // Hard cap on how many 1-cell cages a single puzzle may contain.
  maxSingleCages: number;
  label: string;
}

// Easy keeps hints to 1-2 cells, strongly favoring 2 so a puzzle rarely has
// more than one "free" single-cell giveaway. Medium widens to 1-3. Hard drops
// single-cell cages entirely (min 2) and allows up to 4.
export const SMART_GRID_DIFFICULTY: Record<SmartGridDifficulty, SmartGridDifficultyConfig> = {
  easy: { size: 3, minCage: 1, maxCage: 2, sizeWeights: [[1, 1], [2, 8]], maxSingleCages: 2, label: '簡單' },
  medium: { size: 4, minCage: 1, maxCage: 3, sizeWeights: [[1, 1], [2, 2], [3, 1]], maxSingleCages: Infinity, label: '中等' },
  hard: { size: 5, minCage: 2, maxCage: 4, sizeWeights: [[2, 1], [3, 2], [4, 1]], maxSingleCages: 0, label: '困難' },
};
export const SMART_GRID_DIFFICULTIES: SmartGridDifficulty[] = ['easy', 'medium', 'hard'];

export interface SmartGridCage {
  id: number;
  cells: [number, number][]; // [row, col] pairs
  sum: number;
}

export interface SmartGridPuzzle {
  n: SmartGridSize;
  solution: number[][];
  cageId: number[][]; // cageId[row][col]
  cages: SmartGridCage[];
}

// A puzzle baked into the pre-generated level bank (src/data/smartGridLevels.ts).
export interface SmartGridLevel extends SmartGridPuzzle {
  id: string;
  difficulty: SmartGridDifficulty;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

// Cyclic base square, then shuffle rows, shuffle columns, and relabel values —
// each step preserves the Latin-square property, giving decent variety
// without needing a full backtracking generator.
function generateLatinSquare(n: number): number[][] {
  const base = range(n).map((r) => range(n).map((c) => ((r + c) % n) + 1));
  const rowOrder = shuffle(range(n));
  const colOrder = shuffle(range(n));
  const valuePerm = shuffle(range(n)).map((v) => v + 1);
  return rowOrder.map((r) => colOrder.map((c) => valuePerm[base[r][c] - 1]));
}

function weightedPick(weights: [number, number][]): number {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, w] of weights) {
    if (r < w) return value;
    r -= w;
  }
  return weights[weights.length - 1][0];
}

const NEIGHBOR_DELTAS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

// Flood-fill growth can strand an isolated cell as a size-1 cage even when
// minSize > 1 (every neighbor already claimed). Sweep those into a
// neighboring cage so every cage actually respects the requested minimum.
function mergeUndersizedCages(n: number, cageId: number[][], minSize: number): void {
  let changed = true;
  while (changed) {
    changed = false;
    const cellsByCage = new Map<number, [number, number][]>();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = cageId[r][c];
        if (!cellsByCage.has(id)) cellsByCage.set(id, []);
        cellsByCage.get(id)!.push([r, c]);
      }
    }
    for (const [id, cells] of cellsByCage) {
      if (cells.length >= minSize) continue;
      let targetId: number | null = null;
      for (const [r, c] of cells) {
        for (const [dr, dc] of NEIGHBOR_DELTAS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && cageId[nr][nc] !== id) {
            targetId = cageId[nr][nc];
            break;
          }
        }
        if (targetId !== null) break;
      }
      if (targetId === null) continue;
      for (const [r, c] of cells) cageId[r][c] = targetId;
      changed = true;
      break;
    }
  }
}

// Excess 1-cell cages beyond the difficulty's cap get folded into a
// neighboring cage — same mechanic as mergeUndersizedCages, just targeted at
// specific singles rather than every cage under a size floor.
function capSingleCellCages(n: number, cageId: number[][], maxSingles: number): void {
  function findSingleCageIds(): number[] {
    const counts = new Map<number, number>();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) counts.set(cageId[r][c], (counts.get(cageId[r][c]) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, count]) => count === 1).map(([id]) => id);
  }

  let singles = findSingleCageIds();
  while (singles.length > maxSingles) {
    const id = singles[0];
    let cellR = -1;
    let cellC = -1;
    for (let r = 0; r < n && cellR === -1; r++) {
      for (let c = 0; c < n; c++) {
        if (cageId[r][c] === id) { cellR = r; cellC = c; break; }
      }
    }
    let targetId: number | null = null;
    for (const [dr, dc] of NEIGHBOR_DELTAS) {
      const nr = cellR + dr;
      const nc = cellC + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && cageId[nr][nc] !== id) {
        targetId = cageId[nr][nc];
        break;
      }
    }
    if (targetId === null) break; // isolated whole-grid edge case, shouldn't happen for n>=2
    cageId[cellR][cellC] = targetId;
    singles = findSingleCageIds();
  }
}

function generateCageIds(n: number, config: SmartGridDifficultyConfig): number[][] {
  const { minCage, maxCage, sizeWeights, maxSingleCages } = config;
  const cageId: number[][] = range(n).map(() => Array(n).fill(-1));
  const cellOrder = shuffle(range(n).flatMap((r) => range(n).map((c): [number, number] => [r, c])));

  let nextId = 0;
  for (const [r, c] of cellOrder) {
    if (cageId[r][c] !== -1) continue;
    const cageCells: [number, number][] = [[r, c]];
    cageId[r][c] = nextId;
    const targetSize = weightedPick(sizeWeights);

    while (cageCells.length < targetSize) {
      const candidates: [number, number][] = [];
      for (const [cr, cc] of cageCells) {
        for (const [dr, dc] of NEIGHBOR_DELTAS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && cageId[nr][nc] === -1) {
            candidates.push([nr, nc]);
          }
        }
      }
      if (candidates.length === 0) break;
      const [pr, pc] = candidates[Math.floor(Math.random() * candidates.length)];
      cageId[pr][pc] = nextId;
      cageCells.push([pr, pc]);
    }
    nextId++;
  }

  if (minCage > 1) mergeUndersizedCages(n, cageId, minCage);
  if (Number.isFinite(maxSingleCages)) capSingleCellCages(n, cageId, maxSingleCages);
  return cageId;
}

export function generateSmartGridPuzzle(n: SmartGridSize, config: SmartGridDifficultyConfig): SmartGridPuzzle {
  const solution = generateLatinSquare(n);
  const cageId = generateCageIds(n, config);

  const cellsByCage = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = cageId[r][c];
      if (!cellsByCage.has(id)) cellsByCage.set(id, []);
      cellsByCage.get(id)!.push([r, c]);
    }
  }

  const cages: SmartGridCage[] = Array.from(cellsByCage.entries()).map(([id, cells]) => ({
    id,
    cells,
    sum: cells.reduce((s, [r, c]) => s + solution[r][c], 0),
  }));

  return { n, solution, cageId, cages };
}

export function emptyFillGrid(n: SmartGridSize): number[][] {
  return range(n).map(() => Array(n).fill(0));
}

// Per-cell flag: true if this cell's value duplicates another in its row or column.
export function findConflicts(n: SmartGridSize, fill: number[][]): boolean[][] {
  const conflict: boolean[][] = range(n).map(() => Array(n).fill(false));

  for (let r = 0; r < n; r++) {
    const colsByValue = new Map<number, number[]>();
    for (let c = 0; c < n; c++) {
      const v = fill[r][c];
      if (v === 0) continue;
      if (!colsByValue.has(v)) colsByValue.set(v, []);
      colsByValue.get(v)!.push(c);
    }
    for (const cols of colsByValue.values()) {
      if (cols.length > 1) for (const c of cols) conflict[r][c] = true;
    }
  }

  for (let c = 0; c < n; c++) {
    const rowsByValue = new Map<number, number[]>();
    for (let r = 0; r < n; r++) {
      const v = fill[r][c];
      if (v === 0) continue;
      if (!rowsByValue.has(v)) rowsByValue.set(v, []);
      rowsByValue.get(v)!.push(r);
    }
    for (const rows of rowsByValue.values()) {
      if (rows.length > 1) for (const r of rows) conflict[r][c] = true;
    }
  }

  return conflict;
}

export type CageStatus = 'incomplete' | 'ok' | 'bad';

export function cageStatuses(puzzle: SmartGridPuzzle, fill: number[][]): Map<number, CageStatus> {
  const status = new Map<number, CageStatus>();
  for (const cage of puzzle.cages) {
    const values = cage.cells.map(([r, c]) => fill[r][c]);
    if (values.some((v) => v === 0)) {
      status.set(cage.id, 'incomplete');
      continue;
    }
    const sum = values.reduce((a, b) => a + b, 0);
    status.set(cage.id, sum === cage.sum ? 'ok' : 'bad');
  }
  return status;
}

export function isPuzzleSolved(puzzle: SmartGridPuzzle, fill: number[][]): boolean {
  const { n } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (fill[r][c] === 0) return false;
    }
  }
  const conflicts = findConflicts(n, fill);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (conflicts[r][c]) return false;
    }
  }
  const statuses = cageStatuses(puzzle, fill);
  for (const status of statuses.values()) {
    if (status !== 'ok') return false;
  }
  return true;
}

// Backtracking solution counter — used offline by the level generator to
// reject ambiguous puzzles before they're baked into the shipped level bank.
// Stops as soon as `cap` solutions are found (only need to know 1 vs >1).
export function countSolutions(puzzle: SmartGridPuzzle, cap: number): number {
  const { n, cageId, cages } = puzzle;
  const cageTarget = new Map(cages.map((c) => [c.id, c.sum]));
  const cageSize = new Map(cages.map((c) => [c.id, c.cells.length]));
  const cagePartial = new Map(cages.map((c) => [c.id, 0]));
  const cageFilled = new Map(cages.map((c) => [c.id, 0]));
  const rowUsed: boolean[][] = range(n).map(() => Array(n + 1).fill(false));
  const colUsed: boolean[][] = range(n).map(() => Array(n + 1).fill(false));
  const cells: [number, number][] = range(n).flatMap((r) => range(n).map((c): [number, number] => [r, c]));

  let count = 0;

  function backtrack(idx: number): void {
    if (count >= cap) return;
    if (idx === cells.length) {
      count++;
      return;
    }
    const [r, c] = cells[idx];
    const id = cageId[r][c];
    const target = cageTarget.get(id)!;
    const size = cageSize.get(id)!;
    for (let v = 1; v <= n; v++) {
      if (rowUsed[r][v] || colUsed[c][v]) continue;
      const partial = cagePartial.get(id)! + v;
      const filled = cageFilled.get(id)! + 1;
      if (filled === size && partial !== target) continue;
      if (filled < size && partial >= target) continue; // remaining cells need >=1 each
      rowUsed[r][v] = true;
      colUsed[c][v] = true;
      cagePartial.set(id, partial);
      cageFilled.set(id, filled);
      backtrack(idx + 1);
      rowUsed[r][v] = false;
      colUsed[c][v] = false;
      cagePartial.set(id, partial - v);
      cageFilled.set(id, filled - 1);
      if (count >= cap) return;
    }
  }

  backtrack(0);
  return count;
}
