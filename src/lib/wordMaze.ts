// '#' wall, '.' path (dot + maybe a letter), 'H' ghost house (ghosts only),
// 'D' the portal/ghost door (ghosts always pass; the player only once every
// letter is collected). Validated offline for full connectivity of '.' cells.
export const MAZE_LAYOUT: string[] = [
  '###############',
  '#.............#',
  '#.###.#.#.###.#',
  '#.............#',
  '#.##.#####.##.#',
  '#.............#',
  '###.##.#.##.###',
  '  #.#..#..#.#  ',
  '###.#.HHH.#.###',
  '  #.#.HHH.#.#  ',
  '###.#..D..#.###',
  '#.............#',
  '#.##.#####.##.#',
  '#.....#.......#',
  '#.###.#.###.#.#',
  '#.............#',
  '###############',
];

export const MAZE_ROWS = MAZE_LAYOUT.length;
export const MAZE_COLS = MAZE_LAYOUT[0].length;

export interface GridPos {
  row: number;
  col: number;
}

export const PLAYER_START: GridPos = { row: 13, col: 7 };
// 10 distinct starting cells (the house's 6 cells plus 4 open corridor
// spots) so up to 10 ghosts can each get their own spawn point.
export const GHOST_STARTS: GridPos[] = [
  { row: 8, col: 6 },
  { row: 8, col: 8 },
  { row: 9, col: 6 },
  { row: 9, col: 8 },
  { row: 8, col: 7 },
  { row: 9, col: 7 },
  { row: 11, col: 7 },
  { row: 5, col: 7 },
  { row: 3, col: 7 },
  { row: 1, col: 1 },
];
export const PORTAL_POS: GridPos = { row: 10, col: 7 };

type CellType = 'wall' | 'path' | 'house' | 'door';

export function cellTypeAt(row: number, col: number): CellType {
  const ch = MAZE_LAYOUT[row]?.[col] ?? '#';
  if (ch === 'H') return 'house';
  if (ch === 'D') return 'door';
  if (ch === '.') return 'path';
  return 'wall';
}

export function isWalkableForGhost(row: number, col: number): boolean {
  return cellTypeAt(row, col) !== 'wall';
}

export function isWalkableForPlayer(row: number, col: number, portalOpen: boolean): boolean {
  const t = cellTypeAt(row, col);
  if (t === 'wall' || t === 'house') return false;
  if (t === 'door') return portalOpen;
  return true;
}

export function samePos(a: GridPos, b: GridPos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function cellKey(pos: GridPos): string {
  return `${pos.row},${pos.col}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function allPathCells(): GridPos[] {
  const cells: GridPos[] = [];
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (cellTypeAt(r, c) === 'path') cells.push({ row: r, col: c });
    }
  }
  return cells;
}

// Hides each letter of the word at its own random path cell (duplicate
// letters like the two P's in APPLE each get a distinct cell).
export function placeLetters(word: string, excluding: GridPos[]): Map<string, string> {
  const eligible = allPathCells().filter((cell) => !excluding.some((e) => samePos(e, cell)));
  const shuffled = shuffle(eligible);
  const map = new Map<string, string>();
  word
    .toUpperCase()
    .split('')
    .forEach((letter, i) => {
      map.set(cellKey(shuffled[i]), letter);
    });
  return map;
}

type Direction = 'north' | 'south' | 'left' | 'right';

const DIRS: { dr: number; dc: number; name: Direction }[] = [
  { dr: -1, dc: 0, name: 'north' },
  { dr: 1, dc: 0, name: 'south' },
  { dr: 0, dc: -1, name: 'left' },
  { dr: 0, dc: 1, name: 'right' },
];

const REVERSE_OF: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  left: 'right',
  right: 'left',
};

// In tunnel mode, when a player move lands on a boundary wall, return the
// matching exit cell on the opposite edge of the same row/column.
export function tunnelExitFor(row: number, col: number, dr: number, dc: number): GridPos | null {
  if (dc === -1 && col === 0) {
    for (let c = MAZE_COLS - 1; c >= 0; c--) if (cellTypeAt(row, c) === 'path') return { row, col: c };
  } else if (dc === 1 && col === MAZE_COLS - 1) {
    for (let c = 0; c < MAZE_COLS; c++) if (cellTypeAt(row, c) === 'path') return { row, col: c };
  } else if (dr === -1 && row === 0) {
    for (let r = MAZE_ROWS - 1; r >= 0; r--) if (cellTypeAt(r, col) === 'path') return { row: r, col };
  } else if (dr === 1 && row === MAZE_ROWS - 1) {
    for (let r = 0; r < MAZE_ROWS; r++) if (cellTypeAt(r, col) === 'path') return { row: r, col };
  }
  return null;
}

// Gentle random-walk ghost AI: picks a random open neighbor, avoiding an
// immediate U-turn unless it's the only option (dead end). Passing `target`
// with a `chaseChance` makes the ghost occasionally pick the neighbor that
// most reduces its distance to the target instead of a random one — used to
// give extra ghosts (3rd/4th) a bit more bite than the original two.
export function ghostStep(
  pos: GridPos,
  lastDir: Direction | null,
  target?: GridPos,
  chaseChance = 0,
): { pos: GridPos; dir: Direction } {
  const options = DIRS.filter((d) => isWalkableForGhost(pos.row + d.dr, pos.col + d.dc));
  if (options.length === 0) return { pos, dir: lastDir ?? 'south' };
  const nonReverse = lastDir ? options.filter((d) => d.name !== REVERSE_OF[lastDir]) : options;
  const pool = nonReverse.length > 0 ? nonReverse : options;

  if (target && chaseChance > 0 && Math.random() < chaseChance) {
    let best = pool[0];
    let bestDist = Infinity;
    for (const d of pool) {
      const nr = pos.row + d.dr;
      const nc = pos.col + d.dc;
      const dist = Math.abs(nr - target.row) + Math.abs(nc - target.col);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return { pos: { row: pos.row + best.dr, col: pos.col + best.dc }, dir: best.name };
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { pos: { row: pos.row + pick.dr, col: pos.col + pick.dc }, dir: pick.name };
}
