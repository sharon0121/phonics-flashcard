'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { markPhotoCompleted, loadPhotoStars, subscribePuzzle } from '@/lib/puzzleProgress';

// ── Types ─────────────────────────────────────────────────────────────────────
type Difficulty = 'lv1' | 'lv2' | 'lv3' | 'lv4' | 'lv5';
type PieceState = 'tray' | 'placed';
interface DiffConfig { cols: number; rows: number; label: string; stars: string }
interface PuzzleImage { src: string; label: string; ratio: '3x4' | '1x1'; group: string }
interface Piece {
  id: number; row: number; col: number;   // correct destination slot
  tabs: [number, number, number, number];
  state: PieceState;
  slotRow: number; slotCol: number;       // current slot on board (-1 = not in any slot)
  trayX: number; trayY: number;           // position when tray or floating
  floating: boolean;                      // on board area but not snapped to a slot
}
interface GameData {
  pieces: Piece[];
  offscreens: Map<number, HTMLCanvasElement>;
  gridOverlay: HTMLCanvasElement;
  pw: number; ph: number; pad: number;
  cols: number; rows: number;
  boardW: number; boardH: number;
  holding: number | null;
  heldX: number; heldY: number;
  trayScale: number;
}

const CONFIGS: Record<Difficulty, DiffConfig> = {
  lv1: { cols: 4, rows: 4, label: '入門', stars: '⭐' },
  lv2: { cols: 5, rows: 5, label: '初級', stars: '⭐⭐' },
  lv3: { cols: 6, rows: 6, label: '中級', stars: '⭐⭐⭐' },
  lv4: { cols: 7, rows: 7, label: '高級', stars: '⭐⭐⭐⭐' },
  lv5: { cols: 8, rows: 8, label: '挑戰', stars: '⭐⭐⭐⭐⭐' },
};

// Photos grouped by type
const PUZZLE_IMAGES: PuzzleImage[] = [
  { src: '/puzzles/marvel-heroes.png',  label: '摩天大樓英雄集結', ratio: '3x4', group: '英雄集結' },
  { src: '/puzzles/cosmic-heroes.png',  label: '宇宙英雄家族',     ratio: '3x4', group: '英雄集結' },
  { src: '/puzzles/space-squad.png',    label: '宇宙星際探險隊',   ratio: '3x4', group: '英雄集結' },
  { src: '/puzzles/vs-thanos.png',      label: '對抗薩諾斯',       ratio: '3x4', group: '對抗薩諾斯' },
  { src: '/puzzles/vs-thanos2.png',     label: '對抗薩諾斯 II',    ratio: '3x4', group: '對抗薩諾斯' },
  { src: '/puzzles/hulk-family.png',    label: '浩克家族',         ratio: '3x4', group: '家族合照' },
  { src: '/puzzles/family-cute.png',    label: '全家福墨鏡可愛版', ratio: '1x1', group: '家族合照' },
  { src: '/puzzles/black-panther.png',  label: '黑豹家族',         ratio: '1x1', group: '家族合照' },
  { src: '/puzzles/hi-tech-base.png',   label: '高科技指揮中心',   ratio: '3x4', group: '特別版' },
  { src: '/puzzles/comic-cover.png',    label: '美式復古漫畫',     ratio: '1x1', group: '特別版' },
];

const DIFF_STARS: Record<Difficulty, number> = { lv1: 1, lv2: 2, lv3: 3, lv4: 4, lv5: 5 };

// ── Jigsaw tab direction ────────────────────────────────────────────────────
function edgeTabDir(row: number, col: number, edge: 'r' | 'b'): 1 | -1 {
  const h = edge === 'r' ? (row * 31 + col * 17 + 7) % 2 : (row * 13 + col * 29 + 3) % 2;
  return h === 0 ? 1 : -1;
}

function buildAllTabs(cols: number, rows: number): [number, number, number, number][] {
  return Array.from({ length: rows * cols }, (_, idx) => {
    const r = Math.floor(idx / cols), c = idx % cols;
    return [
      r === 0        ? 0 : -edgeTabDir(r - 1, c, 'b') as 1 | -1,
      c === cols - 1 ? 0 :  edgeTabDir(r, c, 'r'),
      r === rows - 1 ? 0 :  edgeTabDir(r, c, 'b'),
      c === 0        ? 0 : -edgeTabDir(r, c - 1, 'r') as 1 | -1,
    ] as [number, number, number, number];
  });
}

