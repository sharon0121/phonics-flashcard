'use client';

import dynamic from 'next/dynamic';

const BlockPuzzleView = dynamic(() => import('./BlockPuzzleView'), { ssr: false });

export default function BlockPuzzlePage() {
  return <BlockPuzzleView />;
}
