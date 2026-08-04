'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAZE_ROWS,
  MAZE_COLS,
  PLAYER_START,
  GHOST_STARTS,
  PORTAL_POS,
  cellTypeAt,
  isWalkableForPlayer,
  samePos,
  cellKey,
  placeLetters,
  ghostStep,
  tunnelExitFor,
  type GridPos,
} from '@/lib/wordMaze';
import type { MazeWord } from '@/data/wordMazeWords';
import { playCollectSound, playPortalSound, playErrorSound } from '@/lib/sound';
import PacmanSprite from '@/components/PacmanSprite';
import GhostSprite, { type GhostColorKey } from '@/components/GhostSprite';
import { useMazeCellSize } from './useMazeCellSize';

const START_LIVES = 3;
const MOVE_REPEAT_MS = 150;
// Classic four ghost colors, cycling for ghost counts beyond 4. The first
// two stay pure random-walk (matching the original difficulty); later
// ghosts get a growing chance to bias toward the player so more ghosts
// means more than just visual variety.
const GHOST_COLORS: GhostColorKey[] = ['red', 'pink', 'blue', 'orange'];

function chaseChanceFor(index: number): number {
  if (index < 2) return 0;
  return Math.min(0.55, 0.2 + (index - 1) * 0.08);
}

type Direction = 'north' | 'south' | 'left' | 'right';

interface GhostState {
  pos: GridPos;
  dir: Direction | null;
}

interface MazePhaseProps {
  word: MazeWord;
  ghostCount: number;
  ghostTickMs: number;
  onComplete: () => void;
  tunnelMode?: boolean;
}

function makeGhosts(count: number): GhostState[] {
  return GHOST_STARTS.slice(0, count).map((pos) => ({ pos, dir: null }));
}

