// Pure Puyo Puyo game logic (no React)

export const COLS = 6;
export const ROWS = 13; // 0-11 visible, 12 = hidden spawn/death row
export const VISIBLE_ROWS = 12;

export enum PuyoType {
  NONE = 0,
  RED = 1,
  BLUE = 2,
  GREEN = 3,
  YELLOW = 4,
  GARBAGE = 5,
}

export type Grid = PuyoType[][];

export interface PuyoPair {
  centerRow: number; // 0 = bottom
  centerCol: number;
  centerType: PuyoType;
  subType: PuyoType;
  rotation: 0 | 1 | 2 | 3;
  // 0=sub above center, 1=sub right, 2=sub below center, 3=sub left
}

export interface PuyoGameState {
  grid: Grid;
  current: PuyoPair | null;
  nextPairs: [PuyoType, PuyoType][];
  score: number;
  chain: number;
  maxChain: number;
  garbagePending: number;
  garbageReceived: number;
  allClear: boolean;
  phase: 'spawning' | 'falling' | 'locking' | 'chain' | 'over' | 'paused';
}

export const PUYO_COLORS: Record<PuyoType, string> = {
  [PuyoType.NONE]: 'transparent',
  [PuyoType.RED]: '#ef4444',
  [PuyoType.BLUE]: '#3b82f6',
  [PuyoType.GREEN]: '#22c55e',
  [PuyoType.YELLOW]: '#eab308',
  [PuyoType.GARBAGE]: '#94a3b8',
};

export function emptyGrid(): Grid {
  const grid: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill(PuyoType.NONE));
  }
  return grid;
}

const COLOR_TYPES = [PuyoType.RED, PuyoType.BLUE, PuyoType.GREEN, PuyoType.YELLOW];

export function newPair(): [PuyoType, PuyoType] {
  const a = COLOR_TYPES[Math.floor(Math.random() * COLOR_TYPES.length)];
  const b = COLOR_TYPES[Math.floor(Math.random() * COLOR_TYPES.length)];
  return [a, b];
}

// rot 0 = sub above center (row+1), 1 = sub right (col+1), 2 = sub below (row-1), 3 = sub left (col-1)
export function getSubPos(
  centerRow: number,
  centerCol: number,
  rotation: 0 | 1 | 2 | 3
): [number, number] {
  switch (rotation) {
    case 0: return [centerRow + 1, centerCol];
    case 1: return [centerRow, centerCol + 1];
    case 2: return [centerRow - 1, centerCol];
    case 3: return [centerRow, centerCol - 1];
  }
}

export function canPlace(grid: Grid, row: number, col: number): boolean {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0 || col >= COLS) return false;
  return grid[row][col] === PuyoType.NONE;
}

export function rotatePair(
  grid: Grid,
  pair: PuyoPair,
  dir: 1 | -1
): PuyoPair | null {
  let newRot = ((pair.rotation + dir + 4) % 4) as 0 | 1 | 2 | 3;
  let newCenterRow = pair.centerRow;
  let newCenterCol = pair.centerCol;

  const [subRow, subCol] = getSubPos(newCenterRow, newCenterCol, newRot);

  // Wall kick: sub out of horizontal bounds
  let kickedSubRow = subRow;
  let kickedSubCol = subCol;
  let kickedCenterRow = newCenterRow;
  let kickedCenterCol = newCenterCol;

  if (subCol < 0) {
    kickedCenterCol = newCenterCol + 1;
    const [ks, kc] = getSubPos(kickedCenterRow, kickedCenterCol, newRot);
    kickedSubRow = ks;
    kickedSubCol = kc;
  } else if (subCol >= COLS) {
    kickedCenterCol = newCenterCol - 1;
    const [ks, kc] = getSubPos(kickedCenterRow, kickedCenterCol, newRot);
    kickedSubRow = ks;
    kickedSubCol = kc;
  }

  // Floor kick: sub below row 0
  if (kickedSubRow < 0) {
    // Force rotation to 0 (sub above center)
    newRot = 0;
    kickedCenterRow = newCenterRow;
    kickedCenterCol = newCenterCol;
    const [ks, kc] = getSubPos(kickedCenterRow, kickedCenterCol, newRot);
    kickedSubRow = ks;
    kickedSubCol = kc;
  }

  // Check both positions are free
  if (!canPlace(grid, kickedCenterRow, kickedCenterCol)) return null;
  if (!canPlace(grid, kickedSubRow, kickedSubCol)) return null;

  return {
    ...pair,
    centerRow: kickedCenterRow,
    centerCol: kickedCenterCol,
    rotation: newRot,
  };
}

