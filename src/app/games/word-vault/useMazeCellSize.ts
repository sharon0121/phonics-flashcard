import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { MAZE_ROWS, MAZE_COLS } from '@/lib/wordMaze';

export const DEFAULT_CELL_PX = 22;
const MIN_CELL_PX = 16;
// Raised from 30 — on a spacious iPad landscape viewport the fit-budget
// math would happily allow bigger cells than 30px, but the old cap silently
// threw that headroom away and left the maze looking small in the middle
// of a big screen.
const MAX_CELL_PX = 44;
const BREATHING_ROOM_PX = 12;
const MAZE_FRAME_CHROME_PX = 10; // maze-frame's own border+padding (border-4 + p-1) on top of the grid.

// Reads the enclosing <main>'s actual bottom padding rather than assuming a
// fixed number, so the reserve tracks the real CSS (including any
// responsive py- changes) instead of drifting out of sync with it.
function getMainBottomPadding(el: HTMLElement): number {
  let node: HTMLElement | null = el;
  while (node && node.tagName !== 'MAIN') node = node.parentElement;
  if (!node) return 32;
  return parseFloat(getComputedStyle(node).paddingBottom) || 0;
}

// Reads the container's real gap instead of assuming a fixed `gap-6` value,
// since the gap itself is now responsive (smaller on narrow screens).
function getContainerGap(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).columnGap) || 0;
}

interface MazeCellSizeRefs {
  mazeFrameRef: RefObject<HTMLDivElement | null>;
  dpadBlockRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Computes a maze cell size that makes the maze + D-pad fit the visible
// viewport without scrolling, on any device. Rather than guessing per
// breakpoint, it measures the ACTUAL rendered chrome (everything above the
// maze, and the D-pad column's real size) and solves for the largest cell
// that fits — first assuming the maze and D-pad sit side by side, falling
// back to a stacked-layout budget if that assumption doesn't hold once the
// browser's own flex-wrap has made its real decision.
export function useMazeCellSize({ mazeFrameRef, dpadBlockRef, containerRef }: MazeCellSizeRefs): number {
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const correctedRef = useRef(false);

  useLayoutEffect(() => {
    function recompute(allowCorrection: boolean) {
      const mazeFrame = mazeFrameRef.current;
      const dpadBlock = dpadBlockRef.current;
      const container = containerRef.current;
      if (!mazeFrame || !dpadBlock || !container) return;

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const chromeAboveMaze = mazeFrame.getBoundingClientRect().top;
      const containerWidth = container.clientWidth;
      const dpadRect = dpadBlock.getBoundingClientRect();
      const dpadWidth = dpadRect.width;
      const dpadHeight = dpadRect.height;
      const bottomSafety = getMainBottomPadding(container) + BREATHING_ROOM_PX;
      const gapPx = getContainerGap(container);

      const widthBudgetRow = containerWidth - gapPx - dpadWidth;
      const heightBudgetRow = viewportHeight - chromeAboveMaze - bottomSafety - MAZE_FRAME_CHROME_PX;
      let next = Math.floor(Math.min(widthBudgetRow / MAZE_COLS, heightBudgetRow / MAZE_ROWS));
      // Check the fit against the size we'll actually render (never below
      // MIN_CELL_PX) — checking the pre-clamp value understates the maze's
      // real width and can wrongly conclude a row layout fits when the
      // clamped-up result would actually overflow it.
      next = Math.max(next, MIN_CELL_PX);

      const mazeWidthAtRow = next * MAZE_COLS;
      const fitsRow = mazeWidthAtRow + gapPx + dpadWidth <= containerWidth;

      if (!fitsRow) {
        const widthBudgetStack = containerWidth;
        const heightBudgetStack =
          viewportHeight - chromeAboveMaze - gapPx - dpadHeight - bottomSafety - MAZE_FRAME_CHROME_PX;
        next = Math.floor(Math.min(widthBudgetStack / MAZE_COLS, heightBudgetStack / MAZE_ROWS));
      }

      next = clamp(next, MIN_CELL_PX, MAX_CELL_PX);
      setCellPx((prev) => (prev === next ? prev : next));

      // The maze's own width only settles after this render commits, which
      // can flip the browser's actual row/stack wrap decision relative to
      // what we assumed above. Re-measure once, next frame, against the
      // real layout to correct for that — bounded to a single pass so this
      // can never loop.
      if (allowCorrection) {
        correctedRef.current = false;
        requestAnimationFrame(() => {
          if (correctedRef.current) return;
          correctedRef.current = true;
          recompute(false);
        });
      }
    }

    recompute(true);

    function handleResize() {
      recompute(true);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return cellPx;
}