// Classic jigsaw tab: flat → smooth rise → narrow neck → round head → mirror descent.
// h is always ≥ 0 — no undercut below the flat edge, which would cause path self-intersection
// and visually crossed grid lines when adjacent pieces' outlines are drawn on the same canvas.
// 4 G1-continuous bezier segments. Head height h=0.28 ≈ 28% of edge length (matches reference).
function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  dir: number,
) {
  if (dir === 0) { ctx.lineTo(x2, y2); return; }
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / L, uy = dy / L;
  const nx = -uy * dir, ny = ux * dir;
  const pt = (t: number, h: number): [number, number] => [
    x1 + ux * L * t + nx * L * h,
    y1 + uy * L * t + ny * L * h,
  ];

  ctx.lineTo(...pt(0.33, 0.00));
  // ① left rise: start horizontal (G1 with flat), arrive vertical at neck
  ctx.bezierCurveTo(...pt(0.35, 0.00), ...pt(0.38, 0.08), ...pt(0.38, 0.10));
  // ② left head arc: depart vertical, arrive horizontal at peak
  ctx.bezierCurveTo(...pt(0.38, 0.24), ...pt(0.44, 0.28), ...pt(0.50, 0.28));
  // ③ right head arc: depart horizontal, arrive vertical at right neck
  ctx.bezierCurveTo(...pt(0.56, 0.28), ...pt(0.62, 0.24), ...pt(0.62, 0.10));
  // ④ right descent: depart vertical, arrive horizontal (G1 with flat)
  ctx.bezierCurveTo(...pt(0.62, 0.08), ...pt(0.65, 0.00), ...pt(0.67, 0.00));
  ctx.lineTo(x2, y2);
}

function buildPiecePath(
  ctx: CanvasRenderingContext2D,
  pw: number, ph: number,
  tabs: [number, number, number, number],
  pad: number,
) {
  const x0 = pad, y0 = pad, x1 = pad + pw, y1 = pad + ph;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  drawEdge(ctx, x0, y0, x1, y0, tabs[0]);
  drawEdge(ctx, x1, y0, x1, y1, tabs[1]);
  drawEdge(ctx, x1, y1, x0, y1, tabs[2]);
  drawEdge(ctx, x0, y1, x0, y0, tabs[3]);
  ctx.closePath();
}

function buildBoardPath(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, pw: number, ph: number,
  tabs: [number, number, number, number],
) {
  ctx.beginPath();
  ctx.moveTo(bx, by);
  drawEdge(ctx, bx, by, bx + pw, by, tabs[0]);
  drawEdge(ctx, bx + pw, by, bx + pw, by + ph, tabs[1]);
  drawEdge(ctx, bx + pw, by + ph, bx, by + ph, tabs[2]);
  drawEdge(ctx, bx, by + ph, bx, by, tabs[3]);
  ctx.closePath();
}

function renderPiece(
  img: HTMLImageElement,
  tabs: [number, number, number, number],
  piece: { col: number; row: number },
  pw: number, ph: number,
  cols: number, rows: number,
): HTMLCanvasElement {
  const PAD = Math.max(pw, ph) * 0.42;
  const oc = document.createElement('canvas');
  oc.width  = Math.ceil(pw + PAD * 2);
  oc.height = Math.ceil(ph + PAD * 2);
  const ctx = oc.getContext('2d')!;
  buildPiecePath(ctx, pw, ph, tabs, PAD);
  ctx.save(); ctx.clip();
  ctx.drawImage(img, PAD - piece.col * pw, PAD - piece.row * ph, pw * cols, ph * rows);
  ctx.restore();
  buildPiecePath(ctx, pw, ph, tabs, PAD);
  ctx.strokeStyle = 'rgba(251,191,36,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return oc;
}

function renderGridOverlay(
  allTabs: [number, number, number, number][],
  cols: number, rows: number, pw: number, ph: number,
): HTMLCanvasElement {
  const oc = document.createElement('canvas');
  oc.width = Math.ceil(pw * cols);
  oc.height = Math.ceil(ph * rows);
  const ctx = oc.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.5)';
  ctx.lineWidth = 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      buildBoardPath(ctx, c * pw, r * ph, pw, ph, allTabs[r * cols + c]);
      ctx.stroke();
    }
  }
  return oc;
}