export function movePair(
  grid: Grid,
  pair: PuyoPair,
  dcol: number
): PuyoPair | null {
  const newCenterCol = pair.centerCol + dcol;
  const newCenterRow = pair.centerRow;
  const [subRow, subCol] = getSubPos(newCenterRow, newCenterCol, pair.rotation);

  if (!canPlace(grid, newCenterRow, newCenterCol)) return null;
  if (!canPlace(grid, subRow, subCol)) return null;

  return { ...pair, centerCol: newCenterCol };
}

export function dropPair(
  grid: Grid,
  pair: PuyoPair
): PuyoPair | null {
  const newCenterRow = pair.centerRow - 1;
  const [subRow, subCol] = getSubPos(newCenterRow, pair.centerCol, pair.rotation);

  if (!canPlace(grid, newCenterRow, pair.centerCol)) return null;
  if (!canPlace(grid, subRow, subCol)) return null;

  return { ...pair, centerRow: newCenterRow };
}

export function hardDropPair(
  grid: Grid,
  pair: PuyoPair
): { pair: PuyoPair; dropped: number } {
  let current = pair;
  let dropped = 0;

  while (true) {
    const next = dropPair(grid, current);
    if (next === null) break;
    current = next;
    dropped++;
  }

  return { pair: current, dropped };
}

export function lockPair(grid: Grid, pair: PuyoPair): Grid {
  const newGrid: Grid = grid.map((row) => [...row]);
  const [subRow, subCol] = getSubPos(pair.centerRow, pair.centerCol, pair.rotation);

  // Place sub
  if (subRow >= 0 && subRow < ROWS && subCol >= 0 && subCol < COLS) {
    newGrid[subRow][subCol] = pair.subType;
  }

  // Place center
  if (
    pair.centerRow >= 0 &&
    pair.centerRow < ROWS &&
    pair.centerCol >= 0 &&
    pair.centerCol < COLS
  ) {
    newGrid[pair.centerRow][pair.centerCol] = pair.centerType;
  }

  return applyGravity(newGrid);
}

export function applyGravity(grid: Grid): Grid {
  const newGrid: Grid = emptyGrid();

  for (let c = 0; c < COLS; c++) {
    const cells: PuyoType[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] !== PuyoType.NONE) {
        cells.push(grid[r][c]);
      }
    }
    // Pack to bottom
    for (let i = 0; i < cells.length; i++) {
      newGrid[i][c] = cells[i];
    }
  }

  return newGrid;
}

export function findClearGroups(grid: Grid): [number, number][][] {
  const visited: boolean[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(false)
  );
  const groups: [number, number][][] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === PuyoType.NONE || t === PuyoType.GARBAGE || visited[r][c]) continue;

      // BFS
      const group: [number, number][] = [];
      const queue: [number, number][] = [[r, c]];
      visited[r][c] = true;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        group.push([cr, cc]);

        const neighbors: [number, number][] = [
          [cr + 1, cc],
          [cr - 1, cc],
          [cr, cc + 1],
          [cr, cc - 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (
            nr >= 0 && nr < ROWS &&
            nc >= 0 && nc < COLS &&
            !visited[nr][nc] &&
            grid[nr][nc] === t
          ) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (group.length >= 4) {
        groups.push(group);
      }
    }
  }

  return groups;
}

export interface ClearStep {
  newGrid: Grid;
  clearedGroups: [number, number][][];
  garbageCleared: number;
  puyosCleared: number;
  colorCount: number;
  groupBonus: number;
}

