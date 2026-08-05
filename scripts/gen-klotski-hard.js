// gen-klotski-hard.js
// Run: node scripts/gen-klotski-hard.js medium   (generates 35 medium levels, 26-45 steps)
//      node scripts/gen-klotski-hard.js hard      (generates 35 hard   levels, 46+ steps)

const MODE = process.argv[2] || 'medium';
const IS_HARD = MODE === 'hard';

const BOARD_COLS = 4;
const BOARD_ROWS = 5;
const WIN_ROW = 3;
const WIN_COL = 1;

// ─── Core engine ────────────────────────────────────────────────────────────

function getShape(type) {
  if (type === 'caocao')     return { w: 2, h: 2 };
  if (type === 'horizontal') return { w: 2, h: 1 };
  if (type === 'vertical')   return { w: 1, h: 2 };
  return { w: 1, h: 1 };
}

function buildOccupancy(pieces) {
  const grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  for (const p of pieces) {
    const { w, h } = getShape(p.type);
    for (let r = p.row; r < p.row + h; r++)
      for (let c = p.col; c < p.col + w; c++)
        grid[r][c] = p.id;
  }
  return grid;
}

function canPlace(grid, piece, nr, nc) {
  const { w, h } = getShape(piece.type);
  if (nr < 0 || nc < 0 || nr + h > BOARD_ROWS || nc + w > BOARD_COLS) return false;
  for (let r = nr; r < nr + h; r++)
    for (let c = nc; c < nc + w; c++) {
      const occ = grid[r][c];
      if (occ !== null && occ !== piece.id) return false;
    }
  return true;
}

function isSolved(pieces) {
  const c = pieces.find(p => p.type === 'caocao');
  return c && c.row === WIN_ROW && c.col === WIN_COL;
}

// Compact canonical key — encode each piece as "type:r,c" sorted
function canonicalKey(pieces) {
  const parts = pieces.map(p => `${p.type[0]}${p.type==='caocao'?'c':p.type==='horizontal'?'h':p.type==='vertical'?'v':'s'}:${p.row},${p.col}`);
  return parts.sort().join('|');
}

// BFS — returns minSteps or -1 if unsolvable within limits
// Uses a flat array as queue for speed; stops at maxSteps or maxStates.
function bfsSolve(startPieces, maxSteps, maxStates) {
  if (isSolved(startPieces)) return 0;
  const visited = new Map();
  visited.set(canonicalKey(startPieces), 0);

  // frontier: array of [pieces, steps]
  let frontier = [[startPieces, 0]];
  let statesExplored = 1;

  while (frontier.length > 0) {
    const next = [];
    for (const [state, steps] of frontier) {
      if (steps >= maxSteps) continue;
      const grid = buildOccupancy(state);
      for (const piece of state) {
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = piece.row + dr, nc = piece.col + dc;
          if (!canPlace(grid, piece, nr, nc)) continue;
          const ns = state.map(p => p.id === piece.id ? { ...p, row: nr, col: nc } : p);
          if (isSolved(ns)) return steps + 1;
          const key = canonicalKey(ns);
          if (visited.has(key)) continue;
          visited.set(key, steps + 1);
          statesExplored++;
          if (statesExplored > maxStates) return -1;
          next.push([ns, steps + 1]);
        }
      }
    }
    frontier = next;
  }
  return -1;
}

// ─── Random board generator ──────────────────────────────────────────────────

function rnd(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function countEmpty(grid) {
  let n = 0;
  for (const row of grid) for (const c of row) if (c === null) n++;
  return n;
}

function tryPlaceRandom(grid, type, nextId) {
  const { w, h } = getShape(type);
  const candidates = [];
  for (let r = 0; r + h <= BOARD_ROWS; r++)
    for (let c = 0; c + w <= BOARD_COLS; c++)
      candidates.push([r, c]);
  shuffle(candidates);
  for (const [r, c] of candidates) {
    let ok = true;
    for (let dr = 0; dr < h && ok; dr++)
      for (let dc = 0; dc < w && ok; dc++)
        if (grid[r+dr][c+dc] !== null) ok = false;
    if (!ok) continue;
    const id = nextId();
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++)
        grid[r+dr][c+dc] = id;
    return { id, type, row: r, col: c };
  }
  return null;
}

function genRandomBoard(template) {
  const { nH, nV, nS, minEmpty = 2 } = template;
  const grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const pieces = [];
  let counter = 0;
  const names = ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12','p13','p14'];
  const nextId = () => names[counter++] || `p${counter}`;

  // Place caocao — not at win position
  const ccCands = [];
  for (let r = 0; r + 2 <= BOARD_ROWS; r++)
    for (let c = 0; c + 2 <= BOARD_COLS; c++)
      if (!(r === WIN_ROW && c === WIN_COL))
        ccCands.push([r, c]);
  shuffle(ccCands);
  let placed = false;
  for (const [r, c] of ccCands) {
    let ok = true;
    for (let dr = 0; dr < 2 && ok; dr++)
      for (let dc = 0; dc < 2 && ok; dc++)
        if (grid[r+dr][c+dc] !== null) ok = false;
    if (!ok) continue;
    for (let dr = 0; dr < 2; dr++)
      for (let dc = 0; dc < 2; dc++)
        grid[r+dr][c+dc] = 'caocao';
    pieces.push({ id: 'caocao', type: 'caocao', row: r, col: c });
    placed = true;
    break;
  }
  if (!placed) return null;

  for (let i = 0; i < nH; i++) {
    if (countEmpty(grid) <= minEmpty) break;
    const p = tryPlaceRandom(grid, 'horizontal', nextId);
    if (p) pieces.push(p);
  }
  for (let i = 0; i < nV; i++) {
    if (countEmpty(grid) <= minEmpty) break;
    const p = tryPlaceRandom(grid, 'vertical', nextId);
    if (p) pieces.push(p);
  }
  for (let i = 0; i < nS; i++) {
    if (countEmpty(grid) <= minEmpty) break;
    const p = tryPlaceRandom(grid, 'soldier', nextId);
    if (p) pieces.push(p);
  }

  if (countEmpty(grid) < minEmpty) return null;
  return pieces;
}