// ── Layout constants ──────────────────────────────────────────────────────────
// Left col: reference image | Center: puzzle board | Right: piece tray
const CANVAS_W   = 1200;
const CANVAS_H   = 740;
const BOARD_Y    = 16;
const LEFT_PAD   = 8;
const REF_COL_W  = 212;  // fixed width of the left reference-image column
const COL_GAP    = 12;
const BOARD_X    = LEFT_PAD + REF_COL_W + COL_GAP;  // = 232

// ── Main Component ────────────────────────────────────────────────────────────
export default function PuzzleView() {
  const [screen, setScreen]       = useState<'difficulty' | 'photo' | 'game' | 'complete'>('difficulty');
  const [difficulty, setDiff]     = useState<Difficulty>('lv1');
  const [selPhoto, setSelPhoto]   = useState<PuzzleImage>(PUZZLE_IMAGES[0]);
  const [placedCount, setPlaced]  = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const [showPreview, setShowPrev] = useState(false);
  const [photoStars, setPhotoStars] = useState<Record<string, number>>({});
  const [loading, setLoading]     = useState(false);
  const [refEnlarged, setRefEnlarged] = useState(false);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);
  const gameRef    = useRef<GameData | null>(null);
  const previewRef = useRef(false);
  const refEnlargedRef = useRef(false);
  const rafRef     = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef   = useRef(0);

  // Load completed photos and subscribe for cross-device sync updates
  useEffect(() => {
    setPhotoStars(loadPhotoStars());
    const unsub = subscribePuzzle(() => setPhotoStars(loadPhotoStars()));
    return unsub;
  }, []);

  useEffect(() => { previewRef.current = showPreview; }, [showPreview]);
  useEffect(() => { refEnlargedRef.current = refEnlarged; }, [refEnlarged]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const goToPhoto = useCallback(() => { stopTimer(); setScreen('photo'); }, [stopTimer]);

  const loadImg = useCallback((photo: PuzzleImage): Promise<HTMLImageElement> => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = photo.src;
    });
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current;
    const g = gameRef.current;
    const img = imgRef.current;
    if (!canvas || !g || !img) return;
    const ctx = canvas.getContext('2d')!;
    const { pieces, offscreens, gridOverlay, pw, ph, pad,
            boardW, boardH, holding, heldX, heldY, trayScale } = g;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Enlarged reference image overlay (click ref image to toggle)
    if (refEnlargedRef.current) {
      const rawAspect = img.naturalWidth / img.naturalHeight;
      const bigH = CANVAS_H - BOARD_Y * 2;
      const bigW = Math.min(Math.round(bigH * rawAspect), CANVAS_W - 48);
      const bigX = Math.round((CANVAS_W - bigW) / 2);
      const bigY = BOARD_Y;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(bigX, bigY, bigW, bigH, 12); ctx.clip();
      ctx.drawImage(img, bigX, bigY, bigW, bigH);
      ctx.restore();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(bigX, bigY, bigW, bigH, 12); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bigX + bigW - 108, bigY + bigH - 28, 108, 28);
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('點擊任意處關閉', bigX + bigW - 54, bigY + bigH - 10);
      ctx.textAlign = 'left';
      return;
    }

    const TRAY_X = BOARD_X + boardW + COL_GAP;
    const trayW  = CANVAS_W - TRAY_X - LEFT_PAD;

    // ── Left column: reference image — capped so it never overlaps the board
    const maxRefW = REF_COL_W - LEFT_PAD * 2;           // 196px max
    const rawRefW = Math.round(boardW / 2);
    const REF_W   = Math.min(rawRefW, maxRefW);
    const REF_H   = Math.round(REF_W / rawRefW * (boardH / 2)); // maintain aspect ratio
    const refX    = LEFT_PAD + Math.round((REF_COL_W - REF_W) / 2);
    const refY = BOARD_Y;
    // Subtle left-column background
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(LEFT_PAD, BOARD_Y, REF_COL_W, CANVAS_H - BOARD_Y - LEFT_PAD, 10);
    ctx.fill();
    // Reference image
    ctx.save();
    ctx.beginPath(); ctx.roundRect(refX, refY, REF_W, REF_H, 6); ctx.clip();
    ctx.drawImage(img, refX, refY, REF_W, REF_H);
    ctx.restore();
    ctx.strokeStyle = 'rgba(251,191,36,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(refX, refY, REF_W, REF_H, 6); ctx.stroke();
    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(refX, refY + REF_H - 18, REF_W, 18);
    ctx.fillStyle = '#fde68a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('參考圖片', refX + REF_W / 2, refY + REF_H - 5);
    ctx.textAlign = 'left';

    // ── Center: puzzle board
    // Board fill
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(BOARD_X, BOARD_Y, boardW, boardH);
    // Grid overlay (jigsaw-shaped yellow lines)
    if (gridOverlay) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.drawImage(gridOverlay, BOARD_X, BOARD_Y);
      ctx.restore();
    }
    // Thick yellow border
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.strokeRect(BOARD_X, BOARD_Y, boardW, boardH);
    // Placed pieces (drawn at current slot, which may differ from correct slot)
    for (const p of pieces) {
      if (p.state !== 'placed') continue;
      const oc = offscreens.get(p.id);
      if (!oc) continue;
      ctx.drawImage(oc, BOARD_X + p.slotCol * pw - pad, BOARD_Y + p.slotRow * ph - pad);
    }

    // ── Floating pieces: dropped on board area but not yet snapped — drawn at full size
    for (const p of pieces) {
      if (p.state !== 'tray' || !p.floating) continue;
      const oc = offscreens.get(p.id);
      if (!oc) continue;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10;
      ctx.drawImage(oc, p.trayX - oc.width / 2, p.trayY - oc.height / 2);
      ctx.restore();
    }

    // ── Right column: piece tray
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(TRAY_X, BOARD_Y, trayW, CANVAS_H - BOARD_Y - LEFT_PAD, 10);
    ctx.fill();
    // Tray pieces (small scale, non-overlapping)
    for (const p of pieces) {
      if (p.state !== 'tray' || p.floating) continue;
      const oc = offscreens.get(p.id);
      if (!oc) continue;
      ctx.save();
      ctx.translate(p.trayX, p.trayY);
      ctx.scale(trayScale, trayScale);
      ctx.drawImage(oc, -oc.width / 2, -oc.height / 2);
      ctx.restore();
    }

    // ── Held piece (full size, follows pointer)
    if (holding !== null) {
      const p = pieces.find(x => x.id === holding);
      const oc = p ? offscreens.get(p.id) : undefined;
      if (oc) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
        ctx.drawImage(oc, heldX - oc.width / 2, heldY - oc.height / 2);
        ctx.restore();
      }
    }

    // ── Preview overlay on board
    if (previewRef.current) {
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.rect(BOARD_X, BOARD_Y, boardW, boardH); ctx.clip();
      ctx.drawImage(img, BOARD_X, BOARD_Y, boardW, boardH);
      ctx.restore();
    }
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') { cancelAnimationFrame(rafRef.current); return; }
    let alive = true;
    function loop() { if (!alive) return; draw(); rafRef.current = requestAnimationFrame(loop); }
    loop();
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = useCallback(async (diff: Difficulty, photo: PuzzleImage) => {
    setLoading(true);
    const cfg = CONFIGS[diff];
    const { cols, rows } = cfg;
    totalRef.current = cols * rows;

    const img = await loadImg(photo);
    imgRef.current = img;

    const boardW = photo.ratio === '1x1' ? 560 : 510;
    const boardH = photo.ratio === '1x1' ? 560 : 680;
    const pw = boardW / cols;
    const ph = boardH / rows;
    const pad = Math.max(pw, ph) * 0.42;

    const allTabs = buildAllTabs(cols, rows);

    const TRAY_X  = BOARD_X + boardW + COL_GAP;
    const trayW   = CANVAS_W - TRAY_X - LEFT_PAD;
    const trayTop = BOARD_Y;

    // Tray pieces — target 0.525× (1.5× the old 0.35) but auto-reduce if pieces overflow tray height
    const ocW = pw + pad * 2, ocH = ph + pad * 2;
    const trayAvailH = CANVAS_H - BOARD_Y - LEFT_PAD;
    let trayScale = 0.79;
    for (let tries = 0; tries < 25; tries++) {
      const tc0 = Math.max(1, Math.floor(trayW / (ocW * trayScale)));
      if (Math.ceil((cols * rows) / tc0) * ocH * trayScale <= trayAvailH) break;
      trayScale *= 0.9;
    }
    const cellW = ocW * trayScale;
    const cellH = ocH * trayScale;
    const trayCols = Math.max(1, Math.floor(trayW / cellW));

    // Centre the piece grid horizontally in the tray
    const gridW = trayCols * cellW;
    const trayStartX = TRAY_X + (trayW - gridW) / 2 + cellW / 2;
    const trayStartY = trayTop + cellH / 2;

    // Shuffle order
    const indices = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const pieces: Piece[] = allTabs.map((tabs, idx) => {
      const row = Math.floor(idx / cols), col = idx % cols;
      const trayIdx = indices.indexOf(idx);
      const tc = trayIdx % trayCols, tr = Math.floor(trayIdx / trayCols);
      return {
        id: idx, row, col, tabs, state: 'tray' as PieceState,
        slotRow: -1, slotCol: -1,
        trayX: trayStartX + tc * cellW,
        trayY: trayStartY + tr * cellH,
        floating: false,
      };
    });

    const offscreens = new Map<number, HTMLCanvasElement>();
    for (const p of pieces) {
      offscreens.set(p.id, renderPiece(img, p.tabs, p, pw, ph, cols, rows));
    }

    const gridOverlay = renderGridOverlay(allTabs, cols, rows, pw, ph);

    gameRef.current = {
      pieces, offscreens, gridOverlay,
      pw, ph, pad, cols, rows, boardW, boardH,
      holding: null, heldX: 0, heldY: 0, trayScale,
    };

    setPlaced(0);
    setElapsed(0);
    setDiff(diff);
    stopTimer();
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    setLoading(false);
    setScreen('game');
  }, [loadImg, stopTimer]);

  // ── Pointer events ────────────────────────────────────────────────────────
  function canvasXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (CANVAS_W / r.width),
      y: (e.clientY - r.top)  * (CANVAS_H / r.height),
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = gameRef.current; if (!g) return;
    const { x, y } = canvasXY(e);
    const { pieces, pw, ph, pad, trayScale, holding } = g;

    // If ref image is enlarged, any click collapses it
    if (refEnlargedRef.current) {
      setRefEnlarged(false);
      refEnlargedRef.current = false;
      return;
    }

    // Click in left column → enlarge ref image
    if (x < BOARD_X && !holding) {
      setRefEnlarged(true);
      refEnlargedRef.current = true;
      return;
    }

    if (holding !== null) {
      tryPlace(x, y);
      canvasRef.current!.releasePointerCapture(e.pointerId);
      return;
    }

    // Pick up floating pieces (full-size hitbox, on board area)
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.state !== 'tray' || !p.floating) continue;
      const halfW = (pw + pad * 2) / 2;
      const halfH = (ph + pad * 2) / 2;
      if (Math.abs(x - p.trayX) < halfW && Math.abs(y - p.trayY) < halfH) {
        g.holding = p.id;
        g.heldX = x; g.heldY = y;
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Pick up from tray (small-scale hitbox)
    const halfW = (pw + pad * 2) * trayScale / 2;
    const halfH = (ph + pad * 2) * trayScale / 2;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.state !== 'tray' || p.floating) continue;
      if (Math.abs(x - p.trayX) < halfW && Math.abs(y - p.trayY) < halfH) {
        g.holding = p.id;
        g.heldX = x; g.heldY = y;
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Pick up from board (placed pieces can be removed and readjusted)
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.state !== 'placed') continue;
      const bx = BOARD_X + p.slotCol * pw + pw / 2;
      const by = BOARD_Y + p.slotRow * ph + ph / 2;
      if (Math.abs(x - bx) < pw / 2 && Math.abs(y - by) < ph / 2) {
        p.state = 'tray';
        p.floating = true;
        p.trayX = x; p.trayY = y;
        p.slotRow = -1; p.slotCol = -1;
        g.holding = p.id;
        g.heldX = x; g.heldY = y;
        setPlaced(pieces.filter(q => q.state === 'placed').length);
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = gameRef.current; if (!g || g.holding === null) return;
    const { x, y } = canvasXY(e);
    g.heldX = x; g.heldY = y;
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = gameRef.current; if (!g || g.holding === null) return;
    const { x, y } = canvasXY(e);
    tryPlace(x, y);
    canvasRef.current!.releasePointerCapture(e.pointerId);
  }

  function tryPlace(x: number, y: number) {
    const g = gameRef.current; if (!g || g.holding === null) return;
    const { pieces, pw, ph, cols, rows, boardW, boardH } = g;
    const p = pieces.find(p => p.id === g.holding)!;

    const inBoard = x >= BOARD_X && x < BOARD_X + boardW && y >= BOARD_Y && y < BOARD_Y + boardH;
    if (inBoard) {
      // Snap to nearest slot (any slot, correct or not)
      const nearCol = Math.max(0, Math.min(cols - 1, Math.floor((x - BOARD_X) / pw)));
      const nearRow = Math.max(0, Math.min(rows - 1, Math.floor((y - BOARD_Y) / ph)));
      const occupied = pieces.some(q => q.state === 'placed' && q.slotRow === nearRow && q.slotCol === nearCol);
      if (!occupied) {
        p.state = 'placed';
        p.floating = false;
        p.slotRow = nearRow;
        p.slotCol = nearCol;
        const onBoard = pieces.filter(q => q.state === 'placed').length;
        setPlaced(onBoard);
        const correct = pieces.filter(q => q.state === 'placed' && q.slotRow === q.row && q.slotCol === q.col).length;
        if (correct === totalRef.current) {
          stopTimer();
          markPhotoCompleted(selPhoto.src, DIFF_STARS[difficulty]);
          setPhotoStars(loadPhotoStars());
          setTimeout(() => setScreen('complete'), 600);
        }
      } else {
        // Slot occupied — stay floating on board
        p.trayX = x; p.trayY = y;
        p.floating = true;
      }
    } else {
      // Outside board — return to tray (small scale)
      p.trayX = x; p.trayY = y;
      p.floating = false;
    }
    g.holding = null;
  }

  useEffect(() => () => stopTimer(), [stopTimer]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Difficulty select ─────────────────────────────────────────────────────
  if (screen === 'difficulty') {
    const diffColors: Record<Difficulty, { border: string; title: string; badge: string; text: string }> = {
      lv1: { border: 'border-sky-400',     title: 'text-sky-300',     badge: 'bg-sky-400/20 border border-sky-400 text-sky-300',     text: '入門挑戰' },
      lv2: { border: 'border-emerald-400', title: 'text-emerald-300', badge: 'bg-emerald-400/20 border border-emerald-400 text-emerald-300', text: '初級挑戰' },
      lv3: { border: 'border-amber-400',   title: 'text-amber-300',   badge: 'bg-amber-400/20 border border-amber-400 text-amber-300',   text: '中級挑戰' },
      lv4: { border: 'border-orange-400',  title: 'text-orange-300',  badge: 'bg-orange-400/20 border border-orange-400 text-orange-300',  text: '高級挑戰' },
      lv5: { border: 'border-rose-400',    title: 'text-rose-300',    badge: 'bg-rose-400/20 border border-rose-400 text-rose-300',    text: '極限挑戰' },
    };
    const row1 = (['lv1', 'lv2', 'lv3'] as Difficulty[]);
    const row2 = (['lv4', 'lv5'] as Difficulty[]);

    const DiffCard = ({ d }: { d: Difficulty }) => {
      const cfg = CONFIGS[d];
      const c   = diffColors[d];
      return (
        <button
          key={d}
          onClick={() => { setDiff(d); setScreen('photo'); }}
          className={`group flex h-52 w-52 flex-col items-center justify-between rounded-2xl border-2 ${c.border} bg-white/10 p-5 text-center shadow-lg transition-all hover:bg-white/20 hover:scale-105 active:scale-95`}
        >
          <span className="text-3xl leading-snug tracking-wide">{cfg.stars}</span>
          <div>
            <p className={`text-lg font-bold ${c.title}`}>{cfg.label}</p>
            <p className="text-sm font-semibold text-white">{cfg.cols} × {cfg.rows}</p>
            <p className="text-xs text-zinc-400">{cfg.cols * cfg.rows} 片</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.badge}`}>{c.text}</span>
        </button>
      );
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6">
        <Link href="/games" className="mb-8 self-start flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <h1 className="mb-1 text-3xl font-bold text-[var(--hero-gold)]">🧩 拼圖遊戲</h1>
        <p className="mb-8 text-sm text-zinc-400">選擇難度，然後挑選一張照片開始拼圖！</p>
        {/* Row 1: lv1 lv2 lv3 */}
        <div className="flex gap-4">
          {row1.map(d => <DiffCard key={d} d={d} />)}
        </div>
        {/* Row 2: lv4 lv5 — centred under row 1 */}
        <div className="mt-4 flex gap-4">
          {row2.map(d => <DiffCard key={d} d={d} />)}
        </div>
      </div>
    );
  }

  // ── Photo select ──────────────────────────────────────────────────────────
  if (screen === 'photo') {
    const cfg = CONFIGS[difficulty];
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setScreen('difficulty')}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
            Back
          </button>
          <h2 className="text-xl font-bold text-white">
            選照片 — {cfg.stars} {cfg.label}（{cfg.cols * cfg.rows} 片）
          </h2>
        </div>

        {/* Photos ordered by group (英雄集結 → 對抗薩諾斯 → 家族合照 → 特別版), flat flex-wrap */}
        <div className="flex flex-wrap gap-4 pb-8">
          {PUZZLE_IMAGES.map(photo => {
            const stars = photoStars[photo.src] ?? 0;
            const done  = stars > 0;
            return (
              <button key={photo.src}
                disabled={loading}
                onClick={() => { setSelPhoto(photo); startGame(difficulty, photo); }}
                className="group relative overflow-hidden rounded-2xl border-4 bg-white/5 transition-all hover:scale-105 hover:shadow-2xl active:scale-95 disabled:cursor-wait"
                style={{
                  borderColor: done ? '#fbbf24' : '#334155',
                  width: photo.ratio === '3x4' ? 275 : 325,
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src} alt={photo.label}
                  className={`w-full object-cover ${photo.ratio === '3x4' ? 'aspect-[3/4]' : 'aspect-square'}`}
                  style={done ? {} : { filter: 'grayscale(0.75) brightness(0.6)' }}
                />
                {done && (
                  <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-sm font-bold text-yellow-400">
                    {'⭐'.repeat(stars)}
                  </div>
                )}
                <p className="p-2 text-center text-sm font-semibold text-slate-300">
                  {photo.label}
                </p>
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60">
            <p className="text-lg font-bold text-white">載入中…</p>
          </div>
        )}
      </div>
    );
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  if (screen === 'complete') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-7xl">🎉</div>
          <h2 className="mb-2 text-3xl font-bold text-white">拼圖完成！</h2>
          <p className="mb-1 text-2xl">{CONFIGS[difficulty].stars}</p>
          <p className="mb-1 text-slate-400">{CONFIGS[difficulty].label}（{CONFIGS[difficulty].cols}×{CONFIGS[difficulty].rows}）</p>
          <p className="mb-8 text-slate-400">
            時間 <strong className="text-white">{fmt(elapsed)}</strong>
          </p>
          <div className="mx-auto mb-8 overflow-hidden rounded-2xl shadow-2xl" style={{ maxWidth: 280 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selPhoto.src} alt={selPhoto.label} className="w-full" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => startGame(difficulty, selPhoto)}
              className="rounded-2xl bg-indigo-500 px-5 py-3 font-bold text-white hover:bg-indigo-600">
              再玩一次
            </button>
            <button onClick={() => setScreen('photo')}
              className="rounded-2xl bg-slate-600 px-5 py-3 font-bold text-white hover:bg-slate-500">
              換照片
            </button>
            <button onClick={() => setScreen('difficulty')}
              className="rounded-2xl bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600">
              換難度
            </button>
            <a href={selPhoto.src} download={selPhoto.label + '.png'}
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-white hover:bg-emerald-600">
              ⬇ 下載圖片
            </a>
            <Link href="/games"
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────
  const cfg = CONFIGS[difficulty];
  const total = cfg.cols * cfg.rows;

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Link href="/games" onClick={stopTimer}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
          Back
        </Link>
        <div className="flex-1 text-center text-sm font-bold text-white">
          🧩 {cfg.stars} {selPhoto.label}
          <span className="ml-2 font-normal text-slate-300">{placedCount}/{total} 片</span>
        </div>
        <span className="font-mono text-sm text-slate-300">{fmt(elapsed)}</span>
        <button
          onPointerDown={() => setShowPrev(true)}
          onPointerUp={() => setShowPrev(false)}
          onPointerLeave={() => setShowPrev(false)}
          className="shrink-0 select-none rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
          👁 預覽
        </button>
        <button
          onClick={goToPhoto}
          className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
          換圖
        </button>
      </div>

      {/* Canvas */}
      <div className="flex flex-1 items-start justify-center overflow-auto p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_W} height={CANVAS_H}
          className="touch-none rounded-xl shadow-2xl"
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 60px)',
            cursor: gameRef.current?.holding !== null ? 'grabbing' : 'pointer',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      </div>
    </div>
  );
}
