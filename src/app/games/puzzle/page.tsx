'use client';
import dynamic from 'next/dynamic';

const PuzzleView = dynamic(() => import('./PuzzleView'), { ssr: false });
export default function PuzzlePage() {
  return <PuzzleView />;
}
