'use client';

import dynamic from 'next/dynamic';

const PuyoView = dynamic(() => import('./PuyoView'), { ssr: false });

export default function PuyoPage() {
  return <PuyoView />;
}
