// tetris.ts — Complete Tetris Guideline game logic (pure functions)
// Board: row 0 = top (hidden buffer). Visible rows = BUFFER_ROWS (20) to ROWS-1 (39).

// ─── Types ────────────────────────────────────────────────────────────────────

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type RotState = 0 | 1 | 2 | 3;
export type CellColor = string | null; // null = empty

export interface ActivePiece {
  type: PieceType;
  rot: RotState;
  row: number; // top-left row of bounding box in board coords
  col: number; // top-left col
}

export interface TetrisState {
  board: CellColor[][]; // [ROWS][COLS], row 0 = top
  current: ActivePiece;
  hold: PieceType | null;
  holdUsed: boolean;
  bag: PieceType[];       // remaining in current bag
  nextBag: PieceType[];   // next full bag (pre-generated)
  nextQueue: PieceType[]; // 5 pieces visible in next preview
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: boolean;     // last clear was difficult (Tetris or T-Spin)
  phase: 'playing' | 'over' | 'paused';
  // Lock delay state (managed outside but included for snapshot)
  lockResets: number;
  lowestRow: number; // lowest row current piece has reached (for lock reset counting)
  garbagePending: number; // lines of garbage about to come in
}

export interface ClearResult {
  scoreDelta: number;
  linesSent: number;
  newB2B: boolean;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLS = 10;
export const ROWS = 40;          // internal board height (rows 0–19 = hidden buffer, 20–39 = visible)
export const VISIBLE_ROWS = 20;
export const BUFFER_ROWS = 20;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const DAS_MS = 130;
export const ARR_MS = 16;        // 0 = instant; 16 ms ≈ one frame
export const SOFT_DROP_INTERVAL = 50;

// ─── Piece Shapes ─────────────────────────────────────────────────────────────
// Each rotation state is an array of [row, col] offsets within the bounding box.
// The bounding box is placed at (piece.row, piece.col) in board coordinates.
//
// I  uses a 4×4 bounding box.
// O  uses a 3×3 bounding box (consistent with SRS spawn/rotation center).
// J,L,S,T,Z use 3×3 bounding boxes.
//
// Rotations: 0 = spawn, 1 = CW, 2 = 180°, 3 = CCW.
// These follow the standard Tetris Guideline / SRS piece orientations.

export const PIECE_SHAPES: Record<PieceType, [number, number][][]> = {
  // ── I ──────────────────────────────────────────────────────────────────────
  // 4×4 bounding box
  // rot 0 (spawn): row 1, cols 0-3  →  .XXX. (standard guideline: row 1 of 4-row box)
  I: [
    // rot 0
    [[1, 0], [1, 1], [1, 2], [1, 3]],
    // rot 1 (CW)
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    // rot 2 (180°)
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    // rot 3 (CCW)
    [[0, 1], [1, 1], [2, 1], [3, 1]],
  ],

  // ── J ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box
  J: [
    // rot 0: X..  XXX  ...
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    // rot 1 (CW): XX  X.  X.
    [[0, 1], [0, 2], [1, 1], [2, 1]],
    // rot 2 (180°): ...  XXX  ..X
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    // rot 3 (CCW): .X  .X  XX
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ],

  // ── L ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box
  L: [
    // rot 0: ..X  XXX  ...
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    // rot 1 (CW): X.  X.  XX
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    // rot 2 (180°): ...  XXX  X..
    [[1, 0], [1, 1], [1, 2], [2, 0]],
    // rot 3 (CCW): XX  .X  .X
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],

  // ── O ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box; all rotations identical (O never kicks)
  O: [
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
  ],

  // ── S ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box
  S: [
    // rot 0: .XX  XX.  ...
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    // rot 1 (CW): X.  XX  .X
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    // rot 2 (180°): ...  .XX  XX.
    [[1, 1], [1, 2], [2, 0], [2, 1]],
    // rot 3 (CCW): X.  XX  .X
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],

  // ── T ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box
  T: [
    // rot 0: .X.  XXX  ...
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    // rot 1 (CW): X.  XX  X.
    [[0, 1], [1, 1], [1, 2], [2, 1]],
    // rot 2 (180°): ...  XXX  .X.
    [[1, 0], [1, 1], [1, 2], [2, 1]],
    // rot 3 (CCW): .X  XX  .X
    [[0, 1], [1, 0], [1, 1], [2, 1]],
  ],

  // ── Z ──────────────────────────────────────────────────────────────────────
  // 3×3 bounding box
  Z: [
    // rot 0: XX.  .XX  ...
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    // rot 1 (CW): .X  XX  X.
    [[0, 2], [1, 1], [1, 2], [2, 1]],
    // rot 2 (180°): ...  XX.  .XX
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    // rot 3 (CCW): .X  XX  X.
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
};

// ─── Colors ───────────────────────────────────────────────────────────────────

export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#00bcd4',
  J: '#1565c0',
  L: '#e65100',
  O: '#f9a825',
  S: '#2e7d32',
  T: '#6a1b9a',
  Z: '#c62828',
};

export const GHOST_COLOR = 'rgba(255,255,255,0.15)';
export const GARBAGE_COLOR = '#78909c';

// ─── SRS Kick Tables ──────────────────────────────────────────────────────────
// Key format: "${fromRot}-${toRot}"
// Offsets: [dcol, drow] where drow positive = DOWN.
//
// Source: Tetris wiki SRS tables (dcol, dy_up).
// Conversion: [dcol, drow] = [dcol, -dy_up]
//
// JLSTZ wiki values (dcol, dy_up):
//   0→1: (0,0)(-1,0)(-1,+1)(0,-2)(-1,-2)
//   1→0: (0,0)(+1,0)(+1,-1)(0,+2)(+1,+2)
//   1→2: (0,0)(+1,0)(+1,-1)(0,+2)(+1,+2)
//   2→1: (0,0)(-1,0)(-1,+1)(0,-2)(-1,-2)
//   2→3: (0,0)(+1,0)(+1,+1)(0,-2)(+1,-2)
//   3→2: (0,0)(-1,0)(-1,-1)(0,+2)(-1,+2)
//   3→0: (0,0)(-1,0)(-1,-1)(0,+2)(-1,+2)
//   0→3: (0,0)(+1,0)(+1,+1)(0,-2)(+1,-2)

export const SRS_KICKS_JLSTZ: Record<string, [number, number][]> = {
  '0-1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1-0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1-2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2-1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2-3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3-2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3-0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0-3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

// I wiki values (dcol, dy_up):
//   0→1: (0,0)(-2,0)(+1,0)(-2,-1)(+1,+2)
//   1→0: (0,0)(+2,0)(-1,0)(+2,+1)(-1,-2)
//   1→2: (0,0)(-1,0)(+2,0)(-1,+2)(+2,-1)
//   2→1: (0,0)(+1,0)(-2,0)(+1,-2)(-2,+1)
//   2→3: (0,0)(+2,0)(-1,0)(+2,+1)(-1,-2)
//   3→2: (0,0)(-2,0)(+1,0)(-2,-1)(+1,+2)
//   3→0: (0,0)(+1,0)(-2,0)(+1,-2)(-2,+1)
//   0→3: (0,0)(-1,0)(+2,0)(-1,+2)(+2,-1)

export const SRS_KICKS_I: Record<string, [number, number][]> = {
  '0-1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1-0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1-2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2-1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2-3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3-2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3-0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0-3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

// ─── Bag ──────────────────────────────────────────────────────────────────────

/** Generate a shuffled bag of all 7 piece types (Fisher-Yates). */
export function newBag(): PieceType[] {
  const bag: PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// ─── Board helpers ────────────────────────────────────────────────────────────

/** Create an empty board: ROWS rows × COLS cols, all null. */
export function emptyBoard(): CellColor[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

/** Deep-copy a board. */
function copyBoard(board: CellColor[][]): CellColor[][] {
  return board.map(row => [...row]);
}

// ─── Piece helpers ────────────────────────────────────────────────────────────

/**
 * Return all occupied cells of a piece in absolute board coordinates.
 * Each element is [boardRow, boardCol].
 */
export function getPieceCells(piece: ActivePiece): [number, number][] {
  const shape = PIECE_SHAPES[piece.type][piece.rot];
  return shape.map(([dr, dc]) => [piece.row + dr, piece.col + dc]);
}

/**
 * Check whether a piece position is valid:
 *  - Each cell must be within column bounds (0 ≤ col < COLS).
 *  - Each cell must not exceed the bottom of the board (row < ROWS).
 *  - Negative rows are allowed (piece partially above the buffer).
 *  - No overlap with already-locked cells.
 */
export function isValid(board: CellColor[][], piece: ActivePiece): boolean {
  const cells = getPieceCells(piece);
  for (const [r, c] of cells) {
    if (c < 0 || c >= COLS) return false;
    if (r >= ROWS) return false;
    // Only check board collision if the row is within the board
    if (r >= 0 && board[r][c] !== null) return false;
  }
  return true;
}

// ─── Rotation (SRS) ───────────────────────────────────────────────────────────

/**
 * Try to rotate a piece using SRS kick tables.
 * dir = 1 for CW, -1 for CCW.
 * Returns the new (kicked) piece if successful, or null if all kicks fail.
 */
export function trySRS(
  board: CellColor[][],
  piece: ActivePiece,
  dir: 1 | -1
): ActivePiece | null {
  const fromRot = piece.rot;
  const toRot = (((fromRot + dir) % 4) + 4) % 4 as RotState;
  const key = `${fromRot}-${toRot}`;

  const kicks =
    piece.type === 'I'
      ? SRS_KICKS_I[key]
      : SRS_KICKS_JLSTZ[key];

  if (!kicks) return null;

  for (const [dcol, drow] of kicks) {
    const candidate: ActivePiece = {
      ...piece,
      rot: toRot,
      col: piece.col + dcol,
      row: piece.row + drow,
    };
    if (isValid(board, candidate)) {
      return candidate;
    }
  }
  return null;
}

// ─── Movement ─────────────────────────────────────────────────────────────────

/**
 * Move piece horizontally by dcol columns.
 * Returns the moved piece if valid, or null if blocked.
 */
export function tryMove(
  board: CellColor[][],
  piece: ActivePiece,
  dcol: number
): ActivePiece | null {
  const candidate: ActivePiece = { ...piece, col: piece.col + dcol };
  return isValid(board, candidate) ? candidate : null;
}

/**
 * Move piece down by 1 row.
 * Returns the moved piece if valid, or null if blocked (floor or other piece).
 */
export function tryDrop(
  board: CellColor[][],
  piece: ActivePiece
): ActivePiece | null {
  const candidate: ActivePiece = { ...piece, row: piece.row + 1 };
  return isValid(board, candidate) ? candidate : null;
}

/**
 * Hard-drop: move piece down as far as possible.
 * Returns the piece at its lowest valid row and the distance dropped.
 */
export function hardDrop(
  board: CellColor[][],
  piece: ActivePiece
): { piece: ActivePiece; distance: number } {
  let current = piece;
  let distance = 0;
  while (true) {
    const next = tryDrop(board, current);
    if (!next) break;
    current = next;
    distance++;
  }
  return { piece: current, distance };
}

/**
 * Ghost piece: the position the piece would land if hard-dropped.
 */
export function getGhost(board: CellColor[][], piece: ActivePiece): ActivePiece {
  return hardDrop(board, piece).piece;
}

// ─── Locking ──────────────────────────────────────────────────────────────────

/**
 * Lock a piece onto the board.
 * Returns a new board with the piece's cells filled with the piece's color.
 */
export function lockPiece(board: CellColor[][], piece: ActivePiece): CellColor[][] {
  const newBoard = copyBoard(board);
  const color = PIECE_COLORS[piece.type];
  for (const [r, c] of getPieceCells(piece)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      newBoard[r][c] = color;
    }
  }
  return newBoard;
}

// ─── Line Clearing ────────────────────────────────────────────────────────────

/**
 * Scan for and clear full lines.
 * Returns a new board with cleared rows removed (blank rows inserted at top),
 * the count of lines cleared, and which row indices were cleared.
 */
export function clearLines(board: CellColor[][]): {
  board: CellColor[][];
  linesCleared: number;
  clearedRows: number[];
} {
  const clearedRows: number[] = [];
  const remaining: CellColor[][] = [];

  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== null)) {
      clearedRows.push(r);
    } else {
      remaining.push([...board[r]]);
    }
  }

  const linesCleared = clearedRows.length;
  // Prepend empty rows so total length stays ROWS
  const emptyRows = Array.from({ length: linesCleared }, () =>
    Array<CellColor>(COLS).fill(null)
  );
  const newBoard = [...emptyRows, ...remaining];

  return { board: newBoard, linesCleared, clearedRows };
}

// ─── T-Spin Detection ─────────────────────────────────────────────────────────

/**
 * Detect T-Spin (full) or T-Spin Mini using the standard 3-corner rule.
 *
 * The T piece's 3×3 bounding box has 4 diagonal corners at positions:
 *   (piece.row+0, piece.col+0), (piece.row+0, piece.col+2),
 *   (piece.row+2, piece.col+0), (piece.row+2, piece.col+2)
 *
 * A cell is "occupied" if it is out-of-bounds (wall/floor) or filled.
 *
 * Full T-Spin: 3 or more corners occupied.
 * T-Spin Mini: exactly 2 corners occupied, and the 2 that ARE occupied are the
 *   ones facing the T's "back" (the side with the stem pointing away).
 *
 * The T's "front" (head / pointing direction) by rotation:
 *   rot 0 (stem up):    front corners = bottom-left (2,0) and bottom-right (2,2)
 *   rot 1 (stem right): front corners = top-left    (0,0) and bottom-left  (2,0)
 *   rot 2 (stem down):  front corners = top-left    (0,0) and top-right    (0,2)
 *   rot 3 (stem left):  front corners = top-right   (0,2) and bottom-right (2,2)
 *
 * T-Spin Mini: last action was rotate, exactly 2 corners occupied,
 *   and BOTH front corners are occupied (the 2 back corners are not).
 *   Actually: mini means 3+ corners BUT the 2 front corners are NOT both occupied.
 *
 * Standard implementation (Tetris wiki):
 *   Count all 4 corners that are occupied.
 *   If occupied < 3 → no t-spin.
 *   If occupied >= 3:
 *     If both "front" corners occupied → full T-Spin.
 *     Else → T-Spin Mini.
 */
export function detectTSpin(
  board: CellColor[][],
  piece: ActivePiece,
  lastAction: 'rotate' | 'other'
): 'tspin' | 'tspin-mini' | null {
  if (piece.type !== 'T') return null;
  if (lastAction !== 'rotate') return null;

  const r = piece.row;
  const c = piece.col;

  // Corner positions: [row offset, col offset]
  const cornerOffsets: [number, number][] = [
    [0, 0], [0, 2],
    [2, 0], [2, 2],
  ];

  function isOccupied(row: number, col: number): boolean {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true; // wall
    return board[row][col] !== null;
  }

  const cornerOccupied = cornerOffsets.map(([dr, dc]) =>
    isOccupied(r + dr, c + dc)
  );
  // cornerOccupied[0] = (0,0), [1] = (0,2), [2] = (2,0), [3] = (2,2)

  const occupiedCount = cornerOccupied.filter(Boolean).length;

  if (occupiedCount < 3) return null;

  // Front corner indices by rotation:
  // rot 0 (head up, stem at row1): head points up → front = top row corners
  //   Standard: T's head direction from rot 0 is UP (the bump at row 0, col 1)
  //   Front corners = top-left (0,0)=idx0 and top-right (0,2)=idx1
  // rot 1 (head right): front = top-right (0,2)=idx1 and bottom-right (2,2)=idx3
  // rot 2 (head down): front = bottom-left (2,0)=idx2 and bottom-right (2,2)=idx3
  // rot 3 (head left): front = top-left (0,0)=idx0 and bottom-left (2,0)=idx2

  const frontCornersByRot: [number, number][] = [
    [0, 1], // rot 0: indices 0,1 = (0,0),(0,2)
    [1, 3], // rot 1: indices 1,3 = (0,2),(2,2)
    [2, 3], // rot 2: indices 2,3 = (2,0),(2,2)
    [0, 2], // rot 3: indices 0,2 = (0,0),(2,0)
  ];

  const [fi1, fi2] = frontCornersByRot[piece.rot];
  const bothFrontOccupied = cornerOccupied[fi1] && cornerOccupied[fi2];

  if (bothFrontOccupied) {
    return 'tspin';
  } else {
    return 'tspin-mini';
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
//
// Tetris Guideline scoring:
//   Single:     100 × level
//   Double:     300 × level
//   Triple:     500 × level
//   Tetris:     800 × level
//   T-Spin 0:   400 × level
//   T-Spin 1:   800 × level
//   T-Spin 2:  1200 × level
//   T-Spin 3:  1600 × level
//   T-Spin Mini 0: 100 × level
//   T-Spin Mini 1: 200 × level
//   T-Spin Mini 2: 400 × level
//   B2B bonus: 1.5× (multiply by 1.5, add 50% to base)
//   Combo:     50 × combo × level  (combo starts at 1 after the first consecutive clear)
//
// "Difficult" clears (start/continue B2B): Tetris (4 lines) or any T-Spin clear.
// B2B resets on any non-difficult clear (1,2,3 lines with no t-spin).
//
// Lines sent (attack) — simplified guideline values:
//   Single: 0, Double: 1, Triple: 2, Tetris: 4
//   B2B Tetris: 6
//   T-Spin Mini 1: 0, T-Spin Mini 2: 1
//   T-Spin 1: 2, T-Spin 2: 4, T-Spin 3: 6
//   B2B T-Spin 1: 3, B2B T-Spin 2: 6, B2B T-Spin 3: 9 (approx)
//   Combo ≥1: +1 per combo

export function calcClearScore(
  linesCleared: number,
  tSpinType: 'tspin' | 'tspin-mini' | null,
  b2b: boolean,
  combo: number,
  level: number
): ClearResult {
  if (linesCleared === 0 && tSpinType === null) {
    // No lines cleared, no t-spin — reset combo is handled by caller
    return {
      scoreDelta: 0,
      linesSent: 0,
      newB2B: b2b, // unchanged
      description: '',
    };
  }

  let baseScore = 0;
  let linesSent = 0;
  let difficult = false;
  let description = '';

  if (tSpinType === 'tspin') {
    difficult = true;
    switch (linesCleared) {
      case 0:
        baseScore = 400;
        linesSent = 0;
        description = 'T-Spin';
        break;
      case 1:
        baseScore = 800;
        linesSent = 2;
        description = 'T-Spin Single';
        break;
      case 2:
        baseScore = 1200;
        linesSent = 4;
        description = 'T-Spin Double';
        break;
      case 3:
        baseScore = 1600;
        linesSent = 6;
        description = 'T-Spin Triple';
        break;
      default:
        baseScore = 1600;
        linesSent = 6;
        description = 'T-Spin Triple';
    }
    if (b2b && linesCleared > 0) {
      baseScore = Math.floor(baseScore * 1.5);
      linesSent = Math.floor(linesSent * 1.5);
      description = 'B2B ' + description;
    }
  } else if (tSpinType === 'tspin-mini') {
    difficult = linesCleared > 0; // Mini counts as difficult only when clearing lines
    switch (linesCleared) {
      case 0:
        baseScore = 100;
        linesSent = 0;
        description = 'T-Spin Mini';
        break;
      case 1:
        baseScore = 200;
        linesSent = 0;
        description = 'T-Spin Mini Single';
        break;
      case 2:
        baseScore = 400;
        linesSent = 1;
        description = 'T-Spin Mini Double';
        break;
      default:
        baseScore = 400;
        linesSent = 1;
        description = 'T-Spin Mini Double';
    }
    if (b2b && linesCleared > 0) {
      baseScore = Math.floor(baseScore * 1.5);
      description = 'B2B ' + description;
    }
  } else {
    // Normal clear
    switch (linesCleared) {
      case 1:
        baseScore = 100;
        linesSent = 0;
        description = 'Single';
        difficult = false;
        break;
      case 2:
        baseScore = 300;
        linesSent = 1;
        description = 'Double';
        difficult = false;
        break;
      case 3:
        baseScore = 500;
        linesSent = 2;
        description = 'Triple';
        difficult = false;
        break;
      case 4:
        baseScore = 800;
        linesSent = 4;
        description = 'Tetris';
        difficult = true;
        break;
      default:
        if (linesCleared > 4) {
          baseScore = 800;
          linesSent = 4;
          description = 'Tetris';
          difficult = true;
        }
    }
    if (difficult && b2b) {
      baseScore = Math.floor(baseScore * 1.5);
      linesSent += 2; // B2B Tetris sends 6 total
      description = 'B2B ' + description;
    }
  }

  // Combo bonus
  const comboScore = combo > 0 ? 50 * combo * level : 0;
  const comboAttack = combo > 0 ? Math.floor(combo / 2) : 0;
  if (combo > 0) {
    linesSent += comboAttack;
    description += ` (${combo} combo)`;
  }

  const scoreDelta = baseScore * level + comboScore;
  const newB2B = linesCleared > 0 ? difficult : b2b;

  return {
    scoreDelta,
    linesSent: Math.max(0, linesSent),
    newB2B,
    description,
  };
}

// ─── Garbage ──────────────────────────────────────────────────────────────────

/**
 * Add `lines` garbage rows to the bottom of the board.
 * Existing rows are shifted up; overflow rows at the top are discarded.
 * Each garbage row has a random hole at a random column.
 */
export function addGarbage(board: CellColor[][], lines: number): CellColor[][] {
  if (lines <= 0) return board;

  // Pick a random column for the hole (same column for all lines in one attack, as per guideline)
  const holeCol = Math.floor(Math.random() * COLS);

  const garbageRows: CellColor[][] = Array.from({ length: lines }, () =>
    Array.from({ length: COLS }, (_, c) =>
      c === holeCol ? null : GARBAGE_COLOR
    )
  );

  // Shift existing rows up by `lines`, dropping rows from the top
  const shifted = board.slice(lines); // drop top `lines` rows
  const newBoard = [...shifted, ...garbageRows];

  return newBoard;
}

// ─── Spawning ─────────────────────────────────────────────────────────────────

/**
 * Create an ActivePiece at the standard spawn position.
 * Spawn row = BUFFER_ROWS - 2 = 18 (bounding box top), col = 3.
 * (The I piece uses the same spawn row/col; its shape puts it at visual row 19.)
 */
export function spawnPiece(type: PieceType): ActivePiece {
  return {
    type,
    rot: 0,
    row: BUFFER_ROWS - 2, // row 18
    col: 3,
  };
}

// ─── Next Queue ───────────────────────────────────────────────────────────────

/**
 * Draw the next piece type from the bag system.
 * Returns { type, bag, nextBag } after drawing one piece.
 * If bag is empty, promote nextBag → bag and generate a fresh nextBag.
 */
function drawNextPiece(
  bag: PieceType[],
  nextBag: PieceType[]
): { type: PieceType; bag: PieceType[]; nextBag: PieceType[] } {
  if (bag.length === 0) {
    bag = nextBag;
    nextBag = newBag();
  }
  const [type, ...rest] = bag;
  return { type, bag: rest, nextBag };
}

/**
 * Rebuild the visible next queue (5 pieces) from current bag + nextBag.
 * Does not mutate the bags.
 */
function buildNextQueue(bag: PieceType[], nextBag: PieceType[]): PieceType[] {
  const combined = [...bag, ...nextBag];
  return combined.slice(0, 5);
}

// ─── Initial State ────────────────────────────────────────────────────────────

/**
 * Create a fresh TetrisState.
 * Pre-generates 2 bags, spawns the first piece, and populates the next queue.
 */
export function initialState(): TetrisState {
  let bag = newBag();
  let nextBag = newBag();

  // Draw the first current piece
  const draw = drawNextPiece(bag, nextBag);
  bag = draw.bag;
  nextBag = draw.nextBag;
  const currentType = draw.type;

  const nextQueue = buildNextQueue(bag, nextBag);

  return {
    board: emptyBoard(),
    current: spawnPiece(currentType),
    hold: null,
    holdUsed: false,
    bag,
    nextBag,
    nextQueue,
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    b2b: false,
    phase: 'playing',
    lockResets: 0,
    lowestRow: BUFFER_ROWS - 2,
    garbagePending: 0,
  };
}

// ─── Exported helpers used by game loop ───────────────────────────────────────
// (These wrap the bag-draw logic so the caller doesn't need internal details.)

/**
 * Advance to the next piece.
 * Returns a partial state update with the new current piece, updated bags, and next queue.
 */
export function advancePiece(state: TetrisState): Pick<
  TetrisState,
  'current' | 'bag' | 'nextBag' | 'nextQueue' | 'holdUsed' | 'lockResets' | 'lowestRow'
> {
  let { bag, nextBag } = state;
  const draw = drawNextPiece(bag, nextBag);
  bag = draw.bag;
  nextBag = draw.nextBag;
  const current = spawnPiece(draw.type);
  const nextQueue = buildNextQueue(bag, nextBag);

  return {
    current,
    bag,
    nextBag,
    nextQueue,
    holdUsed: false,
    lockResets: 0,
    lowestRow: current.row,
  };
}

/**
 * Activate hold:
 *  - If hold is empty, store current piece and spawn next.
 *  - If hold is filled, swap current ↔ hold.
 *  - holdUsed is set to true; returns null if holdUsed was already true (can't hold twice).
 */
export function activateHold(state: TetrisState): Partial<TetrisState> | null {
  if (state.holdUsed) return null;

  let { bag, nextBag } = state;

  if (state.hold === null) {
    // No held piece yet — hold current, spawn next
    const heldType = state.current.type;
    const draw = drawNextPiece(bag, nextBag);
    bag = draw.bag;
    nextBag = draw.nextBag;
    const nextQueue = buildNextQueue(bag, nextBag);
    return {
      current: spawnPiece(draw.type),
      hold: heldType,
      holdUsed: true,
      bag,
      nextBag,
      nextQueue,
      lockResets: 0,
      lowestRow: BUFFER_ROWS - 2,
    };
  } else {
    // Swap current ↔ hold
    const heldType = state.hold;
    return {
      current: spawnPiece(heldType),
      hold: state.current.type,
      holdUsed: true,
      lockResets: 0,
      lowestRow: BUFFER_ROWS - 2,
    };
  }
}

/**
 * Calculate the current level from total lines cleared.
 * Standard guideline: level = Math.floor(lines / 10) + 1, capped at 15.
 */
export function calcLevel(lines: number): number {
  return Math.min(15, Math.floor(lines / 10) + 1);
}

/**
 * Calculate gravity drop interval in ms for a given level.
 * Uses the standard guideline gravity formula:
 *   interval = (0.8 - (level - 1) * 0.007)^(level-1) seconds
 */
export function gravityInterval(level: number): number {
  const lv = Math.max(1, Math.min(20, level));
  const seconds = Math.pow(0.8 - (lv - 1) * 0.007, lv - 1);
  return Math.max(16, Math.round(seconds * 1000));
}
