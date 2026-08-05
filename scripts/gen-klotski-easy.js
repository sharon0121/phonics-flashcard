// gen-klotski-easy.js
// Run: node scripts/gen-klotski-easy.js
// Generates verified easy Klotski levels (8-25 min steps) and prints JSON.

const BOARD_COLS = 4;
const BOARD_ROWS = 5;
const WIN_ROW = 3;
const WIN_COL = 1; // EXIT_COL

// ─── Core engine (mirrors klotski.ts) ────────────────────────────────────────

function getShape(type) {
  if (type === 'caocao')     return { w: 2, h: 2 };
  if (type === 'horizontal') return { w: 2, h: 1 };
  if (type === 'vertical')   return { w: 1, h: 2 };
  return { w: 1, h: 1 }; // soldier
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

function canonicalKey(pieces) {
  const grouped = {};
  for (const p of pieces) {
    if (!grouped[p.type]) grouped[p.type] = [];
    grouped[p.type].push([p.row, p.col]);
  }
  return Object.keys(grouped).sort().map(t => {
    const pos = grouped[t].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return t + ':' + pos.map(([r, c]) => `${r},${c}`).join(';');
  }).join('|');
}

// BFS — returns minSteps or -1 if unsolvable within maxSteps
function bfsSolve(pieces, maxSteps = 30) {
  if (isSolved(pieces)) return 0;
  const visited = new Set([canonicalKey(pieces)]);
  let frontier = [pieces];
  for (let step = 1; step <= maxSteps; step++) {
    const next = [];
    for (const state of frontier) {
      const grid = buildOccupancy(state);
      for (const piece of state) {
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          if (!canPlace(grid, piece, piece.row + dr, piece.col + dc)) continue;
          const ns = state.map(p => p.id === piece.id ? { ...p, row: p.row + dr, col: p.col + dc } : p);
          if (isSolved(ns)) return step;
          const key = canonicalKey(ns);
          if (visited.has(key)) continue;
          visited.add(key);
          next.push(ns);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) return -1;
  }
  return -1;
}

// ─── Random board generator ───────────────────────────────────────────────────

function rnd(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Try to place one piece of `type` at a random empty cell; returns piece or null.
function tryPlaceRandom(grid, type, nextId) {
  const { w, h } = getShape(type);
  const candidates = [];
  for (let r = 0; r + h <= BOARD_ROWS; r++)
    for (let c = 0; c + w <= BOARD_COLS; c++)
      candidates.push([r, c]);
  shuffle(candidates);
  for (const [r, c] of candidates) {
    let ok = true;
    outer: for (let dr = 0; dr < h && ok; dr++)
      for (let dc = 0; dc < w && ok; dc++)
        if (grid[r + dr][c + dc] !== null) ok = false;
    if (!ok) continue;
    // Place it
    const id = nextId();
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++)
        grid[r + dr][c + dc] = id;
    return { id, type, row: r, col: c };
  }
  return null;
}

function countEmpty(grid) {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell === null) n++;
  return n;
}

// Generate one random board configuration
function genRandomBoard(template) {
  const { nH, nV, nS } = template; // horizontals, verticals, soldiers
  const grid = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
  const pieces = [];
  let counter = 0;
  const nextId = () => {
    const names = ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p12'];
    return names[counter++] || `px${counter}`;
  };

  // Place caocao first — not at win position
  const caocaoId = 'caocao';
  let placed = false;
  const ccCands = [];
  for (let r = 0; r + 2 <= BOARD_ROWS; r++)
    for (let c = 0; c + 2 <= BOARD_COLS; c++)
      if (!(r === WIN_ROW && c === WIN_COL)) ccCands.push([r, c]);
  shuffle(ccCands);
  for (const [r, c] of ccCands) {
    let ok = true;
    for (let dr = 0; dr < 2 && ok; dr++)
      for (let dc = 0; dc < 2 && ok; dc++)
        if (grid[r+dr][c+dc] !== null) ok = false;
    if (!ok) continue;
    for (let dr = 0; dr < 2; dr++)
      for (let dc = 0; dc < 2; dc++)
        grid[r+dr][c+dc] = caocaoId;
    pieces.push({ id: caocaoId, type: 'caocao', row: r, col: c });
    placed = true;
    break;
  }
  if (!placed) return null;

  // Place other pieces
  for (let i = 0; i < nH; i++) {
    const p = tryPlaceRandom(grid, 'horizontal', nextId);
    if (p) pieces.push(p);
  }
  for (let i = 0; i < nV; i++) {
    const p = tryPlaceRandom(grid, 'vertical', nextId);
    if (p) pieces.push(p);
  }
  for (let i = 0; i < nS; i++) {
    if (countEmpty(grid) <= 2) break; // keep at least 2 empty
    const p = tryPlaceRandom(grid, 'soldier', nextId);
    if (p) pieces.push(p);
  }

  if (countEmpty(grid) < 2) return null;
  return pieces;
}

// ─── Piece name / emoji banks (for display) ──────────────────────────────────

const H_NAMES = [
  { label:'螃蟹A', emoji:'🦀' },{ label:'螃蟹B', emoji:'🦞' },
  { label:'螃蟹C', emoji:'🐙' },{ label:'螃蟹D', emoji:'🦑' },
];
const V_NAMES = [
  { label:'長頸鹿A', emoji:'🦒' },{ label:'長頸鹿B', emoji:'🦕' },
  { label:'長頸鹿C', emoji:'🐍' },{ label:'長頸鹿D', emoji:'🌵' },
];
const S_NAMES = [
  { label:'兔兔A', emoji:'🐰' },{ label:'兔兔B', emoji:'🐹' },
  { label:'兔兔C', emoji:'🐸' },{ label:'兔兔D', emoji:'🐱' },
  { label:'兔兔E', emoji:'🐭' },{ label:'兔兔F', emoji:'🐶' },
];

function labelledPieces(rawPieces, levelIdx) {
  let hi = 0, vi = 0, si = 0;
  return rawPieces.map(p => {
    if (p.type === 'caocao') return { ...p, label: '英雄', emoji: '👑' };
    if (p.type === 'horizontal') {
      const n = H_NAMES[hi++ % H_NAMES.length];
      return { ...p, label: n.label, emoji: n.emoji };
    }
    if (p.type === 'vertical') {
      const n = V_NAMES[vi++ % V_NAMES.length];
      return { ...p, label: n.label, emoji: n.emoji };
    }
    // soldier
    const n = S_NAMES[si++ % S_NAMES.length];
    return { ...p, label: n.label, emoji: n.emoji };
  });
}

// Rename generic IDs to nicer names for readability
function renameIds(pieces) {
  const idMap = {};
  let hi = 1, vi = 1, si = 1;
  for (const p of pieces) {
    if (p.id === 'caocao') { idMap[p.id] = 'caocao'; continue; }
    if (p.type === 'horizontal') idMap[p.id] = `h${hi++}`;
    else if (p.type === 'vertical') idMap[p.id] = `v${vi++}`;
    else idMap[p.id] = `s${si++}`;
  }
  return pieces.map(p => ({ ...p, id: idMap[p.id] }));
}

// ─── Main generation loop ─────────────────────────────────────────────────────

// Templates: vary piece counts to get different puzzle complexities
const TEMPLATES = [
  { nH: 1, nV: 1, nS: 2 },
  { nH: 1, nV: 2, nS: 1 },
  { nH: 0, nV: 2, nS: 3 },
  { nH: 2, nV: 1, nS: 1 },
  { nH: 1, nV: 1, nS: 3 },
  { nH: 0, nV: 3, nS: 2 },
  { nH: 2, nV: 0, nS: 3 },
  { nH: 1, nV: 2, nS: 2 },
  { nH: 0, nV: 1, nS: 4 },
  { nH: 2, nV: 1, nS: 2 },
];

const EXISTING_EASY = 5; // already have 5 easy levels
const TARGET = 40;
const NEED = TARGET - EXISTING_EASY; // 35 more

const usedKeys = new Set();
const results = [];

let attempts = 0;
const MAX_ATTEMPTS = 50000;

while (results.length < NEED && attempts < MAX_ATTEMPTS) {
  attempts++;
  const template = TEMPLATES[rnd(0, TEMPLATES.length - 1)];
  const raw = genRandomBoard(template);
  if (!raw) continue;

  const key = canonicalKey(raw);
  if (usedKeys.has(key)) continue;

  const steps = bfsSolve(raw, 25);
  if (steps < 8 || steps > 25) continue;

  usedKeys.add(key);
  const idx = EXISTING_EASY + results.length + 1;
  const idStr = String(idx).padStart(2, '0');

  const named = renameIds(raw);
  const labelled = labelledPieces(named, idx);

  results.push({
    id: `easy-${idStr}`,
    difficulty: 'easy',
    minSteps: steps,
    pieces: labelled,
  });

  if (results.length % 5 === 0)
    process.stderr.write(`Generated ${results.length}/${NEED} (${attempts} attempts)\n`);
}

process.stderr.write(`Done: ${results.length} levels in ${attempts} attempts\n`);

// Output as TypeScript array entries (to paste into klotskiLevels.ts)
console.log(JSON.stringify(results, null, 2));
