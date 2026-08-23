'use client';

import dynamic from 'next/dynamic';

const TetrisView = dynamic(() => import('./TetrisView'), { ssr: false });

export default function TetrisPage() {
  return <TetrisView />;
}
