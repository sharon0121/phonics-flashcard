'use client';

export type GhostColorKey = 'red' | 'pink' | 'blue' | 'orange';
type Direction = 'north' | 'south' | 'left' | 'right' | null;

interface GhostSpriteProps {
  colorKey: GhostColorKey;
  direction: Direction;
  size?: number;
  className?: string;
}

const GHOST_SRC: Record<GhostColorKey, string> = {
  red: '/sprites/ghost-red.png',
  pink: '/sprites/ghost-pink.png',
  blue: '/sprites/ghost-blue.png',
  orange: '/sprites/ghost-orange.png',
};

export default function GhostSprite({ colorKey, direction, size = 24, className = '' }: GhostSpriteProps) {
  // The source art only has one facing; flip it for a touch of life when
  // heading right (the eyes read naturally facing left otherwise).
  const flip = direction === 'right';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={GHOST_SRC[colorKey]}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated', transform: flip ? 'scaleX(-1)' : undefined }}
    />
  );
}