function groupSizeBonus(size: number): number {
  if (size <= 4) return 0;
  if (size === 5) return 2;
  if (size === 6) return 3;
  if (size === 7) return 4;
  if (size === 8) return 5;
  if (size === 9) return 6;
  if (size === 10) return 7;
  return 10;
}

export function performClearStep(grid: Grid): ClearStep | null {
  const groups = findClearGroups(grid);
  if (groups.length === 0) return null;

  const toClear = new Set<string>();
  const garbageToClear = new Set<string>();

  const colorsCleared = new Set<PuyoType>();
  let puyosCleared = 0;
  let groupBonus = 0;

  for (const group of groups) {
    groupBonus += groupSizeBonus(group.length);
    for (const [r, c] of group) {
      toClear.add(`${r},${c}`);
      colorsCleared.add(grid[r][c]);
      puyosCleared++;
    }
  }

  // Find adjacent garbage
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    const neighbors: [number, number][] = [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (
        nr >= 0 && nr < ROWS &&
        nc >= 0 && nc < COLS &&
        grid[nr][nc] === PuyoType.GARBAGE
      ) {
        garbageToClear.add(`${nr},${nc}`);
      }
    }
  }

  const newGrid: Grid = grid.map((row) => [...row]);
  for (const key of toClear) {
    const [r, c] = key.split(',').map(Number);
    newGrid[r][c] = PuyoType.NONE;
  }
  for (const key of garbageToClear) {
    const [r, c] = key.split(',').map(Number);
    newGrid[r][c] = PuyoType.NONE;
  }

  return {
    newGrid,
    clearedGroups: groups,
    garbageCleared: garbageToClear.size,
    puyosCleared,
    colorCount: colorsCleared.size,
    groupBonus,
  };
}

const CHAIN_MULTIPLIERS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224];

function getChainMultiplier(chain: number): number {
  if (chain <= 1) return 0;
  if (chain - 1 < CHAIN_MULTIPLIERS.length) return CHAIN_MULTIPLIERS[chain - 1];
  return CHAIN_MULTIPLIERS[CHAIN_MULTIPLIERS.length - 1] + (chain - CHAIN_MULTIPLIERS.length) * 32;
}

const COLOR_BONUS = [0, 0, 3, 6, 12, 24];

export function calcChainScore(
  chain: number,
  puyosCleared: number,
  colorCount: number,
  groupBonus: number
): { score: number; nuisance: number } {
  const chainMult = getChainMultiplier(chain);
  const colorBonus = COLOR_BONUS[Math.min(colorCount, 5)] ?? 0;
  const bonus = Math.max(1, chainMult + colorBonus + groupBonus);
  const score = 10 * puyosCleared * bonus;
  const nuisance = Math.floor(score / 70);
  return { score, nuisance };
}

export function addGarbageLines(grid: Grid, lines: number): Grid {
  if (lines <= 0) return grid;
  const newGrid: Grid = grid.map((row) => [...row]);

  for (let i = 0; i < lines; i++) {
    // Shift everything up by 1
    for (let r = ROWS - 1; r > 0; r--) {
      newGrid[r] = [...newGrid[r - 1]];
    }
    // New bottom row: all GARBAGE except one random gap
    const gap = Math.floor(Math.random() * COLS);
    const newRow = new Array(COLS).fill(PuyoType.GARBAGE) as PuyoType[];
    newRow[gap] = PuyoType.NONE;
    newGrid[0] = newRow;
  }

  return newGrid;
}

export function isAllClear(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== PuyoType.NONE) return false;
    }
  }
  return true;
}

export function isDead(grid: Grid): boolean {
  // Death condition: top of column 2 (0-indexed) in the hidden row is occupied
  return grid[ROWS - 1][2] !== PuyoType.NONE;
}

export function initialPuyoState(): PuyoGameState {
  const nextPairs: [PuyoType, PuyoType][] = [newPair(), newPair(), newPair()];
  return {
    grid: emptyGrid(),
    current: null,
    nextPairs,
    score: 0,
    chain: 0,
    maxChain: 0,
    garbagePending: 0,
    garbageReceived: 0,
    allClear: false,
    phase: 'spawning',
  };
}
