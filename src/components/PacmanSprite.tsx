'use client';

type Direction = 'north' | 'south' | 'left' | 'right';

interface PacmanSpriteProps {
  direction: Direction;
  size?: number;
  className?: string;
}

// The source art's mouth opens toward the left at 0°, so rotate clockwise
// from there: left→0, north→90, right→180, south→270.
const DIR_DEG: Record<Direction, number> = { left: 0, north: 90, right: 180, south: 270 };

export default function PacmanSprite({ direction, size = 24, className = '' }: PacmanSpriteProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, transform: `rotate(${DIR_DEG[direction]}deg)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sprites/pacman.png"
        alt=""
        className="pacman-chomp"
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
    </div>
  );
}