// ─── Label bank ─────────────────────────────────────────────────────────────

function labelledPieces(raw) {
  let hi = 0, vi = 0, si = 0;
  const hEmoji = ['🦀','🦞','🐙','🦑','🐡'];
  const vEmoji = ['🦒','🦕','🐍','🌵','🦴'];
  const sEmoji = ['🐰','🐹','🐸','🐱','🐭','🐶','🐼','🐨'];
  return raw.map(p => {
    if (p.type === 'caocao')     return { ...p, label: '英雄',    emoji: '👑' };
    if (p.type === 'horizontal') return { ...p, label: `螃蟹${hi+1}`, emoji: hEmoji[hi++ % hEmoji.length] };
    if (p.type === 'vertical')   return { ...p, label: `長頸鹿${vi+1}`, emoji: vEmoji[vi++ % vEmoji.length] };
    return { ...p, label: `兔兔${si+1}`, emoji: sEmoji[si++ % sEmoji.length] };
  });
}

function renameIds(pieces) {
  const map = {};
  let hi = 1, vi = 1, si = 1;
  for (const p of pieces) {
    if (p.id === 'caocao') { map[p.id] = 'caocao'; continue; }
    if (p.type === 'horizontal') map[p.id] = `h${hi++}`;
    else if (p.type === 'vertical') map[p.id] = `v${vi++}`;
    else map[p.id] = `s${si++}`;
  }
  return pieces.map(p => ({ ...p, id: map[p.id] }));
}

// ─── Configuration ──────────────────────────────────────────────────────────

const MEDIUM_TEMPLATES = [
  { nH: 1, nV: 3, nS: 4, minEmpty: 2 },
  { nH: 2, nV: 3, nS: 3, minEmpty: 2 },
  { nH: 1, nV: 4, nS: 3, minEmpty: 2 },
  { nH: 2, nV: 2, nS: 5, minEmpty: 2 },
  { nH: 0, nV: 4, nS: 4, minEmpty: 2 },
  { nH: 2, nV: 3, nS: 4, minEmpty: 2 },
  { nH: 1, nV: 3, nS: 5, minEmpty: 2 },
  { nH: 3, nV: 2, nS: 4, minEmpty: 2 },
];

const HARD_TEMPLATES = [
  { nH: 2, nV: 4, nS: 4, minEmpty: 2 },
  { nH: 1, nV: 5, nS: 4, minEmpty: 2 },
  { nH: 3, nV: 3, nS: 4, minEmpty: 2 },
  { nH: 2, nV: 4, nS: 5, minEmpty: 2 },
  { nH: 1, nV: 4, nS: 6, minEmpty: 2 },
  { nH: 3, nV: 4, nS: 3, minEmpty: 2 },
  { nH: 2, nV: 5, nS: 3, minEmpty: 2 },
  { nH: 4, nV: 3, nS: 3, minEmpty: 2 },
];

const TEMPLATES = IS_HARD ? HARD_TEMPLATES : MEDIUM_TEMPLATES;
const MIN_STEPS = IS_HARD ? 46 : 26;
const MAX_STEPS = IS_HARD ? 80 : 45;
const MAX_STATES = IS_HARD ? 2_000_000 : 1_000_000;

const EXISTING = IS_HARD ? 5 : 5;
const TARGET = 40;
const NEED = TARGET - EXISTING; // 35

// ─── Main loop ───────────────────────────────────────────────────────────────

const usedKeys = new Set();
const results = [];
let attempts = 0;
const MAX_ATTEMPTS = IS_HARD ? 30_000 : 50_000;

process.stderr.write(`Generating ${NEED} ${MODE} levels (${MIN_STEPS}-${MAX_STEPS} steps)...\n`);
const startTime = Date.now();

while (results.length < NEED && attempts < MAX_ATTEMPTS) {
  attempts++;
  const template = TEMPLATES[rnd(0, TEMPLATES.length - 1)];
  const raw = genRandomBoard(template);
  if (!raw) continue;

  const key = canonicalKey(raw);
  if (usedKeys.has(key)) continue;

  const steps = bfsSolve(raw, MAX_STEPS, MAX_STATES);
  if (steps < MIN_STEPS || steps > MAX_STEPS) continue;

  usedKeys.add(key);
  const idx = EXISTING + results.length + 1;
  const idStr = String(idx).padStart(2, '0');

  const named = renameIds(raw);
  const labelled = labelledPieces(named);

  results.push({
    id: `${MODE}-${idStr}`,
    difficulty: MODE,
    minSteps: steps,
    pieces: labelled,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (results.length % 5 === 0)
    process.stderr.write(`  ${results.length}/${NEED} done  (${attempts} attempts, ${elapsed}s)\n`);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
process.stderr.write(`Done: ${results.length} levels in ${attempts} attempts, ${elapsed}s\n`);

console.log(JSON.stringify(results, null, 2));