export default function MazePhase({ word, ghostCount, ghostTickMs, onComplete, tunnelMode = false }: MazePhaseProps) {
  const [player, setPlayer] = useState<GridPos>(PLAYER_START);
  const [playerDir, setPlayerDir] = useState<Direction>('right');
  const [ghosts, setGhosts] = useState<GhostState[]>(() => makeGhosts(ghostCount));
  const [letterMap, setLetterMap] = useState<Map<string, string>>(() => placeLetters(word.word, [PLAYER_START]));
  const [collected, setCollected] = useState<string[]>([]);
  const [dotsEaten, setDotsEaten] = useState<Set<string>>(new Set());
  const [lives, setLives] = useState(START_LIVES);
  const [caught, setCaught] = useState(false);
  const [lost, setLost] = useState(false);
  const portalNotified = useRef(false);

  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const portalOpen = letterMap.size === 0;

  useEffect(() => {
    if (portalOpen && !portalNotified.current) {
      portalNotified.current = true;
      playPortalSound();
    }
  }, [portalOpen]);

  const resetAfterCatch = useCallback(() => {
    setPlayer(PLAYER_START);
    setGhosts(makeGhosts(ghostCount));
    setCaught(false);
  }, [ghostCount]);

  const handleCaught = useCallback(() => {
    setCaught(true);
    playErrorSound();
    setLives((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        setLost(true);
      } else {
        setTimeout(resetAfterCatch, 700);
      }
      return next;
    });
  }, [resetAfterCatch]);

  // Ghost movement tick. Reads player position via a ref (not a dependency)
  // so frequent player moves don't reset this interval's phase and stall it.
  useEffect(() => {
    if (caught || lost) return;
    const timer = setInterval(() => {
      setGhosts((prev) =>
        prev.map((g, i) => {
          const { pos, dir } = ghostStep(g.pos, g.dir, playerRef.current, chaseChanceFor(i));
          return { pos, dir };
        }),
      );
    }, ghostTickMs);
    return () => clearInterval(timer);
  }, [caught, lost, ghostTickMs]);

  // Check collisions whenever ghosts move.
  useEffect(() => {
    if (caught || lost) return;
    if (ghosts.some((g) => samePos(g.pos, player))) {
      const timer = setTimeout(handleCaught, 0);
      return () => clearTimeout(timer);
    }
  }, [ghosts, player, caught, lost, handleCaught]);

  // Only computes the next cell here — collection/portal side effects live in
  // the effect below, since setState updater functions are double-invoked by
  // React in development (StrictMode) and must stay pure.
  const move = useCallback(
    (dir: Direction) => {
      if (caught || lost) return;
      setPlayerDir(dir);
      setPlayer((prev) => {
        const deltas: Record<Direction, [number, number]> = {
          north: [-1, 0],
          south: [1, 0],
          left: [0, -1],
          right: [0, 1],
        };
        const [dr, dc] = deltas[dir];
        const nextRow = prev.row + dr;
        const nextCol = prev.col + dc;
        if (!isWalkableForPlayer(nextRow, nextCol, portalOpen)) {
          if (tunnelMode) {
            const exit = tunnelExitFor(nextRow, nextCol, dr, dc);
            if (exit && isWalkableForPlayer(exit.row, exit.col, portalOpen)) return exit;
          }
          return prev;
        }
        return { row: nextRow, col: nextCol };
      });
    },
    [caught, lost, portalOpen, tunnelMode],
  );

  const lastProcessedKey = useRef<string | null>(null);
  useEffect(() => {
    const key = cellKey(player);
    if (lastProcessedKey.current === key) return;
    const timer = setTimeout(() => {
      lastProcessedKey.current = key;

      if (portalOpen && samePos(player, PORTAL_POS)) {
        playPortalSound();
        setTimeout(onComplete, 400);
        return;
      }

      if (letterMap.has(key)) {
        const letter = letterMap.get(key)!;
        playCollectSound();
        setCollected((c) => [...c, letter]);
        setLetterMap((m) => {
          const copy = new Map(m);
          copy.delete(key);
          return copy;
        });
      } else if (cellTypeAt(player.row, player.col) === 'path') {
        setDotsEaten((s) => (s.has(key) ? s : new Set(s).add(key)));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [player, portalOpen, letterMap, onComplete]);

  // Press-and-hold continuous movement: works the same for keyboard and the
  // on-screen D-pad. moveRef always points at the latest `move` closure so a
  // long-running interval never acts on stale caught/lost/portalOpen state.
  const moveRef = useRef(move);
  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const heldDirRef = useRef<Direction | null>(null);
  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = useCallback(() => {
    heldDirRef.current = null;
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
  }, []);

  const startHold = useCallback(
    (dir: Direction) => {
      moveRef.current(dir);
      heldDirRef.current = dir;
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = setInterval(() => {
        if (heldDirRef.current) moveRef.current(heldDirRef.current);
      }, MOVE_REPEAT_MS);
    },
    [],
  );

  useEffect(() => stopHold, [stopHold]);

  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: 'north',
      ArrowDown: 'south',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    function handleKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      if (e.repeat) return;
      startHold(dir);
    }
    function handleKeyUp(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      if (heldDirRef.current === dir) stopHold();
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startHold, stopHold]);

  function retry() {
    setPlayer(PLAYER_START);
    setPlayerDir('right');
    setGhosts(makeGhosts(ghostCount));
    setLetterMap(placeLetters(word.word, [PLAYER_START]));
    setCollected([]);
    setDotsEaten(new Set());
    setLives(START_LIVES);
    setCaught(false);
    setLost(false);
    portalNotified.current = false;
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const mazeFrameRef = useRef<HTMLDivElement>(null);
  const dpadBlockRef = useRef<HTMLDivElement>(null);
  const cellPx = useMazeCellSize({ mazeFrameRef, dpadBlockRef, containerRef });

  const dirButtonClass =
    'flex items-center justify-center rounded-2xl bg-white text-zinc-900 shadow-lg transition-colors hover:bg-zinc-100 active:bg-zinc-200 select-none';

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 flex w-full max-w-md items-center justify-between text-xs font-bold text-[var(--hero-gold)] sm:mb-3 sm:text-sm">
        <span>
          {'❤️'.repeat(Math.max(lives, 0))}
          {'🖤'.repeat(Math.max(START_LIVES - lives, 0))}
        </span>
        <span>
          已收集 {collected.length} / {word.word.length}
        </span>
      </div>

      <div ref={containerRef} className="flex w-full flex-wrap items-start justify-center gap-3 sm:gap-6">
      <div
        ref={mazeFrameRef}
        className="maze-frame relative rounded-xl border-4 border-cyan-400 bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-1 shadow-lg"
      >
        <div className="relative" style={{ width: MAZE_COLS * cellPx, height: MAZE_ROWS * cellPx }}>
          <div
            className="absolute inset-0 grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${MAZE_COLS}, ${cellPx}px)`,
              gridTemplateRows: `repeat(${MAZE_ROWS}, ${cellPx}px)`,
            }}
          >
            {Array.from({ length: MAZE_ROWS }, (_, row) =>
              Array.from({ length: MAZE_COLS }, (_, col) => {
                const type = cellTypeAt(row, col);
                const key = cellKey({ row, col });
                const isPortal = row === PORTAL_POS.row && col === PORTAL_POS.col;
                const letter = letterMap.get(key);

                let content: React.ReactNode = null;
                let bg = 'bg-[#050014]';
                let wallStyle: React.CSSProperties | undefined;

                if (type === 'wall') {
                  bg = 'bg-blue-600';
                  const topWall = cellTypeAt(row - 1, col) === 'wall';
                  const bottomWall = cellTypeAt(row + 1, col) === 'wall';
                  const leftWall = cellTypeAt(row, col - 1) === 'wall';
                  const rightWall = cellTypeAt(row, col + 1) === 'wall';
                  const r = cellPx / 2;
                  wallStyle = {
                    borderTopLeftRadius: !topWall && !leftWall ? r : 0,
                    borderTopRightRadius: !topWall && !rightWall ? r : 0,
                    borderBottomLeftRadius: !bottomWall && !leftWall ? r : 0,
                    borderBottomRightRadius: !bottomWall && !rightWall ? r : 0,
                    boxShadow: 'inset 0 0 3px rgba(165, 243, 252, 0.6)',
                  };
                } else if (type === 'house') {
                  // Looks black like walkable paths otherwise — give it a
                  // distinct tint so it doesn't read as walkable to the player.
                  bg = 'bg-pink-950/70';
                } else if (isPortal) {
                  bg = portalOpen ? 'bg-yellow-900/40' : 'bg-zinc-900';
                  content = (
                    <span className={portalOpen ? 'animate-spin text-lg' : 'text-sm opacity-70'}>
                      {portalOpen ? '🌀' : '🔒'}
                    </span>
                  );
                } else if (letter) {
                  content = (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-extrabold text-zinc-900">
                      {letter}
                    </span>
                  );
                } else if (type === 'path' && !dotsEaten.has(key)) {
                  content = <span className="h-1.5 w-1.5 rounded-full bg-yellow-200/70" />;
                }

                return (
                  <div key={key} className={`flex items-center justify-center ${bg}`} style={wallStyle}>
                    {content}
                  </div>
                );
              }),
            )}
          </div>

          <div
            className="absolute flex items-center justify-center"
            style={{
              top: player.row * cellPx,
              left: player.col * cellPx,
              width: cellPx,
              height: cellPx,
              transition: 'top 150ms linear, left 150ms linear',
            }}
          >
            <PacmanSprite direction={playerDir} size={cellPx - 4} />
          </div>

          {ghosts.map((g, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center"
              style={{
                top: g.pos.row * cellPx,
                left: g.pos.col * cellPx,
                width: cellPx,
                height: cellPx,
                transition: `top ${ghostTickMs - 20}ms linear, left ${ghostTickMs - 20}ms linear`,
              }}
            >
              <GhostSprite colorKey={GHOST_COLORS[i % GHOST_COLORS.length]} direction={g.dir} size={cellPx - 4} />
            </div>
          ))}
        </div>

        {caught && !lost && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 text-3xl">
            💥
          </div>
        )}

        {lost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/85 text-center">
            <p className="text-2xl font-bold text-white">😵 Game Over</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              再試一次
            </button>
          </div>
        )}
      </div>

      <div ref={dpadBlockRef} className="flex flex-col items-center gap-2 sm:gap-4">
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          {word.word.split('').map((_, i) => (
            <span
              key={i}
              className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-[var(--hero-gold)] bg-white/90 text-xs font-extrabold text-zinc-900 sm:h-8 sm:w-8 sm:text-sm"
            >
              {collected[i] ?? ''}
            </span>
          ))}
        </div>

        <div className="grid w-44 grid-cols-3 grid-rows-3 gap-1.5 sm:w-56 sm:gap-3" style={{ touchAction: 'none' }}>
          <div />
          <button
            type="button"
            onPointerDown={() => startHold('north')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className={`${dirButtonClass} h-12 flex-col text-xl sm:h-16 sm:text-2xl`}
          >
            <span>⬆️</span><span className="text-[10px] font-bold">Up</span>
          </button>
          <div />
          <button
            type="button"
            onPointerDown={() => startHold('left')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className={`${dirButtonClass} h-12 flex-col text-xl sm:h-16 sm:text-2xl`}
          >
            <span>⬅️</span><span className="text-[10px] font-bold">Left</span>
          </button>
          <div />
          <button
            type="button"
            onPointerDown={() => startHold('right')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className={`${dirButtonClass} h-12 flex-col text-xl sm:h-16 sm:text-2xl`}
          >
            <span>➡️</span><span className="text-[10px] font-bold">Right</span>
          </button>
          <div />
          <button
            type="button"
            onPointerDown={() => startHold('south')}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            className={`${dirButtonClass} h-12 flex-col text-xl sm:h-16 sm:text-2xl`}
          >
            <span>⬇️</span><span className="text-[10px] font-bold">Down</span>
          </button>
          <div />
        </div>
        <p className="hidden text-center text-xs text-zinc-400 sm:block">吃掉所有字母，躲開幽靈，找到傳送門！</p>
      </div>
      </div>
    </div>
  );
}
