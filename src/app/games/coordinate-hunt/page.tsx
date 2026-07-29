'use client';

import dynamic from 'next/dynamic';

const CoordinateHuntView = dynamic(() => import('./CoordinateHuntView'), { ssr: false });

export default function CoordinateHuntPage() {
  return <CoordinateHuntView />;
}
